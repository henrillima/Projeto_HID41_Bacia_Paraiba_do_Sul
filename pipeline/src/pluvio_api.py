"""
Ingestão de séries pluviométricas via API REST HidroWebService.

Substitui (ou complementa) o caminho via ZIP local (`parser.parse_ana_zip`) por
chamadas REST diretas, permitindo:
  - Atualização incremental sem re-download manual de ZIPs.
  - Padronização da consistência (`Nivel_Consistencia` é honrado).
  - Cache local de JSONs em `data/raw_v2/chuva/` para idempotência.

Retorna DataFrames com **a mesma assinatura** de `parse_ana_zip` para drop-in
substitution em `pipeline.py`:

    columns = ["estacao_codigo", "data", "valor", "consistencia"]
"""

from __future__ import annotations

import logging

import pandas as pd

from .ana_client import HidroWebClient
from .fluvio_parser import parse_serie_chuva

logger = logging.getLogger(__name__)


def fetch_chuva_diaria(
    client: HidroWebClient,
    codigo: str | int,
    ini: str,
    fim: str,
    *,
    cache: bool = True,
) -> tuple[dict, pd.DataFrame]:
    """Baixa a série de chuva diária de uma estação via REST.

    Returns
    -------
    meta : dict
        Metadados extraídos do inventário (mesmas chaves de `parse_ana_zip`:
        EstacaoCodigo, NomeEstacao, Latitude, Longitude, Altitude).
    df_daily : DataFrame
        Colunas: estacao_codigo, data (datetime), valor (mm), consistencia.
        Valores negativos viram NaN.
    """
    codigo_str = str(codigo)
    items = client.serie_chuva(codigo_str, ini, fim, cache=cache)
    df = parse_serie_chuva(items)

    if df.empty:
        logger.warning(f"[chuva-api] estação {codigo_str}: 0 registros entre {ini}–{fim}.")
        return _meta_via_inventario(client, codigo_str), pd.DataFrame(
            columns=["estacao_codigo", "data", "valor", "consistencia"]
        )

    # Adapta para o schema do pipeline atual:
    # parse_serie_chuva → ["estacao_codigo", "data" (date), "chuva_mm", "status",
    #                       "consistencia", "ultima_alteracao"]
    # pipeline espera      ["estacao_codigo", "data" (datetime), "valor", "consistencia"]
    out = pd.DataFrame({
        "estacao_codigo": df["estacao_codigo"],
        "data":           pd.to_datetime(df["data"], errors="coerce"),
        "valor":          df["chuva_mm"],
        "consistencia":   df["consistencia"].astype("Int64"),
    })
    out = out.dropna(subset=["data"]).sort_values("data").reset_index(drop=True)

    n = len(out)
    n_nan = int(out["valor"].isna().sum())
    if n:
        d_ini = out["data"].min().date()
        d_fim = out["data"].max().date()
        logger.info(
            f"[chuva-api] {codigo_str}: {n} dias | {d_ini} → {d_fim} | "
            f"falhas {n_nan} ({100*n_nan/n:.1f}%)"
        )
    return _meta_via_inventario(client, codigo_str), out


def _meta_via_inventario(client: HidroWebClient, codigo: str) -> dict:
    """Consulta inventário para extrair metadados básicos da estação."""
    try:
        inv = client.inventario(codigo_estacao=codigo)
    except Exception as exc:
        logger.warning(f"[meta] inventário {codigo} falhou ({exc}).")
        return {"EstacaoCodigo": codigo}
    if not inv:
        return {"EstacaoCodigo": codigo}
    e = inv[0]
    return {
        "EstacaoCodigo": str(e.get("codigoestacao", codigo)).strip(),
        "NomeEstacao":   str(e.get("Estacao_Nome", "")).strip(),
        "Latitude":      _str(e.get("Latitude")),
        "Longitude":     _str(e.get("Longitude")),
        "Altitude":      _str(e.get("Altitude")),
    }


def _str(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None
