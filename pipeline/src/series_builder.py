"""
Constrói as séries agregadas (mensal, anual, máxima diária anual) a partir
da série diária já processada.

Regras de validade:
  - Mês válido  : percentual de dias sem dado <= max_falhas_pct
  - Ano válido  : todos os meses válidos OU pct_falhas anual <= max_falhas_pct
                  (usa os dias originais + preenchidos como base de contagem)
"""

from __future__ import annotations

import calendar
import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _dias_no_mes(ano: int, mes: int) -> int:
    return calendar.monthrange(ano, mes)[1]


def build_monthly(
    df_diario: pd.DataFrame,
    max_falhas_pct: float = 5.0,
) -> pd.DataFrame:
    """
    Agrega série diária em totais mensais.

    Parameters
    ----------
    df_diario : DataFrame com colunas [estacao_codigo, data, valor, ...]
    max_falhas_pct : limite de % de falhas para marcar o mês como válido

    Returns
    -------
    DataFrame com colunas:
        estacao_codigo, ano, mes, valor, valido, pct_falhas
    """
    df = df_diario.copy()
    df["ano"] = df["data"].dt.year
    df["mes"] = df["data"].dt.month

    rows = []
    for (codigo, ano, mes), grp in df.groupby(["estacao_codigo", "ano", "mes"]):
        dias_esperados = _dias_no_mes(ano, mes)
        dias_com_dado = grp["valor"].notna().sum()
        dias_sem_dado = dias_esperados - dias_com_dado
        # Garante que dias ausentes no DataFrame (não só NaN) sejam contados
        dias_no_df = len(grp)
        dias_ausentes_do_df = max(0, dias_esperados - dias_no_df)
        total_falhas = grp["valor"].isna().sum() + dias_ausentes_do_df

        pct_falhas = 100.0 * total_falhas / dias_esperados
        total_mm = grp["valor"].sum(min_count=1)

        rows.append({
            "estacao_codigo": codigo,
            "ano": int(ano),
            "mes": int(mes),
            "valor": round(float(total_mm), 1) if not np.isnan(total_mm) else None,
            "valido": bool(pct_falhas <= max_falhas_pct),
            "pct_falhas": round(float(pct_falhas), 2),
        })

    df_mensal = pd.DataFrame(rows)
    logger.info(
        f"[build_monthly] {len(df_mensal)} linhas | "
        f"válidos: {df_mensal['valido'].sum()} | "
        f"inválidos: {(~df_mensal['valido']).sum()}"
    )
    return df_mensal


def build_annual(
    df_mensal: pd.DataFrame,
    max_falhas_pct: float = 5.0,
) -> pd.DataFrame:
    """
    Agrega série mensal em totais anuais.

    Um ano é válido se todos os 12 meses são válidos. Se algum mês estiver
    ausente (registros faltando na tabela mensal), o ano é inválido.

    Returns
    -------
    DataFrame com colunas: estacao_codigo, ano, valor, valido, pct_falhas
    """
    rows = []
    for (codigo, ano), grp in df_mensal.groupby(["estacao_codigo", "ano"]):
        meses_presentes = len(grp)
        meses_validos = grp["valido"].sum()
        meses_invalidos = meses_presentes - meses_validos
        meses_faltantes = 12 - meses_presentes

        # pct_falhas anual: média ponderada das falhas mensais + meses faltantes como 100%
        if meses_presentes > 0:
            soma_falhas = grp["pct_falhas"].sum() + meses_faltantes * 100.0
            pct_falhas = soma_falhas / 12.0
        else:
            pct_falhas = 100.0

        total_mm = grp.loc[grp["valido"], "valor"].sum(min_count=1)
        # Considera válido somente se todos os 12 meses válidos estão presentes
        valido = bool(meses_validos == 12 and meses_faltantes == 0)

        rows.append({
            "estacao_codigo": codigo,
            "ano": int(ano),
            "valor": round(float(total_mm), 1) if (not np.isnan(total_mm) and valido) else None,
            "valido": valido,
            "pct_falhas": round(float(pct_falhas), 2),
        })

    df_anual = pd.DataFrame(rows)
    logger.info(
        f"[build_annual] {len(df_anual)} linhas | "
        f"válidos: {df_anual['valido'].sum()} | "
        f"inválidos: {(~df_anual['valido']).sum()}"
    )
    return df_anual


