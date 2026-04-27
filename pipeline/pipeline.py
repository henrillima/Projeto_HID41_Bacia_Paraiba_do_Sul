"""
Orquestrador principal do pipeline de dados pluviométricos.

Lê a seleção de estações da tabela config_estacoes no Supabase (preenchida
via UI do dashboard), processa cada estação e salva todos os resultados.

Sequência:
  1. Lê config_estacoes do Supabase (estações com lat/lon configurados)
  2. Parseia os ZIPs locais de cada estação
  3. Aplica preenchimento de falhas (regressão + IDW) em TODAS as estações
  4. Escolhe método vencedor por estação (menor RMSE no holdout)
  5. Constrói séries mensais, anuais e de máx. diária anual
  6. Calcula histogramas e estatísticas descritivas
  7. Carrega tudo no Supabase (idempotente)

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")

RAW_DATA_DIR = Path(__file__).parent / "data" / "raw"
CONFIG_FILE  = Path(__file__).parent / "config.yaml"


def load_config_yaml() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


def find_zip(codigo: str) -> Path:
    candidates = (
        list(RAW_DATA_DIR.glob(f"*{codigo}*.zip")) +
        list(RAW_DATA_DIR.glob(f"{codigo}.zip"))
    )
    if not candidates:
        raise FileNotFoundError(
            f"ZIP para estação {codigo} não encontrado em {RAW_DATA_DIR}."
        )
    return candidates[0]


def main() -> None:
    load_dotenv(Path(__file__).parent / ".env")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar definidos em .env")
        sys.exit(1)

    client = get_client(url, key)

    cfg_yaml = load_config_yaml()
    proc      = cfg_yaml.get("processamento", {})
    max_falhas   = proc.get("max_falhas_pct", 5.0)
    n_bins       = proc.get("histograma_bins", 30)
    holdout_pct  = proc.get("holdout_pct_validacao", 0.10)
    rng_seed     = proc.get("random_state", 42)
    idw_exp      = proc.get("idw_expoente", 2)
    batch_size   = proc.get("supabase_batch_size", 500)

    # Fonte das estações: config_estacoes no Supabase (se populado via UI)
    # Fallback: config.yaml local
    rows_db = client.table("config_estacoes").select("*").execute().data
    estacoes_cfg = [r for r in rows_db if r.get("lat") and r.get("lon")]

    if not estacoes_cfg:
        logger.info("config_estacoes vazio — lendo estações do config.yaml")
        yaml_ests = cfg_yaml.get("estacoes", [])
        estacoes_cfg = [
            e for e in yaml_ests
            if str(e.get("codigo", "")).upper() != "PREENCHER"
            and e.get("lat") and e.get("lon")
        ]

    if len(estacoes_cfg) < 2:
        logger.error(
            "Nenhuma estação configurada. Faça uma das opções:\n"
            "  1. Preencha 'estacoes' no config.yaml com código, nome, lat, lon\n"
            "  2. Use o painel /selecao do dashboard e salve a seleção"
        )
        sys.exit(1)

    codigos = [e["codigo"] for e in estacoes_cfg]
    coords  = {e["codigo"]: (float(e["lat"]), float(e["lon"])) for e in estacoes_cfg}
    ref_cfg = next((e for e in estacoes_cfg if e.get("is_referencia")), estacoes_cfg[0])
    codigo_ref = ref_cfg["codigo"]

    logger.info("=" * 60)
    logger.info(f"PIPELINE — Bacia do Paraíba do Sul")
    logger.info(f"Estações: {codigos}")
    logger.info(f"Referência: {codigo_ref}")
    logger.info("=" * 60)

    # Parse dos ZIPs
    series_diarias: dict[str, pd.DataFrame] = {}
    for est in estacoes_cfg:
        codigo = est["codigo"]
        try:
            zip_path = find_zip(codigo)
            _, df_daily = parse_ana_zip(zip_path)
            series_diarias[codigo] = df_daily
            logger.info(f"[parse] {codigo}: {len(df_daily)} dias")
        except Exception as e:
            logger.error(f"[parse] {codigo}: {e}")
            sys.exit(1)

    # Pivot (index=data, colunas=codigos)
    df_pivot = pd.DataFrame({
        codigo: df.set_index("data")["valor"].pipe(lambda s: s[~s.index.duplicated(keep="last")])
        for codigo, df in series_diarias.items()
    })
    logger.info(f"Pivot: {len(df_pivot)} dias ({df_pivot.index.min().date()} → {df_pivot.index.max().date()})")

    # Verifica se há coordenadas reais (lat/lon != 0) para habilitar IDW
    coords_validas = all(
        abs(lat) > 0.001 or abs(lon) > 0.001
        for lat, lon in coords.values()
    )
    if not coords_validas:
        logger.warning(
            "Coordenadas não configuradas (lat=0, lon=0). "
            "Método IDW desativado — usando apenas regressão. "
            "Para ativar IDW, preencha lat/lon no config.yaml ou em /selecao."
        )

    # Preenchimento de falhas para TODAS as estações
    resultados: dict[str, dict] = {}

    for est in estacoes_cfg:
        codigo = est["codigo"]
        aux    = [c for c in codigos if c != codigo]

        logger.info(f"\n--- Preenchimento: {codigo} | auxiliares: {aux} ---")
        try:
            res_reg = fill_regressao_multipla(df_pivot, codigo, aux, holdout_pct, rng_seed)
        except Exception as e:
            logger.warning(f"[{codigo}] Regressão falhou: {e} — mantendo série original")
            resultados[codigo] = {"vencedor": None, "reg": None, "idw": None}
            continue

        res_idw = None
        comp    = None

        if coords_validas:
            try:
                res_idw = fill_idw(df_pivot, codigo, aux, coords, idw_exp, holdout_pct, rng_seed)
                comp    = comparar_metodos(res_reg, res_idw)
            except Exception as e:
                logger.warning(f"[{codigo}] IDW falhou: {e} — usando regressão")
                res_idw = None
                comp    = None

        if comp is not None:
            vencedor = comp["melhor_metodo"]
        else:
            vencedor = "regressao"

        # Aplica vencedor ao pivot
        if vencedor == "regressao":
            df_pivot[codigo] = res_reg["serie_preenchida"]
            mascara = res_reg["mascara_preenchidos"]
        else:
            df_pivot[codigo] = res_idw["serie_preenchida"]  # type: ignore[index]
            mascara = res_idw["mascara_preenchidos"]  # type: ignore[index]

        resultados[codigo] = {
            "vencedor": vencedor,
            "reg": res_reg,
            "idw": res_idw,
            "comp": comp,
            "mascara": mascara,
        }

    # Séries agregadas e histogramas
    logger.info("\n--- Construindo séries agregadas e histogramas ---")
    series_mensais:  dict[str, pd.DataFrame] = {}
    series_anuais:   dict[str, pd.DataFrame] = {}
    series_max:      dict[str, pd.DataFrame] = {}
    histogramas:     dict[str, dict]         = {}

    for codigo in codigos:
        res      = resultados[codigo]
        mascara  = res.get("mascara", pd.Series(False, index=df_pivot.index))
        vencedor = res.get("vencedor")

        df_d = pd.DataFrame({
            "estacao_codigo": codigo,
            "data":       df_pivot.index,
            "valor":      df_pivot[codigo].values,
            "preenchido": mascara.values if hasattr(mascara, "values") else False,
            "metodo":     vencedor,
            "consistencia": (
                series_diarias[codigo]
                .set_index("data")["consistencia"]
                .reindex(df_pivot.index)
                .values
            ),
        })

        series_mensais[codigo] = build_monthly(df_d, max_falhas_pct=max_falhas)
        series_anuais[codigo]  = build_annual(series_mensais[codigo], max_falhas_pct=max_falhas)
        series_max[codigo]     = build_max_daily_annual(df_d)

        s_diaria = pd.Series(df_pivot[codigo].values)
        s_mensal = pd.Series(
            series_mensais[codigo].loc[series_mensais[codigo]["valido"], "valor"].values
        )
        s_anual = pd.Series(
            series_anuais[codigo].loc[series_anuais[codigo]["valido"], "valor"].values
        )
        s_max_v = pd.Series(series_max[codigo]["valor"].values)

        histogramas[codigo] = {
            "diaria":           histograma_com_estatisticas(s_diaria, n_bins),
            "mensal":           histograma_com_estatisticas(s_mensal, n_bins),
            "anual":            histograma_com_estatisticas(s_anual, n_bins),
            "max_diaria_anual": histograma_com_estatisticas(s_max_v, n_bins),
        }

    # Carga no Supabase
    logger.info("\n--- Carregando no Supabase ---")

    for est in estacoes_cfg:
        codigo   = est["codigo"]
        res      = resultados[codigo]
        mascara  = res.get("mascara", pd.Series(False, index=df_pivot.index))
        vencedor = res.get("vencedor")

        logger.info(f"\n[{codigo}] Limpando dados anteriores...")
        limpar_estacao(client, codigo)

        df_orig      = series_diarias[codigo]
        n_total      = len(df_orig)
        n_com_dado   = int(df_orig["valor"].notna().sum())
        pct_orig     = round(100.0 * (1 - n_com_dado / n_total), 2) if n_total else 0.0

        n_preench = 0
        if res.get("reg") and vencedor:
            n_preench = res["reg"]["n_preenchidos"] if vencedor == "regressao" else res["idw"]["n_preenchidos"]
        pct_pos = round(100.0 * (1 - (n_com_dado + n_preench) / n_total), 2) if n_total else 0.0

        upsert_estacao(client, {
            "codigo":                      codigo,
            "nome":                        est.get("nome") or codigo,
            "lat":                         float(est["lat"]),
            "lon":                         float(est["lon"]),
            "altitude":                    est.get("altitude"),
            "is_referencia":               bool(est.get("is_referencia", False)),
            "anos_dados":                  len(series_anuais[codigo]),
            "n_dias_total":                n_total,
            "n_dias_com_dado":             n_com_dado,
            "pct_falhas_original":         pct_orig,
            "pct_falhas_pos_preenchimento": pct_pos,
            "data_inicio":                 df_orig["data"].min().date().isoformat(),
            "data_fim":                    df_orig["data"].max().date().isoformat(),
        })

        df_d_insert = pd.DataFrame({
            "data":       df_pivot.index,
            "valor":      df_pivot[codigo].values,
            "preenchido": mascara.values if hasattr(mascara, "values") else False,
            "metodo":     vencedor,
            "consistencia": (
                df_orig.set_index("data")["consistencia"]
                .reindex(df_pivot.index)
                .values
            ),
        })

        insert_serie_diaria(client, codigo, df_d_insert, batch_size)
        insert_serie_mensal(client, codigo, series_mensais[codigo], batch_size)
        insert_serie_anual(client, codigo, series_anuais[codigo], batch_size)
        insert_max_diaria_anual(client, codigo, series_max[codigo], batch_size)

        for tipo, dados in histogramas[codigo].items():
            insert_histograma(client, codigo, tipo, dados)

        if res.get("reg"):
            insert_preenchimento(
                client, codigo, "regressao", res["reg"],
                is_vencedor=(vencedor == "regressao"),
            )
        if res.get("idw"):
            insert_preenchimento(
                client, codigo, "idw", res["idw"],
                is_vencedor=(vencedor == "idw"),
            )

    # Sumário
    logger.info("\n" + "=" * 60)
    logger.info("SUMÁRIO FINAL")
    logger.info("=" * 60)
    for codigo in codigos:
        res = resultados[codigo]
        n_p = 0
        if res.get("vencedor") == "regressao" and res.get("reg"):
            n_p = res["reg"]["n_preenchidos"]
        elif res.get("vencedor") == "idw" and res.get("idw"):
            n_p = res["idw"]["n_preenchidos"]
        v = res.get("vencedor", "—")
        ref_mark = " [REF]" if codigo == codigo_ref else ""
        logger.info(f"  {codigo}{ref_mark}: método={v} | preenchidos={n_p} dias")
    logger.info("\nPipeline concluído.")


if __name__ == "__main__":
    main()
