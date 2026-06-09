"""
Carrega os dados processados no Supabase via service_role key.
Todas as operações são idempotentes (upsert ou delete+insert).
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any

import numpy as np
import pandas as pd
from supabase import Client, create_client

logger = logging.getLogger(__name__)


def get_client(url: str, service_key: str) -> Client:
    return create_client(url, service_key)


def _nan_to_none(v: Any) -> Any:
    """Converte NaN/inf para None (JSON não suporta NaN)."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _clip_numeric(v: Any, max_abs: float = 1e8) -> Any:
    """Clipa valores numéricos absurdos para None (ex.: Q(TR) bootstrap explodindo
    extrapolação ou IC superior infinito).

    Limite default 10^8 m³/s — bem acima do Amazonas (~2,2 × 10^5).
    """
    v = _nan_to_none(v)
    if v is None:
        return None
    try:
        if abs(float(v)) >= max_abs:
            return None
    except (TypeError, ValueError):
        return None
    return v


def _sanitize_record(record: dict) -> dict:
    return {k: _nan_to_none(v) for k, v in record.items()}


def _batch_insert(
    client: Client,
    table: str,
    records: list[dict],
    batch_size: int = 500,
    upsert: bool = False,
) -> int:
    """Insere registros em batches. Retorna total inserido."""
    if not records:
        return 0

    total = 0
    for i in range(0, len(records), batch_size):
        chunk = [_sanitize_record(r) for r in records[i : i + batch_size]]
        for tentativa in range(4):
            try:
                if upsert:
                    client.table(table).upsert(chunk).execute()
                else:
                    client.table(table).insert(chunk).execute()
                break
            except Exception as exc:
                if tentativa == 3:
                    raise
                wait = 2 ** tentativa
                logger.warning(f"  [{table}] batch {i // batch_size + 1} falhou ({exc}); retry em {wait}s")
                time.sleep(wait)
        total += len(chunk)
        logger.debug(f"  [{table}] inserido batch {i // batch_size + 1} ({len(chunk)} registros)")
    return total


def limpar_estacao(client: Client, codigo: str) -> None:
    """Remove a estação e todos os dados relacionados (cascade)."""
    client.table("estacoes").delete().eq("codigo", codigo).execute()
    logger.info(f"[limpar] Estação {codigo} removida (cascade).")


def upsert_estacao(client: Client, dados: dict) -> None:
    client.table("estacoes").upsert(_sanitize_record(dados)).execute()
    logger.info(f"[upsert_estacao] {dados.get('codigo')} — {dados.get('nome')}")