def build_fluvio_mensal(
    df_diario: pd.DataFrame,
    valor_col: str = "vazao_m3s",
    max_falhas_pct: float = 5.0,
) -> pd.DataFrame:
    """Agrega vazão diária em estatísticas mensais (média, min, max).

    A diferença para `build_monthly` (precipitação) é que vazão é uma medida
    de fluxo instantânea — não se soma, agrega-se por média.

    Parameters
    ----------
    df_diario : DataFrame com colunas [estacao_codigo, data, vazao_m3s].
                Aceita `data` como `datetime` ou `date`.

    Returns
    -------
    DataFrame com colunas:
        estacao_codigo, ano, mes, vazao_media, vazao_min, vazao_max,
        valido, pct_falhas
    """
    df = df_diario.copy()
    data_dt = pd.to_datetime(df["data"], errors="coerce")
    df["ano"] = data_dt.dt.year
    df["mes"] = data_dt.dt.month

    rows = []
    for (codigo, ano, mes), grp in df.groupby(["estacao_codigo", "ano", "mes"]):
        dias_esperados = _dias_no_mes(int(ano), int(mes))
        valid_mask = grp[valor_col].notna()
        dias_com_dado = int(valid_mask.sum())
        dias_no_df = len(grp)
        dias_ausentes = max(0, dias_esperados - dias_no_df)
        total_falhas = (dias_esperados - dias_no_df) + (dias_no_df - dias_com_dado)
        pct_falhas = 100.0 * total_falhas / dias_esperados if dias_esperados else 100.0

        if dias_com_dado > 0:
            serie = grp.loc[valid_mask, valor_col]
            vmed = float(serie.mean())
            vmin = float(serie.min())
            vmax = float(serie.max())
        else:
            vmed = vmin = vmax = float("nan")

        rows.append({
            "estacao_codigo": codigo,
            "ano":  int(ano),
            "mes":  int(mes),
            "vazao_media": round(vmed, 3) if not np.isnan(vmed) else None,
            "vazao_min":   round(vmin, 3) if not np.isnan(vmin) else None,
            "vazao_max":   round(vmax, 3) if not np.isnan(vmax) else None,
            "valido": bool(pct_falhas <= max_falhas_pct and dias_com_dado > 0),
            "pct_falhas": round(float(pct_falhas), 2),
        })

    df_mensal = pd.DataFrame(rows)
    logger.info(
        f"[build_fluvio_mensal] {len(df_mensal)} linhas | "
        f"válidos: {df_mensal['valido'].sum()}"
    )
    return df_mensal


def build_fluvio_anual(
    df_mensal: pd.DataFrame,
    max_falhas_pct: float = 5.0,
) -> pd.DataFrame:
    """Agrega vazão mensal em estatísticas anuais.

    Returns
    -------
    DataFrame com colunas:
        estacao_codigo, ano, vazao_media, vazao_min, vazao_max,
        valido, pct_falhas
    """
    rows = []
    for (codigo, ano), grp in df_mensal.groupby(["estacao_codigo", "ano"]):
        meses_presentes = len(grp)
        meses_validos = int(grp["valido"].sum())
        meses_faltantes = 12 - meses_presentes
        if meses_presentes > 0:
            pct_falhas = (grp["pct_falhas"].sum() + meses_faltantes * 100.0) / 12.0
        else:
            pct_falhas = 100.0

        validos = grp[grp["valido"]]
        if not validos.empty:
            vmed = float(validos["vazao_media"].mean())
            vmin = float(validos["vazao_min"].min())
            vmax = float(validos["vazao_max"].max())
        else:
            vmed = vmin = vmax = float("nan")

        valido_ano = bool(meses_validos == 12 and meses_faltantes == 0)
        rows.append({
            "estacao_codigo": codigo,
            "ano": int(ano),
            "vazao_media": round(vmed, 3) if not np.isnan(vmed) and valido_ano else None,
            "vazao_min":   round(vmin, 3) if not np.isnan(vmin) and valido_ano else None,
            "vazao_max":   round(vmax, 3) if not np.isnan(vmax) and valido_ano else None,
            "valido": valido_ano,
            "pct_falhas": round(float(pct_falhas), 2),
        })

    df_anual = pd.DataFrame(rows)
    logger.info(
        f"[build_fluvio_anual] {len(df_anual)} linhas | "
        f"válidos: {df_anual['valido'].sum()}"
    )
    return df_anual


def build_max_daily_annual(df_diario: pd.DataFrame) -> pd.DataFrame:
    """
    Precipitação máxima diária de cada ano por estação.

    Returns
    -------
    DataFrame com colunas: estacao_codigo, ano, valor, data_ocorrencia
    """
    df = df_diario.copy()
    df["ano"] = df["data"].dt.year

    rows = []
    for (codigo, ano), grp in df.groupby(["estacao_codigo", "ano"]):
        grp_valid = grp.dropna(subset=["valor"])
        if grp_valid.empty:
            continue
        idx_max = grp_valid["valor"].idxmax()
        rows.append({
            "estacao_codigo": codigo,
            "ano": int(ano),
            "valor": round(float(grp_valid.loc[idx_max, "valor"]), 1),
            "data_ocorrencia": grp_valid.loc[idx_max, "data"].date().isoformat(),
        })

    df_max = pd.DataFrame(rows)
    logger.info(f"[build_max_daily_annual] {len(df_max)} linhas")
    return df_max
