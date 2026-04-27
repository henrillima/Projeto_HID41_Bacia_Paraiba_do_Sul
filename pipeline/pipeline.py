"""
Orquestrador principal do pipeline de dados pluviométricos.

Sequência de execução:
  1. Carrega config.yaml e .env
  2. Parseia os ZIPs de cada estação configurada
  3. Monta DataFrame pivot (index=data, colunas=estações)
  4. Aplica preenchimento de falhas (regressão + IDW) na estação de referência
  5. Escolhe método vencedor (menor RMSE no holdout)
  6. Constrói séries agregadas (mensal, anual, máx. diária anual)
  7. Calcula histogramas e estatísticas descritivas
  8. Carrega tudo no Supabase (limpa + insere — idempotente)
  9. Imprime sumário final

Uso:
  cd pipeline
  python pipeline.py
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import pandas as pd
import yaml
from dotenv import load_dotenv

# Garante que src/ está no caminho
sys.path.insert(0, str(Path(__file__).parent))

from src.gap_filling import comparar_metodos, fill_idw, fill_regressao_multipla
from src.parser import parse_ana_zip
from src.series_builder import build_annual, build_max_daily_annual, build_monthly
from src.stats import histograma_com_estatisticas
from src.supabase_loader import (
    get_client,
    insert_histograma,
    insert_max_diaria_anual,
    insert_preenchimento,
    insert_serie_anual,
    insert_serie_diaria,
    insert_serie_mensal,
    limpar_estacao,
    upsert_estacao,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")

RAW_DATA_DIR = Path(__file__).parent / "data" / "raw"
CONFIG_FILE = Path(__file__).parent / "config.yaml"


def load_config() -> dict:
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def find_zip(codigo: str) -> Path:
    """Procura o ZIP da estação em data/raw/ por código."""
    candidates = list(RAW_DATA_DIR.glob(f"*{codigo}*.zip")) + list(RAW_DATA_DIR.glob(f"{codigo}.zip"))
    if not candidates:
        raise FileNotFoundError(
            f"ZIP para estação {codigo} não encontrado em {RAW_DATA_DIR}.\n"
            f"Baixe o arquivo do Hidroweb e coloque em: {RAW_DATA_DIR}"
        )
    return candidates[0]


def main() -> None:
    # 1. Configuração
    load_dotenv(Path(__file__).parent / ".env")
    cfg = load_config()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar definidos em .env")
        sys.exit(1)

    client = get_client(url, key)

    proc = cfg["processamento"]
    max_falhas = proc["max_falhas_pct"]
    n_bins = proc["histograma_bins"]
    holdout_pct = proc["holdout_pct_validacao"]
    rng_seed = proc["random_state"]
    idw_exp = proc["idw_expoente"]
    batch_size = proc["supabase_batch_size"]

    estacoes_cfg: list[dict] = cfg["estacoes"]
    codigos = [e["codigo"] for e in estacoes_cfg]
    est_ref_cfg = next(e for e in estacoes_cfg if e.get("is_referencia"))
    codigo_ref = est_ref_cfg["codigo"]
    codigos_aux = [c for c in codigos if c != codigo_ref]

    coords = {e["codigo"]: (e["lat"], e["lon"]) for e in estacoes_cfg}

    logger.info("=" * 60)
    logger.info(f"PIPELINE: {cfg['projeto']['nome']}")
    logger.info(f"Estações: {codigos}")
    logger.info(f"Referência: {codigo_ref} | Auxiliares: {codigos_aux}")
    logger.info("=" * 60)

    # 2. Parse dos ZIPs
    series_diarias: dict[str, pd.DataFrame] = {}
    metas: dict[str, dict] = {}

    for est_cfg in estacoes_cfg:
        codigo = est_cfg["codigo"]
        zip_path = find_zip(codigo)
        meta, df_daily = parse_ana_zip(zip_path)
        metas[codigo] = meta
        series_diarias[codigo] = df_daily

    # 3. Pivot (index=data, cols=codigos)
    df_pivot_parts = {}
    for codigo, df in series_diarias.items():
        s = df.set_index("data")["valor"]
        # Garante índice contínuo de datas
        s = s[~s.index.duplicated(keep="last")]
        df_pivot_parts[codigo] = s

    df_pivot = pd.DataFrame(df_pivot_parts)
    data_min = df_pivot.index.min()
    data_max = df_pivot.index.max()
    logger.info(f"Pivot: {len(df_pivot)} dias ({data_min.date()} → {data_max.date()})")

    # 4. Preenchimento de falhas na estação de referência
    logger.info(f"\n--- Preenchimento de falhas: {codigo_ref} ---")
    resultado_reg = fill_regressao_multipla(
        df_pivot, codigo_ref, codigos_aux,
        holdout_pct=holdout_pct, random_state=rng_seed,
    )
    resultado_idw = fill_idw(
        df_pivot, codigo_ref, codigos_aux, coords,
        expoente=idw_exp, holdout_pct=holdout_pct, random_state=rng_seed,
    )
    comparacao = comparar_metodos(resultado_reg, resultado_idw)
    metodo_vencedor = comparacao["melhor_metodo"]

    # 5. Série final da referência com preenchimento aplicado
    if metodo_vencedor == "regressao":
        serie_ref_final = resultado_reg["serie_preenchida"]
        mascara_preench = resultado_reg["mascara_preenchidos"]
    else:
        serie_ref_final = resultado_idw["serie_preenchida"]
        mascara_preench = resultado_idw["mascara_preenchidos"]

    # Atualiza o pivot com os valores preenchidos
    df_pivot[codigo_ref] = serie_ref_final

    # 6. Constrói séries agregadas para cada estação
    logger.info("\n--- Construindo séries agregadas ---")
    series_mensais: dict[str, pd.DataFrame] = {}
    series_anuais: dict[str, pd.DataFrame] = {}
    series_max_anual: dict[str, pd.DataFrame] = {}

    for codigo in codigos:
        # Recompõe série diária a partir do pivot (inclui valores preenchidos)
        df_d = pd.DataFrame({
            "estacao_codigo": codigo,
            "data": df_pivot.index,
            "valor": df_pivot[codigo].values,
            "preenchido": mascara_preench.values if codigo == codigo_ref else False,
            "metodo": metodo_vencedor if codigo == codigo_ref else None,
            "consistencia": series_diarias[codigo].set_index("data")["consistencia"].reindex(df_pivot.index).values,
        })

        series_mensais[codigo] = build_monthly(df_d, max_falhas_pct=max_falhas)
        series_anuais[codigo] = build_annual(series_mensais[codigo], max_falhas_pct=max_falhas)
        series_max_anual[codigo] = build_max_daily_annual(df_d)

    # 7. Histogramas e estatísticas
    logger.info("\n--- Calculando histogramas e estatísticas ---")
    histogramas_resultado: dict[str, dict[str, dict]] = {}

    for codigo in codigos:
        df_d = pd.DataFrame({
            "data": df_pivot.index,
            "valor": df_pivot[codigo].values,
        })

        hist_diaria = histograma_com_estatisticas(df_d["valor"], n_bins)

        s_mensal = pd.Series(
            series_mensais[codigo].loc[series_mensais[codigo]["valido"], "valor"].values
        )
        hist_mensal = histograma_com_estatisticas(s_mensal, n_bins)

        s_anual = pd.Series(
            series_anuais[codigo].loc[series_anuais[codigo]["valido"], "valor"].values
        )
        hist_anual = histograma_com_estatisticas(s_anual, n_bins)

        s_max = pd.Series(series_max_anual[codigo]["valor"].values)
        hist_max = histograma_com_estatisticas(s_max, n_bins)

        histogramas_resultado[codigo] = {
            "diaria": hist_diaria,
            "mensal": hist_mensal,
            "anual": hist_anual,
            "max_diaria_anual": hist_max,
        }

    # 8. Carga no Supabase
    logger.info("\n--- Carregando dados no Supabase ---")
    totais: dict[str, int] = {}

    for est_cfg in estacoes_cfg:
        codigo = est_cfg["codigo"]
        logger.info(f"\n[{codigo}] Limpando dados anteriores...")
        limpar_estacao(client, codigo)

        # Metadados enriquecidos com estatísticas calculadas
        df_d_orig = series_diarias[codigo]
        n_dias_total = len(df_d_orig)
        n_com_dado = int(df_d_orig["valor"].notna().sum())
        pct_falhas_orig = round(100.0 * (1 - n_com_dado / n_dias_total), 2) if n_dias_total else 0.0

        # Pós-preenchimento (somente referência muda)
        if codigo == codigo_ref:
            n_com_dado_pos = n_com_dado + resultado_reg["n_preenchidos"] if metodo_vencedor == "regressao" else n_com_dado + resultado_idw["n_preenchidos"]
            pct_falhas_pos = round(100.0 * (1 - n_com_dado_pos / n_dias_total), 2) if n_dias_total else 0.0
        else:
            pct_falhas_pos = pct_falhas_orig

        anos_dados = len(series_anuais[codigo])

        upsert_estacao(client, {
            "codigo": codigo,
            "nome": est_cfg.get("nome", metas[codigo].get("NomeEstacao", codigo)),
            "lat": est_cfg["lat"],
            "lon": est_cfg["lon"],
            "altitude": est_cfg.get("altitude"),
            "is_referencia": bool(est_cfg.get("is_referencia", False)),
            "anos_dados": anos_dados,
            "n_dias_total": n_dias_total,
            "n_dias_com_dado": n_com_dado,
            "pct_falhas_original": pct_falhas_orig,
            "pct_falhas_pos_preenchimento": pct_falhas_pos,
            "data_inicio": df_d_orig["data"].min().date().isoformat(),
            "data_fim": df_d_orig["data"].max().date().isoformat(),
        })

        # Série diária
        df_d = pd.DataFrame({
            "data": df_pivot.index,
            "valor": df_pivot[codigo].values,
            "preenchido": mascara_preench.values if codigo == codigo_ref else False,
            "metodo": metodo_vencedor if codigo == codigo_ref else None,
            "consistencia": df_d_orig.set_index("data")["consistencia"].reindex(df_pivot.index).values,
        })
        n_d = insert_serie_diaria(client, codigo, df_d, batch_size)
        n_m = insert_serie_mensal(client, codigo, series_mensais[codigo], batch_size)
        n_a = insert_serie_anual(client, codigo, series_anuais[codigo], batch_size)
        n_mx = insert_max_diaria_anual(client, codigo, series_max_anual[codigo], batch_size)

        # Histogramas
        for tipo, dados in histogramas_resultado[codigo].items():
            insert_histograma(client, codigo, tipo, dados)

        totais[codigo] = {"diaria": n_d, "mensal": n_m, "anual": n_a, "max_anual": n_mx}

    # Resultados de preenchimento
    insert_preenchimento(client, codigo_ref, "regressao", resultado_reg, is_vencedor=(metodo_vencedor == "regressao"))
    insert_preenchimento(client, codigo_ref, "idw", resultado_idw, is_vencedor=(metodo_vencedor == "idw"))

    # 9. Sumário final
    logger.info("\n" + "=" * 60)
    logger.info("SUMÁRIO FINAL")
    logger.info("=" * 60)
    for codigo, t in totais.items():
        logger.info(f"  {codigo}: {t['diaria']} dias | {t['mensal']} meses | {t['anual']} anos | {t['max_anual']} max_anual")
    logger.info(f"\n  Método vencedor: {metodo_vencedor.upper()}")
    logger.info(f"  RMSE regressão : {comparacao['rmse_regressao']:.4f} mm")
    logger.info(f"  RMSE IDW       : {comparacao['rmse_idw']:.4f} mm")
    logger.info(f"\n  {comparacao['justificativa']}")
    logger.info("\nPipeline concluído com sucesso.")


if __name__ == "__main__":
    main()
