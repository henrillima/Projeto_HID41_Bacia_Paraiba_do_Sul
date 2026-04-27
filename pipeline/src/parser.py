"""
Parser para arquivos ZIP do ANA Hidroweb (precipitação pluviométrica).

Formato dos CSVs da ANA:
  - Encoding  : latin-1
  - Separador : ponto-e-vírgula (;)
  - Decimais  : vírgula brasileira (,)
  - Linhas 0–12 : metadados de cabeçalho (variável)
  - A partir da linha com "EstacaoCodigo": dados mensais
  - Cada linha = um mês; colunas Chuva01…Chuva31 = precipitação diária
  - NivelConsistencia 1 = bruto, 2 = consistido → priorizar consistido
"""

from __future__ import annotations

import io
import logging
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Colunas de dia no CSV da ANA
_DAY_COLS = [f"Chuva{i:02d}" for i in range(1, 32)]
# Máximo de linhas de cabeçalho a escanear antes dos dados
_MAX_HEADER_SCAN = 25


def _find_header_row(lines: list[str]) -> int:
    """Retorna o índice da linha que contém os nomes das colunas."""
    for i, line in enumerate(lines[:_MAX_HEADER_SCAN]):
        if "EstacaoCodigo" in line or "Chuva01" in line:
            return i
    # Fallback conservador usado em versões antigas da ANA
    return 13


def _extract_metadata_from_header(lines: list[str], header_idx: int) -> dict:
    """
    Tenta extrair metadados (código, nome, lat, lon, altitude) das linhas
    de comentário antes do cabeçalho real.
    """
    meta: dict = {}
    target_fields = {
        "EstacaoCodigo": r"(?:c[oó]digo|estacao_codigo|estacaoCodigo)\s*[;:]\s*([^\s;]+)",
        "NomeEstacao":   r"(?:nome)\s*[;:]\s*([^;]+)",
        "Latitude":      r"(?:latitude|lat)\s*[;:]\s*([-\d.,]+)",
        "Longitude":     r"(?:longitude|lon)\s*[;:]\s*([-\d.,]+)",
        "Altitude":      r"(?:altitude|alt)\s*[;:]\s*([\d.,]+)",
    }
    for line in lines[:header_idx]:
        l = line.lower()
        for key, pattern in target_fields.items():
            if key not in meta:
                m = re.search(pattern, l)
                if m:
                    meta[key] = m.group(1).strip().replace(",", ".")
    return meta


def _safe_float(value: str | float | None) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "."))
    except (ValueError, TypeError):
        return None


