"""
Parsers para as respostas JSON da API REST HidroWebService (séries
fluviométricas).

Convenções da ANA observadas empiricamente:

  - Séries de vazão e cotas: cada item retornado representa **um mês**;
    valores diários ficam em colunas `Vazao_01..Vazao_31` e
    `Cota_01..Cota_31` (strings, vírgula decimal já convertida para ponto).
    Status diário em `Vazao_NN_Status` / `Cota_NN_Status` (0=ok, 1=suspeito,
    2=ruim).
  - `Nivel_Consistencia`: "1" = bruto, "2" = consistido. Quando o mesmo
    mês aparece com ambos os níveis, mantém-se o consistido (2).
  - Medições de descarga: cada item é uma medição pontual com cota e
    vazão simultaneamente medidas; colunas têm unidades no próprio nome:
    `Cota (cm)`, `Vazao (m3/s)`, `Area_Molhada (m2)`, `Vel_Media (m/s)`,
    `Largura (m)`, `Profundidade (m)`, `Data_Hora_Dado`.
  - Curva de descarga: parâmetros (a, b, h₀) das curvas vigentes ajustadas
    pela ANA, mais faixa de validade.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _to_float(value: Any) -> float:
    """Converte string da API em float; None/'' viram NaN.

    A API às vezes retorna strings com vírgula como separador decimal
    (`"123,45"`), às vezes com ponto (`"123.45"`).
    """
    if value is None:
        return float("nan")
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return float("nan")
    s = s.replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return float("nan")
    return v


def _melt_daily_columns(
    items: list[dict],
    *,
    prefix: str,
    valor_col: str,
) -> pd.DataFrame:
    """Transforma items mensais (com `{prefix}_01..{prefix}_31`) em série diária.

    Parameters
    ----------
    items
        Lista de dicts retornada pelo endpoint (cada item = um mês).
    prefix
        "Vazao", "Cota" ou "Chuva".
    valor_col
        Nome da coluna numérica de saída (ex.: "vazao_m3s", "cota_cm").

    Returns
    -------
    DataFrame com colunas: estacao_codigo, data, {valor_col}, status,
                           consistencia, ultima_alteracao.
    """
    if not items:
        return pd.DataFrame(
            columns=[
                "estacao_codigo",
                "data",
                valor_col,
                "status",
                "consistencia",
                "ultima_alteracao",
            ]
        )

    df = pd.DataFrame(items)

    obrigatorias = {"Data_Hora_Dado", "codigoestacao"}
    faltantes = obrigatorias - set(df.columns)
    if faltantes:
        raise ValueError(
            f"Resposta sem colunas obrigatórias ({faltantes}); "
            f"keys disponíveis: {list(df.columns)[:20]}"
        )

    # Data do início do mês — trunca para primeiro dia do mês (ignora hora/min/seg)
    # para deduplicar registros com Data_Hora_Dado em horários diferentes mas
    # mesmo ano+mes.
    raw_dt = pd.to_datetime(df["Data_Hora_Dado"], errors="coerce")
    df["_mes_inicio"] = raw_dt.values.astype("datetime64[M]").astype("datetime64[ns]")
    df["_mes_inicio"] = pd.to_datetime(df["_mes_inicio"])
    # Nivel_Consistencia é opcional na resposta — default = 1 (bruto)
    if "Nivel_Consistencia" in df.columns:
        df["_consistencia"] = pd.to_numeric(df["Nivel_Consistencia"], errors="coerce").fillna(1).astype(int)
    else:
        df["_consistencia"] = 1
    df = df.dropna(subset=["_mes_inicio"]).copy()

    # Deduplica mês: mesma estacao+mes; prioriza maior Nivel_Consistencia
    df = (
        df.sort_values(["codigoestacao", "_mes_inicio", "_consistencia"])
          .groupby(["codigoestacao", "_mes_inicio"], as_index=False)
          .last()
    )

    # Colunas de dia presentes
    day_cols = [f"{prefix}_{i:02d}" for i in range(1, 32)]
    status_cols = [f"{prefix}_{i:02d}_Status" for i in range(1, 32)]
    day_cols_present = [c for c in day_cols if c in df.columns]
    if not day_cols_present:
        raise ValueError(
            f"Resposta sem colunas {prefix}_NN; encontradas: {list(df.columns)[:20]}"
        )

    # Mantém só o necessário
    keep = ["codigoestacao", "_mes_inicio", "_consistencia", "Data_Ultima_Alteracao"]
    keep_existing = [c for c in keep if c in df.columns]
    df_small = df[keep_existing + day_cols_present + [c for c in status_cols if c in df.columns]].copy()

    # Melt valores diários
    long_val = df_small.melt(
        id_vars=keep_existing,
        value_vars=day_cols_present,
        var_name="dia_col",
        value_name="valor_str",
    )
    long_val["dia"] = long_val["dia_col"].str.extract(r"(\d{1,2})$").astype(int)

    # Constrói data; pd.to_datetime com errors='coerce' descarta dias inválidos (31/02 etc.)
    long_val["data"] = pd.to_datetime(
        dict(
            year=long_val["_mes_inicio"].dt.year,
            month=long_val["_mes_inicio"].dt.month,
            day=long_val["dia"],
        ),
        errors="coerce",
    )
    long_val = long_val.dropna(subset=["data"]).copy()
    long_val[valor_col] = long_val["valor_str"].apply(_to_float)

    # Melt status (mesma chave)
    status_cols_present = [c for c in status_cols if c in df_small.columns]
    if status_cols_present:
        long_st = df_small.melt(
            id_vars=keep_existing,
            value_vars=status_cols_present,
            var_name="dia_col",
            value_name="status_str",
        )
        long_st["dia"] = long_st["dia_col"].str.extract(r"_(\d{1,2})_Status$").astype(int)
        long_st["status"] = pd.to_numeric(long_st["status_str"], errors="coerce")
        merged = long_val.merge(
            long_st[keep_existing + ["dia", "status"]],
            on=keep_existing + ["dia"],
            how="left",
        )
    else:
        merged = long_val
        merged["status"] = np.nan

    # Saída
    out = pd.DataFrame({
        "estacao_codigo": merged["codigoestacao"].astype(str).str.strip(),
        "data": merged["data"].dt.date,
        valor_col: merged[valor_col],
        "status": merged["status"],
        "consistencia": merged["_consistencia"],
        "ultima_alteracao": pd.to_datetime(
            merged.get("Data_Ultima_Alteracao"), errors="coerce"
        ).dt.date if "Data_Ultima_Alteracao" in merged.columns else pd.NaT,
    })

    out = out.sort_values(["estacao_codigo", "data"]).reset_index(drop=True)

    # Valores negativos espúrios viram NaN
    out.loc[out[valor_col] < 0, valor_col] = np.nan

    return out


# ---------------------------------------------------------------------------
# Parsers públicos por endpoint
# ---------------------------------------------------------------------------

def parse_serie_vazao(items: list[dict]) -> pd.DataFrame:
    """Resposta de `/HidroSerieVazao/v1` → DataFrame diário.

    Colunas de saída: estacao_codigo, data (date), vazao_m3s (float),
                      status (int), consistencia (int), ultima_alteracao (date).
    """
    return _melt_daily_columns(items, prefix="Vazao", valor_col="vazao_m3s")


def parse_serie_cotas(items: list[dict]) -> pd.DataFrame:
    """Resposta de `/HidroSerieCotas/v1` → DataFrame diário.

    Colunas: estacao_codigo, data, cota_cm, status, consistencia, ultima_alteracao.
    """
    return _melt_daily_columns(items, prefix="Cota", valor_col="cota_cm")


def parse_serie_chuva(items: list[dict]) -> pd.DataFrame:
    """Resposta de `/HidroSerieChuva/v1` → DataFrame diário.

    Colunas: estacao_codigo, data, chuva_mm, status, consistencia, ultima_alteracao.
    """
    return _melt_daily_columns(items, prefix="Chuva", valor_col="chuva_mm")


def parse_medicoes_descarga(items: list[dict]) -> pd.DataFrame:
    """Resposta de `/HidroSerieResumoDescarga/v1` → DataFrame de medições pontuais.

    Cada linha é uma medição com cota e vazão simultâneas — base para o
    ajuste da curva-chave.

    Colunas de saída: estacao_codigo, data_medicao (datetime),
                      cota_m (float), vazao_m3s (float),
                      area_molhada_m2, vel_media_ms, largura_m, profundidade_m,
                      consistencia.
    """
    if not items:
        return pd.DataFrame(
            columns=[
                "estacao_codigo",
                "data_medicao",
                "cota_m",
                "vazao_m3s",
                "area_molhada_m2",
                "vel_media_ms",
                "largura_m",
                "profundidade_m",
                "consistencia",
            ]
        )

    df = pd.DataFrame(items)
    cota_cm = df.get("Cota (cm)").apply(_to_float) if "Cota (cm)" in df.columns else float("nan")
    cota_m = cota_cm / 100.0 if isinstance(cota_cm, pd.Series) else float("nan")

    out = pd.DataFrame({
        "estacao_codigo": df.get("codigoestacao", pd.Series(dtype=str)).astype(str).str.strip(),
        "data_medicao": pd.to_datetime(df.get("Data_Hora_Dado"), errors="coerce"),
        "cota_m": cota_m,
        "vazao_m3s": df.get("Vazao (m3/s)", pd.Series(dtype=str)).apply(_to_float),
        "area_molhada_m2": df.get("Area_Molhada (m2)", pd.Series(dtype=str)).apply(_to_float),
        "vel_media_ms": df.get("Vel_Media (m/s)", pd.Series(dtype=str)).apply(_to_float),
        "largura_m": df.get("Largura (m)", pd.Series(dtype=str)).apply(_to_float),
        "profundidade_m": df.get("Profundidade (m)", pd.Series(dtype=str)).apply(_to_float),
        "consistencia": pd.to_numeric(
            df.get("Nivel_Consistencia"), errors="coerce"
        ).fillna(1).astype(int),
    })
    out = out.dropna(subset=["data_medicao"]).sort_values("data_medicao").reset_index(drop=True)
    return out


def parse_curva_descarga(items: list[dict]) -> pd.DataFrame:
    """Resposta de `/HidroSerieCurvaDescarga/v1` → DataFrame de curvas ANA vigentes.

    Schema varia entre estações; preservamos as colunas brutas e adicionamos
    versões normalizadas das mais úteis (a, b, h0, periodo, vigente).
    """
    if not items:
        return pd.DataFrame()
    df = pd.DataFrame(items)
    # Normaliza colunas numéricas comuns se presentes
    for col in df.columns:
        sample = df[col].dropna().head(5).astype(str)
        if not len(sample):
            continue
        if sample.str.match(r"^-?\d+([.,]\d+)?$").all():
            df[col] = df[col].apply(_to_float)
    return df


def consolidar_serie_diaria_fluvio(
    df_vazao: pd.DataFrame,
    df_cotas: pd.DataFrame,
) -> pd.DataFrame:
    """Funde vazão e cotas no mesmo eixo de datas.

    Returns
    -------
    DataFrame com colunas: estacao_codigo, data, vazao_m3s, cota_cm,
    consistencia, status_vazao, status_cota.
    """
    if df_vazao.empty and df_cotas.empty:
        return pd.DataFrame(
            columns=[
                "estacao_codigo",
                "data",
                "vazao_m3s",
                "cota_cm",
                "consistencia",
                "status_vazao",
                "status_cota",
            ]
        )

    keys = ["estacao_codigo", "data"]
    a = df_vazao[keys + ["vazao_m3s", "consistencia", "status"]].rename(
        columns={"status": "status_vazao"}
    ) if not df_vazao.empty else pd.DataFrame(columns=keys)
    b = df_cotas[keys + ["cota_cm", "status"]].rename(
        columns={"status": "status_cota"}
    ) if not df_cotas.empty else pd.DataFrame(columns=keys)

    if a.empty:
        merged = b.copy()
        merged["vazao_m3s"] = np.nan
        merged["status_vazao"] = np.nan
        merged["consistencia"] = np.nan
    elif b.empty:
        merged = a.copy()
        merged["cota_cm"] = np.nan
        merged["status_cota"] = np.nan
    else:
        merged = a.merge(b, on=keys, how="outer")

    cols_order = [
        "estacao_codigo",
        "data",
        "vazao_m3s",
        "cota_cm",
        "consistencia",
        "status_vazao",
        "status_cota",
    ]
    for c in cols_order:
        if c not in merged.columns:
            merged[c] = np.nan

    return merged[cols_order].sort_values(keys).reset_index(drop=True)
