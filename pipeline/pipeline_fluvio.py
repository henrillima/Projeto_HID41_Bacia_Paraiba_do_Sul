"""
Pipeline fluviométrico — Fase 1 do Projeto 2.

Sequência:
  1. Lê estação exutória de `config_estacoes_fluvio` no Supabase
     (preenchida via UI /selecao-fluvio) ou, em fallback, a top-1 do
     CSV gerado por `python download_fluvio.py discover`.
  2. Baixa via REST HidroWebService:
       - Série diária de vazão  (HidroSerieVazao)
       - Série diária de cotas  (HidroSerieCotas)
       - Medições de descarga   (HidroSerieResumoDescarga)
       - Curva oficial da ANA   (HidroSerieCurvaDescarga)
  3. Parseia (fluvio_parser) e consolida em série diária única.
  4. Ajusta a curva-chave (potência) com as medições.
  5. Onde a vazão for NaN mas houver cota: aplica a curva para preencher.
  6. Constrói séries mensal e anual de vazão (média/min/max).
  7. Carrega tudo no Supabase (idempotente).

Uso:
  cd pipeline
  python pipeline_fluvio.py
  python pipeline_fluvio.py --codigos 58183000        # override de exutório
  python pipeline_fluvio.py --no-rating               # pula ajuste de curva-chave
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from src.ana_client import HidroWebError, client_from_env  # noqa: E402
from src.eckhardt import (  # noqa: E402
    BFI_MAX_AQUIFERO_POROSO,
    bfi_global,
    estimar_constante_recessao,
    filtrar_eckhardt,
)
from src.event_isolation import (  # noqa: E402
    calcular_phi_index,
    identificar_eventos,
)
from src.design_storm import chuva_projeto_blocos_alternados  # noqa: E402
from src.flood_frequency import (  # noqa: E402
    ajustar_distribuicoes,
    quantis_tr,
    selecionar_melhor,
    serie_max_anual_q,
)
from src.idf import from_config as idf_from_config  # noqa: E402
from src.flow_duration import (  # noqa: E402
    curva_permanencia,
    estatisticas_curva,
    quantis_referencia,
)
from src.fluvio_parser import (  # noqa: E402
    consolidar_serie_diaria_fluvio,
    parse_curva_descarga,
    parse_medicoes_descarga,
    parse_serie_cotas,
    parse_serie_vazao,
)
from src.low_flow import calcular_q7_10  # noqa: E402
from src.rating_curve import ajustar_potencia, aplicar_curva  # noqa: E402
from src.scs_uh import (  # noqa: E402
    comparar_obs_vs_scs,
    huo_scs_triangular,
    tc_kirpich,
    tc_watt_chow,
)
from src.series_builder import build_fluvio_anual, build_fluvio_mensal  # noqa: E402
from src.supabase_loader import (  # noqa: E402
    get_client,
    insert_chuva_projeto,
    insert_comparacao_uh,
    insert_curva_chave_ajuste,
    insert_curva_chave_medicoes,
    insert_curva_permanencia,
    insert_eckhardt_params,
    insert_eckhardt_serie,
    insert_eventos,
    insert_fluvio_anual,
    insert_fluvio_diaria,
    insert_fluvio_mensal,
    insert_frequencia_ajustes,
    insert_frequencia_quantis,
    insert_huo_observado,
    insert_huo_scs,
    insert_idf_curva,
    insert_max_anual_vazao,
    insert_q7_10_ajuste,
    insert_q7_minimos,
    insert_quantis_permanencia,
    limpar_estacao_fluvio,
    upsert_estacao_fluvio,
    upsert_idf_parametros,
)
from src.unit_hydrograph import huo_medio, huo_observado  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline_fluvio")

ROOT = Path(__file__).parent
CONFIG_FILE = ROOT / "config.yaml"


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


def _est_do_csv(codigo: str) -> dict | None:
    """Monta o dict de estação a partir de data/fluvio_candidatas.csv (sem ANA)."""
    csv = ROOT / "data" / "fluvio_candidatas.csv"
    if not csv.exists():
        return None
    df = pd.read_csv(csv, dtype={"codigo": str})
    row = df[df["codigo"] == str(codigo)]
    if row.empty:
        return None
    r = row.iloc[0]
    def _f(col):
        return float(r[col]) if col in r and pd.notna(r.get(col)) else None
    return {
        "codigo": str(codigo),
        "nome": r.get("nome", codigo),
        "lat": _f("lat"),
        "lon": _f("lon"),
        "altitude": _f("altitude"),
        "area_drenagem_km2": _f("area_drenagem_km2"),
        "bacia_nome": r.get("bacia_nome", ""),
        "sub_bacia_pref": str(r.get("sub_bacia_pref", "")),
        "operadora": r.get("operadora", ""),
        "is_outlet": True,
    }


def _selecionar_exutorios(client, args_codigos: list[str] | None) -> list[dict]:
    """Determina quais estações fluviométricas processar.

    Prioridade:
      1. args_codigos (CLI)
      2. fluviometria.exutorio_codigo em config.yaml (exutório fixado do projeto)
      3. config_estacoes_fluvio com is_outlet=true (UI)
      4. top-1 de data/fluvio_candidatas.csv (descobrimento automático)
    """
    # (2) Exutório fixado em config.yaml — tem prioridade sobre UI/CSV top-1.
    cod_cfg = (_load_config().get("fluviometria", {}) or {}).get("exutorio_codigo")
    if not args_codigos and cod_cfg:
        est = _est_do_csv(str(cod_cfg))
        if est:
            logger.info(f"Exutório fixado por config.yaml: {cod_cfg} — {est.get('nome')}")
            return [est]
        logger.warning(
            f"exutorio_codigo={cod_cfg} não encontrado no candidatas.csv; "
            "tentando via --codigos/ANA."
        )
        args_codigos = [str(cod_cfg)]

    if args_codigos:
        # Busca metadados das estações no inventário
        out = []
        from src.ana_client import client_from_env as _cfe
        api = _cfe()
        for cod in args_codigos:
            inv = api.inventario(codigo_estacao=cod)
            if inv:
                e = inv[0]
                out.append({
                    "codigo": str(e.get("codigoestacao") or cod),
                    "nome": e.get("Estacao_Nome", ""),
                    "lat": float(e.get("Latitude") or 0) or None,
                    "lon": float(e.get("Longitude") or 0) or None,
                    "altitude": float(e.get("Altitude") or 0) or None,
                    "area_drenagem_km2": float(e.get("Area_Drenagem") or 0) or None,
                    "bacia_nome": e.get("Bacia_Nome", ""),
                    "codigo_bacia": e.get("codigobacia", ""),
                    "is_outlet": True,
                })
            else:
                out.append({"codigo": cod, "nome": cod, "is_outlet": True})
        return out

    # config_estacoes_fluvio
    try:
        rows = client.table("config_estacoes_fluvio").select("*").execute().data
        outlets = [r for r in rows if r.get("is_outlet")]
        if outlets:
            return outlets
    except Exception as exc:
        logger.warning(f"Falha ao ler config_estacoes_fluvio: {exc}")

    # Fallback: CSV
    csv = ROOT / "data" / "fluvio_candidatas.csv"
    if csv.exists():
        df = pd.read_csv(csv).head(1)
        if not df.empty:
            r = df.iloc[0]
            return [{
                "codigo": str(r["codigo"]),
                "nome": r.get("nome", ""),
                "lat": float(r["lat"]) if pd.notna(r.get("lat")) else None,
                "lon": float(r["lon"]) if pd.notna(r.get("lon")) else None,
                "area_drenagem_km2": float(r["area_drenagem_km2"])
                    if pd.notna(r.get("area_drenagem_km2")) else None,
                "bacia_nome": r.get("bacia_nome", ""),
                "is_outlet": True,
            }]
    return []


def processar_estacao(
    client_supa,
    client_ana,
    est: dict,
    *,
    ini: str,
    fim: str,
    ajustar_curva_chave: bool = True,
    max_falhas_pct: float = 5.0,
) -> None:
    codigo = str(est["codigo"])
    logger.info("=" * 70)
    logger.info(f"Estação fluviométrica {codigo} — {est.get('nome', '?')}")
    logger.info(f"Período: {ini} → {fim}")
    logger.info("=" * 70)

    # 1) Baixar e parsear
    try:
        df_v = parse_serie_vazao(client_ana.serie_vazao(codigo, ini, fim))
    except HidroWebError as exc:
        logger.error(f"  serie_vazao falhou: {exc}")
        df_v = parse_serie_vazao([])

    try:
        df_c = parse_serie_cotas(client_ana.serie_cotas(codigo, ini, fim))
    except HidroWebError as exc:
        logger.warning(f"  serie_cotas falhou: {exc}")
        df_c = parse_serie_cotas([])

    try:
        df_m = parse_medicoes_descarga(client_ana.medicoes_descarga(codigo, ini, fim))
    except HidroWebError as exc:
        logger.warning(f"  medicoes_descarga falhou: {exc}")
        df_m = parse_medicoes_descarga([])

    try:
        df_curva_ana = parse_curva_descarga(client_ana.curva_descarga(codigo, ini, fim))
    except HidroWebError as exc:
        logger.warning(f"  curva_descarga ANA falhou: {exc}")
        df_curva_ana = pd.DataFrame()

    logger.info(
        f"  vazão: {len(df_v):>6d} dias | "
        f"cotas: {len(df_c):>6d} dias | "
        f"medições: {len(df_m):>4d} | "
        f"curvas ANA: {len(df_curva_ana):>3d}"
    )

    # 2) Consolida série diária
    df_diaria = consolidar_serie_diaria_fluvio(df_v, df_c)
    if df_diaria.empty:
        logger.warning("  série diária vazia — abortando.")
        return

    # 3) Ajuste da curva-chave (potência)
    ajuste = None
    if ajustar_curva_chave and not df_m.empty:
        cfg = _load_config().get("fluviometria", {}).get("rating_curve", {})
        try:
            ajuste = ajustar_potencia(
                df_m,
                cota_col="cota_m",
                vazao_col="vazao_m3s",
                h0_step_cm=float(cfg.get("h0_step_cm", 5)),
                h0_min_cm=float(cfg.get("h0_min_cm", 0)),
                min_pontos=int(cfg.get("min_pontos_ajuste", 6)),
            )
            logger.info(
                f"  curva-chave: a={ajuste['a']:.4f}  b={ajuste['b']:.3f}  "
                f"h0={ajuste['h0']:.2f} m | R²={ajuste['r2']:.4f}  "
                f"RMSE={ajuste['rmse']:.2f}  KS p={ajuste['ks_pvalue']:.3f}"
            )
        except ValueError as exc:
            logger.warning(f"  ajuste de curva-chave falhou: {exc}")

        # Preenche vazão onde tem cota mas vazão está NaN
        if ajuste is not None:
            mask = df_diaria["vazao_m3s"].isna() & df_diaria["cota_cm"].notna()
            if mask.any():
                cotas_m = df_diaria.loc[mask, "cota_cm"].astype(float) / 100.0
                q_preenchido = aplicar_curva(cotas_m, ajuste)
                df_diaria.loc[mask, "vazao_m3s"] = q_preenchido.values
                df_diaria.loc[mask, "preenchido"] = True
                df_diaria.loc[mask, "metodo"] = "curva_chave"
                n_preenchidos = int(mask.sum()) - int(q_preenchido.isna().sum())
                logger.info(
                    f"  curva-chave aplicada a {n_preenchidos} dias "
                    f"({int(mask.sum())} candidatos)."
                )

    # Garante colunas preenchido/metodo
    if "preenchido" not in df_diaria.columns:
        df_diaria["preenchido"] = False
    if "metodo" not in df_diaria.columns:
        df_diaria["metodo"] = None
    df_diaria.loc[
        df_diaria["preenchido"].isna() | (df_diaria["preenchido"] == False),  # noqa: E712
        "metodo",
    ] = df_diaria.loc[
        df_diaria["preenchido"].isna() | (df_diaria["preenchido"] == False),  # noqa: E712
        "metodo",
    ].fillna("observado")

    # 4) Séries mensal e anual
    df_d_para_agg = df_diaria.copy()
    df_d_para_agg["data"] = pd.to_datetime(df_d_para_agg["data"], errors="coerce")
    df_mensal = build_fluvio_mensal(
        df_d_para_agg.assign(estacao_codigo=codigo),
        valor_col="vazao_m3s",
        max_falhas_pct=max_falhas_pct,
    )
    df_anual = build_fluvio_anual(df_mensal, max_falhas_pct=max_falhas_pct)

    # 5) Métricas globais
    n_total = len(df_diaria)
    n_com_vazao = int(df_diaria["vazao_m3s"].notna().sum())
    pct_falhas = 100.0 * (1 - n_com_vazao / n_total) if n_total else 100.0
    dmin = pd.to_datetime(df_diaria["data"]).min()
    dmax = pd.to_datetime(df_diaria["data"]).max()

    # 6) Persistência no Supabase
    logger.info("  → gravando no Supabase…")
    limpar_estacao_fluvio(client_supa, codigo)
    upsert_estacao_fluvio(client_supa, {
        "codigo":           codigo,
        "nome":             est.get("nome", codigo),
        "lat":              est.get("lat"),
        "lon":              est.get("lon"),
        "altitude":         est.get("altitude"),
        "area_drenagem_km2": est.get("area_drenagem_km2"),
        "bacia_nome":       est.get("bacia_nome", ""),
        "codigo_bacia":     str(est.get("codigo_bacia", "")),
        "sub_bacia_pref":   codigo[:2],
        "operadora":        est.get("operadora", ""),
        "operando":         bool(est.get("operando", True)),
        "is_outlet":        bool(est.get("is_outlet", True)),
        "anos_dados":       round((dmax - dmin).days / 365.25, 2) if not pd.isna(dmin) and not pd.isna(dmax) else None,
        "n_dias_total":     n_total,
        "n_dias_com_vazao": n_com_vazao,
        "pct_falhas_vazao": round(pct_falhas, 2),
        "data_inicio":      dmin.date().isoformat() if not pd.isna(dmin) else None,
        "data_fim":         dmax.date().isoformat() if not pd.isna(dmax) else None,
    })

    df_diaria_db = df_diaria.copy()
    df_diaria_db["data"] = pd.to_datetime(df_diaria_db["data"]).dt.date
    insert_fluvio_diaria(client_supa, codigo, df_diaria_db)
    insert_fluvio_mensal(client_supa, codigo, df_mensal)
    insert_fluvio_anual(client_supa, codigo, df_anual)

    if not df_m.empty:
        insert_curva_chave_medicoes(client_supa, codigo, df_m)

    if ajuste is not None:
        insert_curva_chave_ajuste(client_supa, codigo, ajuste, versao=1)

    # =====================================================================
    # FASE 2 — Regime de vazões
    # =====================================================================
    _processar_regime(client_supa, codigo, df_diaria_db, max_falhas_pct=max_falhas_pct)

    # =====================================================================
    # FASE 3 — Eventos e Hidrogramas Unitários
    # =====================================================================
    _processar_eventos(client_supa, codigo, df_diaria_db, est=est)

    # =====================================================================
    # FASE 4 — Análise de frequência, IDF, chuva de projeto
    # =====================================================================
    _processar_extremos(client_supa, codigo, df_diaria_db)

    logger.info(
        f"  Estação {codigo} concluída — "
        f"{n_total} dias diários, {n_com_vazao} com vazão "
        f"({pct_falhas:.1f}% falhas)."
    )


def _processar_regime(
    client_supa,
    codigo: str,
    df_diaria: pd.DataFrame,
    *,
    max_falhas_pct: float,
) -> None:
    """Computa e grava: curva de permanência, Eckhardt, Q7,10."""
    s = df_diaria.set_index(pd.to_datetime(df_diaria["data"]))["vazao_m3s"]

    # ----- Curva de permanência + quantis de referência -----
    logger.info("  → curva de permanência …")
    curva = curva_permanencia(s)
    insert_curva_permanencia(client_supa, codigo, curva)
    quantis = quantis_referencia(s)
    estats = estatisticas_curva(curva)
    insert_quantis_permanencia(client_supa, codigo, quantis, estatisticas_curva=estats)

    # ----- Filtro de Eckhardt -----
    logger.info("  → filtro de Eckhardt …")
    cfg = _load_config().get("regime", {}).get("eckhardt", {})
    # Passa a chuva da bacia para restringir as janelas de recessão a trechos
    # realmente sem chuva (depleção de aquífero), evitando contar quedas de
    # vazão pós-pico como recessão (ver docs/REVISAO_METODOLOGICA.md M8).
    serie_chuva = _carregar_chuva_media_bacia(client_supa)
    serie_chuva = serie_chuva if not serie_chuva.empty else None
    rec = estimar_constante_recessao(s, serie_chuva)
    alpha = rec.get("a") if rec.get("a") and not pd.isna(rec.get("a")) else float(cfg.get("alpha_default", 0.98))
    bfi_max = float(cfg.get("bfi_max_default", BFI_MAX_AQUIFERO_POROSO))

    df_eck = filtrar_eckhardt(s, alpha=alpha, bfi_max=bfi_max)
    insert_eckhardt_serie(client_supa, codigo, df_eck)
    insert_eckhardt_params(client_supa, codigo, {
        "alpha": alpha,
        "k_dias": rec.get("k"),
        "bfi_max": bfi_max,
        "bfi_global": bfi_global(df_eck),
        "metodo_estimacao": "regressao_log_recessoes" if rec.get("k") else "default",
        "n_janelas_recessao": rec.get("n_janelas"),
        "k_min": rec.get("k_min"),
        "k_max": rec.get("k_max"),
    })

    # ----- Q7,10 (Log-Pearson III) -----
    logger.info("  → Q7,10 (Log-Pearson III) …")
    try:
        ano_inicio_mes = int(
            _load_config().get("regime", {}).get("q7_10", {}).get("ano_hidrologico_inicio_mes", 10)
        )
        q7_10 = calcular_q7_10(s, ano_hidrologico_inicio_mes=ano_inicio_mes)
        insert_q7_minimos(client_supa, codigo, q7_10["minimos_anuais"])
        insert_q7_10_ajuste(client_supa, codigo, q7_10["ajuste"])
    except ValueError as exc:
        logger.warning(f"  Q7,10 falhou: {exc}")


def _processar_eventos(
    client_supa,
    codigo: str,
    df_diaria: pd.DataFrame,
    *,
    est: dict,
) -> None:
    """Identifica eventos chuva-vazão, monta HU observado, HU SCS e comparação."""
    cfg = _load_config()
    bacia_cfg = cfg.get("bacia", {})
    ev_cfg = cfg.get("eventos", {})

    area_km2 = bacia_cfg.get("area_km2") or est.get("area_drenagem_km2")
    if not area_km2:
        logger.warning(
            "  → Fase 3 ignorada: bacia.area_km2 não configurado. "
            "Preencha em config.yaml ou execute a delineação para o exutório."
        )
        return

    logger.info("  → Fase 3: isolamento de eventos chuva-vazão …")

    # Chuva média da bacia: média simples das pluviometrias do projeto.
    serie_chuva = _carregar_chuva_media_bacia(client_supa)
    if serie_chuva.empty:
        logger.warning(
            "  → Sem dados pluviométricos em precipitacao_diaria — "
            "rode `python pipeline.py --via rest` antes de pipeline_fluvio."
        )
        return

    eventos = identificar_eventos(
        df_diaria[["data", "vazao_m3s"]],
        serie_chuva,
        area_km2=float(area_km2),
        distancia_min_picos_dias=int(ev_cfg.get("distancia_min_picos_dias", 5)),
        p_min_evento_mm=float(ev_cfg.get("p_min_evento_mm", 20.0)),
        duracao_max_dias=ev_cfg.get("duracao_max_dias"),
        quantil_pico=float(ev_cfg.get("prominencia_pico_quantil", 0.95)),
    )

    # Phi-index por evento (precisa do lamina_mm já calculado)
    for ev in eventos:
        ev.phi_index_mm_dia = calcular_phi_index(ev)
        # Chuva efetiva = lâmina escoada direta. Por construção do φ-index,
        # Σ max(Pᵢ − φ, 0) = lamina_mm; logo a chuva efetiva É a lâmina.
        # (Recalcular como P_total − φ·n subtrairia φ até de dias de chuva
        #  baixa, subestimando a chuva efetiva — ver docs/REVISAO_METODOLOGICA.md B1.)
        ev.p_efetiva_mm = float(ev.lamina_mm)

    evento_ids = insert_eventos(client_supa, codigo, eventos)

    # HU observado por evento + médio
    huos: list[dict] = []
    for ev, ev_id in zip(eventos, evento_ids):
        try:
            uh = huo_observado(ev)
            insert_huo_observado(client_supa, codigo, uh, evento_id=ev_id, area_km2=area_km2)
            huos.append(uh)
        except ValueError as exc:
            logger.warning(f"  HU evento #{ev.id} falhou: {exc}")

    if huos:
        uh_medio = huo_medio(huos)
        insert_huo_observado(client_supa, codigo, uh_medio, evento_id=None, area_km2=area_km2)

    # HU SCS — depende de parâmetros físicos
    L = bacia_cfg.get("comprimento_talvegue_km")
    dh = bacia_cfg.get("delta_h_m")
    S = bacia_cfg.get("declividade_media")
    metodo_tc = (bacia_cfg.get("tc_metodo") or "watt_chow").lower()

    if L and (dh or S):
        try:
            if S is None and dh is not None and L:
                S = dh / (L * 1000.0)
            tc = (
                tc_watt_chow(L_km=L, S=S)
                if metodo_tc == "watt_chow"
                else tc_kirpich(L_km=L, delta_h_m=dh)
            )
            scs = huo_scs_triangular(
                area_km2=area_km2,
                tc_min=tc,
                dt_min=float(ev_cfg.get("huo_scs", {}).get("dt_min", 60)),
            )
            insert_huo_scs(
                client_supa, codigo, scs,
                metodo=metodo_tc,
                parametros={"L_km": L, "delta_h_m": dh, "S": S, "cn_amc2": bacia_cfg.get("cn_amc2")},
            )

            # Comparação: HU médio observado × HU SCS
            if huos:
                comp = comparar_obs_vs_scs(uh_medio, scs)
                insert_comparacao_uh(client_supa, codigo, comp, escopo="medio")
        except Exception as exc:
            logger.warning(f"  HU SCS falhou: {exc}")
    else:
        logger.info(
            "  HU SCS não calculado: faltam parâmetros físicos da bacia "
            "(L, Δh ou S em config.yaml → bacia)."
        )


def _processar_extremos(client_supa, codigo: str, df_diaria: pd.DataFrame) -> None:
    """Fase 4: máximas anuais → distribuições → quantis TR → IDF → chuva de projeto."""
    cfg = _load_config()
    freq_cfg = cfg.get("frequencia", {})
    idf_cfg = cfg.get("idf", {})
    chuva_cfg = cfg.get("chuva_projeto", {})

    df_max = serie_max_anual_q(df_diaria, valor_col="vazao_m3s", data_col="data")
    if len(df_max) < 5:
        logger.warning("  Fase 4 ignorada — < 5 anos de máximas.")
        return
    insert_max_anual_vazao(client_supa, codigo, df_max)

    # Ajustes das distribuições
    valores = df_max["q_max_m3s"].astype(float).tolist()
    try:
        ajustes = ajustar_distribuicoes(
            valores,
            distribuicoes=freq_cfg.get("distribuicoes",
                                        ["gumbel", "gev", "lognormal", "p3", "lp3"]),
        )
    except ValueError as exc:
        logger.warning(f"  Fase 4 abortada: {exc}")
        return

    melhor = selecionar_melhor(ajustes, criterio=freq_cfg.get("criterio_selecao", "aic"))
    rec_nome = melhor["nome"] if melhor else None
    insert_frequencia_ajustes(client_supa, codigo, ajustes, distribuicao_recomendada=rec_nome)

    # Quantis para distribuição recomendada (com bootstrap)
    if melhor:
        df_q = quantis_tr(
            melhor,
            trs=freq_cfg.get("trs", [2, 5, 10, 25, 50, 100, 500, 1000]),
            n_bootstrap=int(freq_cfg.get("bootstrap_n", 1000)),
            ic_nivel=float(freq_cfg.get("ic_nivel", 0.90)),
            x_obs=valores,
        )
        insert_frequencia_quantis(client_supa, codigo, melhor["nome"], df_q)

    # IDF
    idf = idf_from_config(idf_cfg)
    regiao = idf_cfg.get("regiao", "sjc-paraiba-do-sul")
    upsert_idf_parametros(
        client_supa, regiao,
        parametros={"a": idf.a, "b": idf.b, "c": idf.c, "d": idf.d},
        equacao=idf_cfg.get("equacao", "pfafstetter"),
        fonte=idf.fonte,
    )
    duracoes = idf_cfg.get("duracoes_min", [5, 10, 15, 30, 60, 120, 360, 720, 1440])
    trs_idf = freq_cfg.get("trs", [2, 5, 10, 25, 50, 100])
    df_idf = idf.gerar_curva(trs=list(trs_idf), duracoes_min=list(duracoes))
    insert_idf_curva(client_supa, regiao, df_idf)

    # Chuva de projeto: TR 10 e TR 100, padrão intermediário
    trs_projeto = chuva_cfg.get("trs_projeto", [10, 100])
    duracao_total = float(chuva_cfg.get("duracao_total_min", 360))
    dt_min = float(chuva_cfg.get("dt_min", 10))
    padrao = chuva_cfg.get("padrao", "intermediario")
    n_blocos = max(2, int(round(duracao_total / dt_min)))
    for tr in trs_projeto:
        df_hp = chuva_projeto_blocos_alternados(
            idf=idf,
            tr_anos=int(tr),
            duracao_total_min=duracao_total,
            n_blocos=n_blocos,
            padrao=padrao,
        )
        hietograma = df_hp.to_dict(orient="records")
        insert_chuva_projeto(
            client_supa, regiao,
            tr=int(tr),
            duracao_total_min=duracao_total,
            n_blocos=n_blocos,
            dt_min=dt_min,
            padrao=padrao,
            hietograma=hietograma,
        )
    logger.info(
        f"  Fase 4 concluída: recomendada={rec_nome}, "
        f"IDF region='{regiao}', chuvas TR={list(trs_projeto)}."
    )


def _carregar_chuva_media_bacia(client_supa) -> pd.Series:
    """Carrega a chuva diária média da bacia para a Fase 3 (chuva-vazão).

    Prioriza os pluviômetros marcados ativos em `config_pluviometros_p2`
    (escolhidos próximos da bacia do Projeto 2 via /selecao-pluvio-p2).
    Se a tabela estiver vazia, faz fallback para o comportamento antigo
    (média de TODAS as estações em `precipitacao_diaria`) — útil em ambientes
    onde os pluviômetros P2 ainda não foram configurados.
    """
    try:
        cfg_rows = (
            client_supa.table("config_pluviometros_p2")
            .select("codigo")
            .eq("ativo", True)
            .execute()
            .data
        )
    except Exception as exc:
        logger.warning(
            f"config_pluviometros_p2 indisponível ({exc}); usando todas "
            f"as estações pluvio (FALLBACK)."
        )
        cfg_rows = []

    codigos_p2 = [str(r["codigo"]) for r in cfg_rows if r.get("codigo")]
    if codigos_p2:
        logger.info(
            f"Chuva média da bacia P2 com {len(codigos_p2)} estação(ões): {codigos_p2}"
        )
        rows = (
            client_supa.table("precipitacao_diaria")
            .select("data, valor, estacao_codigo")
            .in_("estacao_codigo", codigos_p2)
            .execute()
            .data
        )
    else:
        logger.warning(
            "config_pluviometros_p2 vazio — usando média de TODAS as estações "
            "em precipitacao_diaria (FALLBACK; chuva pode não representar a bacia)."
        )
        rows = (
            client_supa.table("precipitacao_diaria")
            .select("data, valor, estacao_codigo")
            .execute()
            .data
        )

    if not rows:
        return pd.Series(dtype=float)
    df = pd.DataFrame(rows)
    df["data"] = pd.to_datetime(df["data"])
    media = df.groupby("data")["valor"].mean()
    return media.sort_index()


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--codigos", nargs="*", default=None,
                    help="Override: códigos de exutório a processar.")
    ap.add_argument("--no-rating", action="store_true",
                    help="Pula o ajuste da curva-chave (útil em debug).")
    args = ap.parse_args(argv)

    load_dotenv(ROOT / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes em .env")
        sys.exit(1)

    client_supa = get_client(url, key)
    client_ana = client_from_env()

    cfg = _load_config()
    fluvio_cfg = cfg.get("fluviometria", {})
    ini = fluvio_cfg.get("data_inicio", "1970-01-01")
    fim = fluvio_cfg.get("data_fim", "2025-12-31")
    max_falhas = float(cfg.get("processamento", {}).get("max_falhas_pct", 5.0))

    estacoes = _selecionar_exutorios(client_supa, args.codigos)
    if not estacoes:
        logger.error(
            "Nenhuma estação exutória selecionada. "
            "Rode `python download_fluvio.py discover` ou passe --codigos."
        )
        sys.exit(1)

    for est in estacoes:
        try:
            processar_estacao(
                client_supa, client_ana, est,
                ini=ini, fim=fim,
                ajustar_curva_chave=not args.no_rating,
                max_falhas_pct=max_falhas,
            )
        except Exception as exc:
            logger.exception(f"Falha ao processar {est.get('codigo')}: {exc}")

    logger.info("Pipeline fluviométrico concluído.")


if __name__ == "__main__":
    main()