def parse_ana_zip(zip_path: Path) -> tuple[dict, pd.DataFrame]:
    """
    Abre um ZIP do ANA Hidroweb e retorna metadados + série diária de precipitação.

    Returns
    -------
    meta : dict
        Campos: EstacaoCodigo, NomeEstacao, Latitude, Longitude, Altitude
        (strings; valores ausentes ficam como None).
    df_daily : pd.DataFrame
        Colunas: estacao_codigo, data (datetime), valor (float/NaN), consistencia (int)
        Uma linha por dia. Dias inválidos (p.ex. 31/02) são descartados.
        Quando o mesmo mês aparece com consistências 1 e 2, mantém-se apenas o 2.
    """
    zip_path = Path(zip_path)
    logger.info(f"Abrindo ZIP: {zip_path.name}")

    with zipfile.ZipFile(zip_path, "r") as zf:
        csv_name = next(
            (n for n in zf.namelist() if re.match(r"chuvas_C_.*\.csv$", n, re.I)),
            None,
        )
        if csv_name is None:
            raise FileNotFoundError(
                f"Não encontrei 'chuvas_C_*.csv' dentro de {zip_path.name}. "
                "Verifique se o arquivo foi baixado corretamente do Hidroweb."
            )
        raw_bytes = zf.read(csv_name)

    content = raw_bytes.decode("latin-1")
    lines = content.splitlines()

    header_idx = _find_header_row(lines)
    meta = _extract_metadata_from_header(lines, header_idx)

    # Lê o CSV a partir da linha de cabeçalho
    csv_str = "\n".join(lines[header_idx:])
    df_raw = pd.read_csv(
        io.StringIO(csv_str),
        sep=";",
        decimal=",",
        low_memory=False,
        dtype=str,           # Tudo como string primeiro para evitar problemas de tipo
    )
    df_raw.columns = [c.strip() for c in df_raw.columns]

    # Verificação de colunas obrigatórias
    required = {"EstacaoCodigo", "NivelConsistencia", "Data"}
    missing = required - set(df_raw.columns)
    if missing:
        raise ValueError(
            f"Colunas obrigatórias ausentes em {zip_path.name}: {missing}. "
            f"Colunas encontradas: {list(df_raw.columns)[:10]}"
        )

    # Completa metadados com valores da coluna de dados (mais confiável)
    codigo_series = df_raw["EstacaoCodigo"].dropna()
    if len(codigo_series) > 0 and "EstacaoCodigo" not in meta:
        meta["EstacaoCodigo"] = str(codigo_series.iloc[0]).strip()

    # Parse da data (formato ANA: dd/mm/yyyy, sempre dia 01)
    df_raw["Data"] = pd.to_datetime(df_raw["Data"].str.strip(), format="%d/%m/%Y", errors="coerce")
    df_raw = df_raw.dropna(subset=["Data"]).copy()

    # Consistência como inteiro
    df_raw["NivelConsistencia"] = pd.to_numeric(df_raw["NivelConsistencia"], errors="coerce").fillna(1).astype(int)

    # Quando mesmo mês tem duplicata por consistência: manter o maior nível (consistido > bruto)
    day_cols_present = [c for c in _DAY_COLS if c in df_raw.columns]
    id_cols = ["EstacaoCodigo", "Data", "NivelConsistencia"]
    df_raw = (
        df_raw[id_cols + day_cols_present]
        .sort_values("NivelConsistencia")
        .groupby(["EstacaoCodigo", "Data"], as_index=False)
        .last()
    )

    # Melt: colunas Chuva01…Chuva31 → linhas
    df_long = df_raw.melt(
        id_vars=id_cols,
        value_vars=day_cols_present,
        var_name="dia_col",
        value_name="valor_str",
    )

    # Número do dia a partir do nome da coluna (Chuva07 → 7)
    df_long["dia"] = df_long["dia_col"].str.extract(r"(\d+)$").astype(int)

    # Constrói a data completa; errors='coerce' descarta dias inválidos (ex.: 31/02)
    df_long["data"] = pd.to_datetime(
        {
            "year":  df_long["Data"].dt.year,
            "month": df_long["Data"].dt.month,
            "day":   df_long["dia"],
        },
        errors="coerce",
    )
    df_long = df_long.dropna(subset=["data"]).copy()

    # Converte valor para float (trata vírgula decimal e strings inválidas)
    df_long["valor"] = (
        df_long["valor_str"]
        .str.strip()
        .str.replace(",", ".", regex=False)
        .pipe(pd.to_numeric, errors="coerce")
    )

    # Garante que valores negativos espúrios sejam NaN
    df_long.loc[df_long["valor"] < 0, "valor"] = np.nan

    df_daily = (
        df_long[["EstacaoCodigo", "data", "valor", "NivelConsistencia"]]
        .rename(columns={"EstacaoCodigo": "estacao_codigo", "NivelConsistencia": "consistencia"})
        .copy()
    )
    df_daily["estacao_codigo"] = df_daily["estacao_codigo"].astype(str).str.strip()
    df_daily = df_daily.sort_values("data").reset_index(drop=True)

    n_total = len(df_daily)
    n_nan = df_daily["valor"].isna().sum()
    pct_nan = 100 * n_nan / n_total if n_total > 0 else 0
    logger.info(
        f"  → {n_total} dias | "
        f"{df_daily['data'].min().date()} → {df_daily['data'].max().date()} | "
        f"falhas: {n_nan} ({pct_nan:.1f}%)"
    )

    return meta, df_daily
