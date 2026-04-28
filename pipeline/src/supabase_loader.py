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