def insert_serie_diaria(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """
    df deve ter colunas: data, valor, preenchido, metodo, consistencia
    data pode ser datetime ou date — será convertida para string ISO.
    """
    records = []
    for _, row in df.iterrows():
        data = row["data"]
        if hasattr(data, "isoformat"):
            data = data.isoformat()
        else:
            data = str(data)[:10]  # garante formato YYYY-MM-DD
        records.append({
            "estacao_codigo": codigo,
            "data": data,
            "valor": _nan_to_none(row.get("valor")),
            "preenchido": bool(row.get("preenchido", False)),
            "metodo": row.get("metodo") or None,
            "consistencia": int(row["consistencia"]) if pd.notna(row.get("consistencia")) else None,
        })
    n = _batch_insert(client, "precipitacao_diaria", records, batch_size, upsert=True)
    logger.info(f"[serie_diaria] {codigo}: {n} registros inseridos")
    return n


def insert_serie_mensal(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    records = [
        {
            "estacao_codigo": codigo,
            "ano": int(row["ano"]),
            "mes": int(row["mes"]),
            "valor": _nan_to_none(row.get("valor")),
            "valido": bool(row.get("valido", False)),
            "pct_falhas": _nan_to_none(row.get("pct_falhas")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "precipitacao_mensal", records, batch_size, upsert=True)
    logger.info(f"[serie_mensal] {codigo}: {n} registros inseridos")
    return n


def insert_serie_anual(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    records = [
        {
            "estacao_codigo": codigo,
            "ano": int(row["ano"]),
            "valor": _nan_to_none(row.get("valor")),
            "valido": bool(row.get("valido", False)),
            "pct_falhas": _nan_to_none(row.get("pct_falhas")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "precipitacao_anual", records, batch_size, upsert=True)
    logger.info(f"[serie_anual] {codigo}: {n} registros inseridos")
    return n


def insert_max_diaria_anual(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    records = [
        {
            "estacao_codigo": codigo,
            "ano": int(row["ano"]),
            "valor": _nan_to_none(row.get("valor")),
            "data_ocorrencia": row.get("data_ocorrencia"),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "max_diaria_anual", records, batch_size, upsert=True)
    logger.info(f"[max_diaria_anual] {codigo}: {n} registros inseridos")
    return n


def insert_histograma(
    client: Client,
    codigo: str,
    tipo: str,
    dados: dict,
) -> None:
    client.table("histogramas").upsert({
        "estacao_codigo": codigo,
        "tipo": tipo,
        "dados": dados,
    }).execute()
    logger.info(f"[histograma] {codigo}/{tipo}: inserido")


def insert_estacoes_sem_dados(client: Client, registros: list[dict]) -> int:
    """
    registros: lista de {'codigo': str, 'nome_arquivo': str, 'motivo': str}
    Usa upsert para idempotência.
    """
    if not registros:
        return 0
    sanitized = [_sanitize_record(r) for r in registros]
    client.table("estacoes_sem_dados").upsert(sanitized).execute()
    logger.info(f"[sem_dados] {len(sanitized)} estações registradas")
    return len(sanitized)


def insert_preenchimento_diario(
    client: Client,
    codigo: str,
    mascara: "pd.Series",
    serie_reg: "pd.Series",
    serie_idw: "pd.Series | None",
    batch_size: int = 500,
) -> int:
    """
    Insere valores diários por método para os dias de falha.
    mascara: Series booleana; True nos dias que algum método preencheu.
    serie_reg / serie_idw: séries completas; apenas dias da máscara são inseridos.
    """
    dias = mascara[mascara].index
    if len(dias) == 0:
        return 0

    records = []
    for data in dias:
        data_str = data.isoformat() if hasattr(data, "isoformat") else str(data)[:10]
        v_reg = serie_reg.loc[data] if data in serie_reg.index else None
        v_idw = serie_idw.loc[data] if (serie_idw is not None and data in serie_idw.index) else None
        records.append({
            "estacao_codigo":  codigo,
            "data":            data_str,
            "valor_regressao": _nan_to_none(float(v_reg)) if v_reg is not None and pd.notna(v_reg) else None,
            "valor_idw":       _nan_to_none(float(v_idw)) if v_idw is not None and pd.notna(v_idw) else None,
        })

    n = _batch_insert(client, "preenchimento_diario", records, batch_size, upsert=True)
    logger.info(f"[preenchimento_diario] {codigo}: {n} dias inseridos")
    return n


# ===========================================================================
# Fluviometria — Projeto 2 / Fase 1
# ===========================================================================

def upsert_estacao_fluvio(client: Client, dados: dict) -> None:
    """Upsert idempotente em `estacoes_fluvio`."""
    client.table("estacoes_fluvio").upsert(_sanitize_record(dados)).execute()
    logger.info(f"[upsert_estacao_fluvio] {dados.get('codigo')} — {dados.get('nome')}")


def limpar_estacao_fluvio(client: Client, codigo: str) -> None:
    """Remove a estação fluviométrica e todos os dados relacionados (cascade)."""
    client.table("estacoes_fluvio").delete().eq("codigo", codigo).execute()
    logger.info(f"[limpar_estacao_fluvio] {codigo} removida (cascade).")


def insert_fluvio_diaria(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """df deve ter colunas: data, vazao_m3s, cota_cm, consistencia,
    status_vazao, status_cota, preenchido (opt), metodo (opt)."""
    # Salvaguarda: garante unicidade (estacao_codigo, data). Prefere linhas
    # com vazão observada sobre as que têm só cota.
    df = df.copy()
    df["_tem_vazao"] = df["vazao_m3s"].notna().astype(int) if "vazao_m3s" in df.columns else 0
    df = (
        df.sort_values(["data", "_tem_vazao"], ascending=[True, False])
          .drop_duplicates(subset=["data"], keep="first")
          .drop(columns=["_tem_vazao"])
    )
    records = []
    for _, row in df.iterrows():
        data = row["data"]
        if hasattr(data, "isoformat"):
            data = data.isoformat()
        else:
            data = str(data)[:10]
        records.append({
            "estacao_codigo": codigo,
            "data": data,
            "vazao_m3s": _nan_to_none(row.get("vazao_m3s")),
            "cota_cm": _nan_to_none(row.get("cota_cm")),
            "consistencia": int(row["consistencia"]) if pd.notna(row.get("consistencia")) else None,
            "status_vazao": int(row["status_vazao"]) if pd.notna(row.get("status_vazao")) else None,
            "status_cota":  int(row["status_cota"])  if pd.notna(row.get("status_cota"))  else None,
            "preenchido": bool(row.get("preenchido", False)),
            "metodo": row.get("metodo") or None,
        })
    n = _batch_insert(client, "fluviometria_diaria", records, batch_size, upsert=True)
    logger.info(f"[fluvio_diaria] {codigo}: {n} registros")
    return n


def insert_fluvio_mensal(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """df deve ter colunas: ano, mes, vazao_media, vazao_min, vazao_max,
    valido, pct_falhas."""
    records = [
        {
            "estacao_codigo": codigo,
            "ano":  int(row["ano"]),
            "mes":  int(row["mes"]),
            "vazao_media": _nan_to_none(row.get("vazao_media")),
            "vazao_min":   _nan_to_none(row.get("vazao_min")),
            "vazao_max":   _nan_to_none(row.get("vazao_max")),
            "valido":      bool(row.get("valido", False)),
            "pct_falhas":  _nan_to_none(row.get("pct_falhas")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "fluviometria_mensal", records, batch_size, upsert=True)
    logger.info(f"[fluvio_mensal] {codigo}: {n} registros")
    return n


def insert_fluvio_anual(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    records = [
        {
            "estacao_codigo": codigo,
            "ano":  int(row["ano"]),
            "vazao_media": _nan_to_none(row.get("vazao_media")),
            "vazao_min":   _nan_to_none(row.get("vazao_min")),
            "vazao_max":   _nan_to_none(row.get("vazao_max")),
            "valido":      bool(row.get("valido", False)),
            "pct_falhas":  _nan_to_none(row.get("pct_falhas")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "fluviometria_anual", records, batch_size, upsert=True)
    logger.info(f"[fluvio_anual] {codigo}: {n} registros")
    return n


def insert_curva_chave_medicoes(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """df: saída de fluvio_parser.parse_medicoes_descarga()."""
    if df.empty:
        return 0
    # Idempotência: delete e reinsere (sem PK natural além de id).
    client.table("curva_chave_medicoes").delete().eq("estacao_codigo", codigo).execute()
    records = []
    for _, row in df.iterrows():
        dm = row["data_medicao"]
        if hasattr(dm, "isoformat"):
            dm = dm.isoformat()
        records.append({
            "estacao_codigo": codigo,
            "data_medicao": dm,
            "cota_m":          _nan_to_none(row.get("cota_m")),
            "vazao_m3s":       _nan_to_none(row.get("vazao_m3s")),
            "area_molhada_m2": _nan_to_none(row.get("area_molhada_m2")),
            "vel_media_ms":    _nan_to_none(row.get("vel_media_ms")),
            "largura_m":       _nan_to_none(row.get("largura_m")),
            "profundidade_m":  _nan_to_none(row.get("profundidade_m")),
            "consistencia":    int(row["consistencia"]) if pd.notna(row.get("consistencia")) else None,
        })
    n = _batch_insert(client, "curva_chave_medicoes", records, batch_size, upsert=False)
    logger.info(f"[medicoes] {codigo}: {n} medições")
    return n


def insert_curva_chave_ajuste(
    client: Client,
    codigo: str,
    ajuste: dict,
    *,
    versao: int = 1,
    forma: str = "potencia",
    intervalo_validade: dict | None = None,
    vigente: bool = True,
) -> None:
    """Insere um ajuste de curva-chave em `curva_chave_ajuste`.

    `ajuste` deve ter as chaves devolvidas por rating_curve.ajustar_potencia()
    (a, b, h0, r2, rmse, mae, ks_pvalue, n_pontos, h_min, h_max).
    """
    parametros = {
        "a":     _nan_to_none(ajuste.get("a")),
        "b":     _nan_to_none(ajuste.get("b")),
        "h0":    _nan_to_none(ajuste.get("h0")),
        "h_min": _nan_to_none(ajuste.get("h_min")),
        "h_max": _nan_to_none(ajuste.get("h_max")),
    }
    if "pontos" in ajuste:
        parametros["pontos"] = ajuste["pontos"]
    client.table("curva_chave_ajuste").upsert({
        "estacao_codigo": codigo,
        "versao": versao,
        "forma": forma,
        "parametros": parametros,
        "r2":        _nan_to_none(ajuste.get("r2")),
        "rmse":      _nan_to_none(ajuste.get("rmse")),
        "mae":       _nan_to_none(ajuste.get("mae")),
        "ks_pvalue": _nan_to_none(ajuste.get("ks_pvalue")),
        "n_pontos":  ajuste.get("n_pontos"),
        "intervalo_validade": intervalo_validade,
        "vigente":   vigente,
    }).execute()
    logger.info(
        f"[curva_chave] {codigo} v{versao} {forma} | "
        f"R²={ajuste.get('r2'):.4f} | RMSE={ajuste.get('rmse'):.3f} | "
        f"n={ajuste.get('n_pontos')}"
    )


def insert_candidatas_fluvio(
    client: Client,
    df: pd.DataFrame,
) -> int:
    """Persiste o ranking em `estacoes_candidatas_fluvio` (upsert por código)."""
    if df.empty:
        return 0
    records = []
    for _, row in df.iterrows():
        records.append(_sanitize_record({
            "codigo":             str(row["codigo"]),
            "nome":               row.get("nome"),
            "lat":                _nan_to_none(row.get("lat")),
            "lon":                _nan_to_none(row.get("lon")),
            "area_drenagem_km2":  _nan_to_none(row.get("area_drenagem_km2")),
            "anos_dados":         _nan_to_none(row.get("anos_dados")),
            "data_inicio":        row.get("data_inicio"),
            "data_fim":           row.get("data_fim"),
            "operando":           bool(row.get("operando", False)),
            "operadora":          row.get("operadora"),
            "bacia_nome":         row.get("bacia_nome"),
            "sub_bacia_pref":     row.get("sub_bacia_pref"),
            "dist_min_km":        _nan_to_none(row.get("dist_min_km")),
            "dist_centroide_km":  _nan_to_none(row.get("dist_centroide_km")),
            "score_anos":         _nan_to_none(row.get("score_anos")),
            "score_falhas":       _nan_to_none(row.get("score_falhas")),
            "score_proximidade":  _nan_to_none(row.get("score_proximidade")),
            "score":              _nan_to_none(row.get("score")),
        }))
    n = _batch_insert(client, "estacoes_candidatas_fluvio", records, 500, upsert=True)
    logger.info(f"[candidatas_fluvio] {n} registros")
    return n


# ===========================================================================
# Fase 2 — Regime de vazões (curva permanência + Eckhardt + Q7,10)
# ===========================================================================

def insert_curva_permanencia(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """df com colunas percentil, vazao_m3s."""
    if df.empty:
        return 0
    client.table("curva_permanencia").delete().eq("estacao_codigo", codigo).execute()
    records = [
        {
            "estacao_codigo": codigo,
            "percentil": float(row["percentil"]),
            "vazao_m3s": _nan_to_none(row.get("vazao_m3s")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "curva_permanencia", records, batch_size, upsert=False)
    logger.info(f"[curva_permanencia] {codigo}: {n} pontos")
    return n


def insert_quantis_permanencia(
    client: Client,
    codigo: str,
    quantis: dict,
    *,
    estatisticas_curva: dict | None = None,
) -> None:
    """quantis = {'Q5': ..., 'Q10': ..., ..., 'Q95': ...}"""
    estats = estatisticas_curva or {}
    payload = {
        "estacao_codigo": codigo,
        "q1":  _nan_to_none(quantis.get("Q1")),
        "q5":  _nan_to_none(quantis.get("Q5")),
        "q10": _nan_to_none(quantis.get("Q10")),
        "q25": _nan_to_none(quantis.get("Q25")),
        "q50": _nan_to_none(quantis.get("Q50")),
        "q75": _nan_to_none(quantis.get("Q75")),
        "q90": _nan_to_none(quantis.get("Q90")),
        "q95": _nan_to_none(quantis.get("Q95")),
        "q99": _nan_to_none(quantis.get("Q99")),
        "declividade_log": _nan_to_none(estats.get("declividade_log")),
        "razao_q10_q90":   _nan_to_none(estats.get("razao_Q10_Q90")),
    }
    client.table("quantis_permanencia").upsert(payload).execute()
    logger.info(f"[quantis] {codigo}: Q90={payload['q90']} Q50={payload['q50']} Q10={payload['q10']}")


def insert_eckhardt_serie(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """df indexado por data, com q_total, q_base, q_direto, bfi_diario."""
    df = df.copy()
    df["data"] = pd.to_datetime(df.index).date
    df = df.reset_index(drop=True)
    client.table("eckhardt_serie").delete().eq("estacao_codigo", codigo).execute()
    records = [
        {
            "estacao_codigo": codigo,
            "data": row["data"].isoformat() if hasattr(row["data"], "isoformat") else str(row["data"]),
            "q_total":    _nan_to_none(row.get("q_total")),
            "q_base":     _nan_to_none(row.get("q_base")),
            "q_direto":   _nan_to_none(row.get("q_direto")),
            "bfi_diario": _nan_to_none(row.get("bfi_diario")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "eckhardt_serie", records, batch_size, upsert=False)
    logger.info(f"[eckhardt_serie] {codigo}: {n} dias")
    return n


def insert_eckhardt_params(client: Client, codigo: str, params: dict) -> None:
    payload = {
        "estacao_codigo":     codigo,
        "alpha":              _nan_to_none(params.get("alpha")),
        "k_dias":             _nan_to_none(params.get("k_dias")),
        "bfi_max":            _nan_to_none(params.get("bfi_max")),
        "bfi_global":         _nan_to_none(params.get("bfi_global")),
        "metodo_estimacao":   params.get("metodo_estimacao"),
        "n_janelas_recessao": params.get("n_janelas_recessao"),
        "k_min":              _nan_to_none(params.get("k_min")),
        "k_max":              _nan_to_none(params.get("k_max")),
    }
    client.table("eckhardt_params").upsert(payload).execute()
    logger.info(
        f"[eckhardt_params] {codigo}: α={payload['alpha']:.4f} | "
        f"BFI={payload['bfi_global']:.3f} | BFI_max={payload['bfi_max']}"
    )


def insert_q7_minimos(
    client: Client,
    codigo: str,
    df: pd.DataFrame,
) -> int:
    """df com ano_hidrologico, q7_m3s, data_ocorrencia."""
    if df.empty:
        return 0
    client.table("q7_minimos_anuais").delete().eq("estacao_codigo", codigo).execute()
    records = [
        {
            "estacao_codigo": codigo,
            "ano_hidrologico": int(row["ano_hidrologico"]),
            "q7_m3s": _nan_to_none(row.get("q7_m3s")),
            "data_ocorrencia": row.get("data_ocorrencia"),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "q7_minimos_anuais", records, 500, upsert=False)
    logger.info(f"[q7_minimos] {codigo}: {n} anos")
    return n


def insert_q7_10_ajuste(client: Client, codigo: str, ajuste: dict) -> None:
    payload = {
        "estacao_codigo": codigo,
        "distribuicao":   ajuste.get("distribuicao"),
        "parametros":     ajuste.get("parametros"),
        "q7_10_m3s":      _nan_to_none(ajuste.get("q_estimado") or ajuste.get("q7_10_m3s")),
        "ks_pvalue":      _nan_to_none(ajuste.get("ks_pvalue")),
        "n_anos":         ajuste.get("n"),
        "tr_anos":        _nan_to_none(ajuste.get("tr_anos")),
    }
    client.table("q7_10_ajuste").upsert(payload).execute()
    logger.info(
        f"[q7_10] {codigo}: Q7,10 = {payload['q7_10_m3s']} m³/s "
        f"(KS p={payload['ks_pvalue']})"
    )


# ===========================================================================
# Fase 3 — Eventos & Hidrogramas Unitários
# ===========================================================================

def insert_eventos(
    client: Client,
    codigo: str,
    eventos: list,
) -> list[int]:
    """Insere eventos isolados; retorna a lista de IDs (gerados pelo banco)."""
    if not eventos:
        return []
    # idempotência: apaga eventos anteriores da estação antes de reinserir
    client.table("eventos_chuva_vazao").delete().eq("estacao_codigo", codigo).execute()
    out_ids: list[int] = []
    for ev in eventos:
        record = _sanitize_record({
            "estacao_codigo": codigo,
            "t_inicio": ev.t_inicio.date().isoformat() if hasattr(ev.t_inicio, "date") else str(ev.t_inicio)[:10],
            "t_pico":   ev.t_pico.date().isoformat() if hasattr(ev.t_pico, "date") else str(ev.t_pico)[:10],
            "t_fim":    ev.t_fim.date().isoformat() if hasattr(ev.t_fim, "date") else str(ev.t_fim)[:10],
            "duracao_dias":      ev.duracao_dias,
            "p_total_mm":        ev.p_total_mm,
            "p_efetiva_mm":      ev.p_efetiva_mm,
            "q_pico_m3s":        ev.q_pico_m3s,
            "q_base_inicio_m3s": ev.q_base_inicio_m3s,
            "q_base_fim_m3s":    ev.q_base_fim_m3s,
            "volume_direto_m3":  ev.volume_direto_m3,
            "lamina_mm":         ev.lamina_mm,
            "phi_index_mm_dia":  getattr(ev, "phi_index_mm_dia", None),
            "hietograma":        ev.hietograma,
            "hidrograma":        ev.hidrograma,
        })
        resp = client.table("eventos_chuva_vazao").insert(record).execute()
        new_id = (resp.data or [{}])[0].get("id")
        if new_id is not None:
            out_ids.append(int(new_id))
    logger.info(f"[eventos] {codigo}: {len(out_ids)} eventos inseridos")
    return out_ids


def insert_huo_observado(
    client: Client,
    codigo: str,
    huo: dict,
    *,
    evento_id: int | None = None,
    area_km2: float | None = None,
) -> None:
    payload = _sanitize_record({
        "estacao_codigo": codigo,
        "evento_id": evento_id,
        "dt_dias": huo.get("dt_dias", 1),
        "ordenadas_m3s_per_mm": huo.get("ordenadas_m3s_per_mm"),
        "lamina_mm": huo.get("lamina_mm"),
        "q_pico_uh": huo.get("q_pico_uh"),
        "t_pico_idx": huo.get("t_pico_idx"),
        "base_time_dias": huo.get("base_time_dias"),
        "area_km2": area_km2,
        "n_eventos": huo.get("n_eventos"),
        "desvio_ordenadas": huo.get("desvio_ordenadas"),
    })
    # Idempotência: delete-then-insert (unicidade lógica via índice COALESCE
    # não é exposta ao upsert do Supabase).
    q = client.table("hidrograma_unitario_observado") \
        .delete().eq("estacao_codigo", codigo)
    if evento_id is None:
        q = q.is_("evento_id", "null")
    else:
        q = q.eq("evento_id", evento_id)
    q.execute()
    client.table("hidrograma_unitario_observado").insert(payload).execute()


def insert_huo_scs(client: Client, codigo: str, huo: dict, *, metodo: str, parametros: dict) -> None:
    payload = _sanitize_record({
        "estacao_codigo": codigo,
        "area_km2":       huo.get("area_km2"),
        "tc_min":         huo.get("tc_min"),
        "tc_metodo":      metodo,
        "duracao_efetiva_min": huo.get("duracao_efetiva_min"),
        "dt_min":         huo.get("dt_min"),
        "tp_h":           huo.get("tp_h"),
        "t_pico_h":       huo.get("t_pico_h"),
        "tb_h":           huo.get("tb_h"),
        "qp_m3s_per_mm":  huo.get("qp_m3s_per_mm"),
        "ordenadas_m3s_per_mm": huo.get("ordenadas_m3s_per_mm"),
        "tempos_h":       huo.get("tempos_h"),
        "parametros":     parametros,
    })
    client.table("hidrograma_unitario_scs").upsert(payload).execute()
    logger.info(
        f"[huo_scs] {codigo}: Tp={payload['t_pico_h']:.2f} h | "
        f"Qp={payload['qp_m3s_per_mm']:.2f} m³/s/mm"
    )


def insert_comparacao_uh(
    client: Client,
    codigo: str,
    comp: dict,
    *,
    escopo: str,            # "evento" | "medio"
    evento_id: int | None = None,
) -> None:
    payload = _sanitize_record({
        "estacao_codigo": codigo,
        "evento_id": evento_id,
        "escopo": escopo,
        "nse":            comp.get("nse"),
        "erro_pico_pct":  comp.get("erro_pico_pct"),
        "erro_tpico_h":   comp.get("erro_tpico_h"),
        "qp_obs":         comp.get("qp_obs"),
        "qp_scs":         comp.get("qp_scs"),
    })
    q = client.table("comparacao_uh") \
        .delete().eq("estacao_codigo", codigo).eq("escopo", escopo)
    if evento_id is None:
        q = q.is_("evento_id", "null")
    else:
        q = q.eq("evento_id", evento_id)
    q.execute()
    client.table("comparacao_uh").insert(payload).execute()


# ===========================================================================
# Fase 4 — Frequência de Cheias, IDF, Chuva de Projeto
# ===========================================================================

def insert_max_anual_vazao(client: Client, codigo: str, df: pd.DataFrame) -> int:
    """df com colunas ano, q_max_m3s, data_ocorrencia."""
    if df.empty:
        return 0
    client.table("max_anual_vazao").delete().eq("estacao_codigo", codigo).execute()
    records = [
        {
            "estacao_codigo": codigo,
            "ano": int(row["ano"]),
            "q_max_m3s": _nan_to_none(row.get("q_max_m3s")),
            "data_ocorrencia": row.get("data_ocorrencia"),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "max_anual_vazao", records, 500, upsert=False)
    logger.info(f"[max_anual_q] {codigo}: {n} anos")
    return n


def insert_frequencia_ajustes(
    client: Client,
    codigo: str,
    ajustes: list[dict],
    *,
    distribuicao_recomendada: str | None = None,
) -> None:
    """Persiste todos os ajustes; marca `recomendado=true` no escolhido."""
    if not ajustes:
        return
    client.table("frequencia_ajuste").delete().eq("estacao_codigo", codigo).execute()
    rows = []
    for a in ajustes:
        rows.append(_sanitize_record({
            "estacao_codigo": codigo,
            "distribuicao":   a.get("nome"),
            "parametros":     a.get("params"),
            "aic":            _nan_to_none(a.get("aic")),
            "bic":            _nan_to_none(a.get("bic")),
            "log_lik":        _nan_to_none(a.get("log_lik")),
            "ks_stat":        _nan_to_none(a.get("ks_stat")),
            "ks_pvalue":      _nan_to_none(a.get("ks_pvalue")),
            "n_amostras":     a.get("n"),
            "recomendado":    a.get("nome") == distribuicao_recomendada,
        }))
    _batch_insert(client, "frequencia_ajuste", rows, 100, upsert=False)
    logger.info(f"[freq_ajuste] {codigo}: {len(rows)} distribuições (rec.={distribuicao_recomendada})")


def insert_frequencia_quantis(client: Client, codigo: str, distribuicao: str, df: pd.DataFrame) -> int:
    """df com colunas tr, q_tr_m3s, ic_lo, ic_hi."""
    if df.empty:
        return 0
    client.table("frequencia_quantis").delete().eq("estacao_codigo", codigo).eq("distribuicao", distribuicao).execute()
    # q_tr_m3s e IC clipados em 10^8 m³/s para evitar overflow do numeric(12,3)
    records = [
        {
            "estacao_codigo": codigo,
            "distribuicao":   distribuicao,
            "tr": int(row["tr"]),
            "q_tr_m3s": _clip_numeric(row.get("q_tr_m3s")),
            "ic_lo":   _clip_numeric(row.get("ic_lo")),
            "ic_hi":   _clip_numeric(row.get("ic_hi")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "frequencia_quantis", records, 100, upsert=False)
    logger.info(f"[freq_quantis] {codigo}/{distribuicao}: {n} TRs")
    return n


def upsert_idf_parametros(
    client: Client,
    regiao: str,
    parametros: dict,
    *,
    equacao: str = "pfafstetter",
    fonte: str | None = None,
) -> None:
    client.table("idf_parametros").upsert(_sanitize_record({
        "regiao": regiao,
        "equacao": equacao,
        "parametros": parametros,
        "fonte": fonte,
    })).execute()


def insert_idf_curva(client: Client, regiao: str, df: pd.DataFrame) -> int:
    """df com colunas tr, duracao_min, intensidade_mm_h."""
    if df.empty:
        return 0
    client.table("idf_curva").delete().eq("regiao", regiao).execute()
    records = [
        {
            "regiao": regiao,
            "tr": int(row["tr"]),
            "duracao_min": float(row["duracao_min"]),
            "intensidade_mm_h": _nan_to_none(row.get("intensidade_mm_h")),
        }
        for _, row in df.iterrows()
    ]
    n = _batch_insert(client, "idf_curva", records, 500, upsert=False)
    logger.info(f"[idf_curva] {regiao}: {n} pontos")
    return n


def insert_chuva_projeto(
    client: Client,
    regiao: str,
    *,
    tr: int,
    duracao_total_min: float,
    n_blocos: int,
    dt_min: float,
    padrao: str,
    hietograma: list[dict],
) -> None:
    # idempotência: por (regiao, tr, padrão)
    client.table("chuva_projeto") \
        .delete() \
        .eq("regiao", regiao).eq("tr", tr).eq("padrao", padrao).execute()
    client.table("chuva_projeto").insert(_sanitize_record({
        "regiao": regiao,
        "tr": int(tr),
        "duracao_total_min": float(duracao_total_min),
        "n_blocos": int(n_blocos),
        "dt_min": float(dt_min),
        "padrao": padrao,
        "hietograma": hietograma,
    })).execute()


def insert_preenchimento(
    client: Client,
    estacao_ref: str,
    metodo: str,
    resultado: dict,
    is_vencedor: bool,
) -> None:
    # Monta parametros sem as Series (não serializáveis)
    parametros: dict[str, Any] = {}
    if metodo == "regressao":
        parametros = {
            "equacao":       resultado.get("equacao"),
            "coeficientes":  resultado.get("coeficientes"),
            "intercepto":    resultado.get("intercepto"),
            "r2_treino":     resultado.get("r2_treino"),
        }
    elif metodo == "idw":
        parametros = {
            "distancias_km": resultado.get("distancias_km"),
            "expoente":      resultado.get("expoente"),
        }

    r2 = resultado.get("r2_treino") if metodo == "regressao" else None

    client.table("preenchimento_resultado").insert({
        "estacao_referencia": estacao_ref,
        "metodo": metodo,
        "parametros": parametros,
        "n_dias_preenchidos": resultado.get("n_preenchidos"),
        "rmse_holdout": _nan_to_none(resultado.get("rmse_holdout")),
        "r2": _nan_to_none(r2),
        "is_vencedor": is_vencedor,
    }).execute()
    logger.info(
        f"[preenchimento] {metodo} | RMSE={resultado.get('rmse_holdout'):.4f} | "
        f"vencedor={is_vencedor}"
    )


# ===========================================================================
# Pluviometria — Projeto 2 (chuva-vazão)
# ===========================================================================

def upsert_estacao_pluvio_p2(client: Client, dados: dict) -> None:
    """Upsert idempotente em `estacoes` marcando a linha como Projeto 2.

    Garante que `projeto = 'P2'` é gravado mesmo se o caller esquecer.
    Estações P2 não aparecem em /estacoes nem /dashboard (a view
    `resumo_estacoes` filtra por `projeto = 'P1'`).
    """
    payload = dict(dados)
    payload["projeto"] = "P2"
    client.table("estacoes").upsert(_sanitize_record(payload)).execute()
    logger.info(f"[upsert_estacao_p2] {payload.get('codigo')} - {payload.get('nome')}")


def insert_candidatas_pluvio_p2(
    client: Client,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """Persiste o ranking de pluviômetros candidatos em
    `estacoes_candidatas_pluvio_p2` (idempotente via upsert)."""
    if df.empty:
        return 0
    cols = [
        "codigo", "nome", "lat", "lon", "altitude",
        "anos_dados", "data_inicio", "data_fim",
        "operando", "operadora", "bacia_nome", "sub_bacia_pref",
        "dist_exutorio_km", "dist_centroide_bacia_km",
        "score_anos", "score_falhas", "score_proximidade", "score",
    ]
    records = []
    for _, row in df.iterrows():
        rec: dict[str, Any] = {}
        for c in cols:
            if c not in df.columns:
                continue
            v = row.get(c)
            if isinstance(v, bool):
                rec[c] = bool(v)
            elif isinstance(v, (int, np.integer)):
                rec[c] = int(v)
            elif isinstance(v, (float, np.floating)):
                rec[c] = _nan_to_none(float(v))
            else:
                rec[c] = None if (v is None or (isinstance(v, float) and pd.isna(v))) else str(v)
        records.append(rec)
    n = _batch_insert(client, "estacoes_candidatas_pluvio_p2", records, batch_size, upsert=True)
    logger.info(f"[candidatas_pluvio_p2] {n} registros")
    return n
