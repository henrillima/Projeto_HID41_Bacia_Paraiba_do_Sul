"""
Descoberta e ranqueamento de estações fluviométricas candidatas
ao exutório da bacia de estudo.

Estratégia:
  1. Consulta o inventário via API REST (filtro UF + bacia macro).
  2. Filtra apenas estações fluviométricas em sub-bacias de interesse
     (ex.: Paraíba do Sul = códigos iniciando com `58` ou `57`).
  3. Calcula distância haversine de cada candidata ao "centroide" das
     estações pluviométricas já em uso no projeto.
  4. Calcula um score composto e ordena.

Score composto (normalizado em [0, 1]):
    score = 0.5 · score_anos
          + 0.3 · (1 − pct_falhas/100)
          + 0.2 · score_proximidade

onde:
  - score_anos          = min(anos_dados / 40, 1.0)
  - score_proximidade   = 1 / (1 + dist_min_km / 20)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Iterable

import pandas as pd
from haversine import haversine

from .ana_client import HidroWebClient

logger = logging.getLogger(__name__)


# Sub-bacias do macrobacin 8 (Atlântico Sudeste) relevantes ao Paraíba do Sul.
# Códigos seguem o padrão ANA do prefixo dos 2 primeiros dígitos do código.
SUB_BACIAS_PARAIBA_SUL = {"58", "57"}


def _parse_date(value) -> pd.Timestamp | None:
    if value in (None, ""):
        return None
    try:
        return pd.to_datetime(value, errors="coerce")
    except Exception:
        return None


def _coerce_float(value, default: float | None = None) -> float | None:
    if value in (None, ""):
        return default
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def _is_paraiba_sul(item: dict) -> bool:
    codigo = str(item.get("codigoestacao", "")).strip()
    return any(codigo.startswith(p) for p in SUB_BACIAS_PARAIBA_SUL)


def _anos_dados_fluvio(item: dict) -> float:
    """Estima anos de dados a partir das datas de período de descarga líquida."""
    ini = _parse_date(item.get("Data_Periodo_Desc_liquida_Inicio")) or \
          _parse_date(item.get("Data_Periodo_Descarga_Liquida_Inicio")) or \
          _parse_date(item.get("Data_Periodo_Climatologica_Inicio"))
    fim = _parse_date(item.get("Data_Periodo_Desc_Liquida_Fim")) or \
          _parse_date(item.get("Data_Periodo_Descarga_Liquida_Fim")) or \
          _parse_date(item.get("Data_Periodo_Climatologica_Fim")) or \
          _parse_date(item.get("Data_Ultima_Atualizacao"))
    if ini is None or fim is None or fim <= ini:
        return 0.0
    return (fim - ini).days / 365.25


def _centroide(coords: Iterable[tuple[float, float]]) -> tuple[float, float] | None:
    pts = [(lat, lon) for lat, lon in coords if lat is not None and lon is not None]
    if not pts:
        return None
    n = len(pts)
    return sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n


def descobrir_fluvio(
    client: HidroWebClient,
    *,
    ufs: list[str] | None = None,
    codigo_bacia_macro: int = 8,
    filtro_sub_bacia: set[str] | None = None,
    apenas_operando: bool = False,
) -> pd.DataFrame:
    """Consulta inventário e devolve candidatas fluviométricas como DataFrame.

    Parameters
    ----------
    ufs
        Lista de UFs para consultar. `None` ou lista vazia → consulta sem
        filtro de UF (apenas bacia macro), o que pode trazer um volume grande
        de estações. Default sugerido para Paraíba do Sul: `["SP", "RJ", "MG"]`.
    codigo_bacia_macro
        Macro-região hidrográfica (1–9). 8 = Atlântico Sudeste.
    filtro_sub_bacia
        Conjunto de prefixos de código (2 dígitos) para reter. Default =
        Paraíba do Sul (`{"58", "57"}`). Use `None` para não filtrar.
    apenas_operando
        Se True, descarta estações com `Operando == "0"`.

    Returns
    -------
    DataFrame com colunas:
      codigo, nome, lat, lon, altitude, area_drenagem_km2,
      anos_dados, data_inicio, data_fim, operando, operadora,
      bacia_nome, codigo_bacia, sub_bacia_pref.
    """
    if ufs:
        raw: list[dict] = []
        vistos: set[str] = set()
        for uf in ufs:
            r = client.inventario(uf=uf, codigo_bacia=codigo_bacia_macro)
            for item in r:
                cod = str(item.get("codigoestacao", "")).strip()
                if cod and cod not in vistos:
                    vistos.add(cod)
                    raw.append(item)
    else:
        raw = client.inventario(codigo_bacia=codigo_bacia_macro)

    fluvio = [
        e for e in raw
        if str(e.get("Tipo_Estacao", "")).strip().lower().startswith("fluvio")
    ]
    if filtro_sub_bacia is not None:
        fluvio = [
            e for e in fluvio
            if any(
                str(e.get("codigoestacao", "")).strip().startswith(p)
                for p in filtro_sub_bacia
            )
        ]
    if apenas_operando:
        fluvio = [e for e in fluvio if str(e.get("Operando", "")).strip() == "1"]

    if not fluvio:
        logger.warning(
            f"Nenhuma estação fluviométrica encontrada (UF={uf}, "
            f"bacia={codigo_bacia_macro}, sub_bacia={filtro_sub_bacia})."
        )
        return pd.DataFrame()

    linhas = []
    for e in fluvio:
        codigo = str(e.get("codigoestacao", "")).strip()
        ini = _parse_date(e.get("Data_Periodo_Desc_liquida_Inicio"))
        fim = _parse_date(e.get("Data_Periodo_Desc_Liquida_Fim")) or \
              _parse_date(e.get("Data_Ultima_Atualizacao"))
        linhas.append({
            "codigo": codigo,
            "nome": str(e.get("Estacao_Nome", "")).strip(),
            "lat": _coerce_float(e.get("Latitude")),
            "lon": _coerce_float(e.get("Longitude")),
            "altitude": _coerce_float(e.get("Altitude")),
            "area_drenagem_km2": _coerce_float(e.get("Area_Drenagem")),
            "anos_dados": round(_anos_dados_fluvio(e), 2),
            "data_inicio": ini.date().isoformat() if ini is not None else None,
            "data_fim":    fim.date().isoformat() if fim is not None else None,
            "operando": str(e.get("Operando", "")).strip() == "1",
            "operadora": str(e.get("Operadora_Sigla", "")).strip(),
            "bacia_nome": str(e.get("Bacia_Nome", "")).strip(),
            "codigo_bacia": str(e.get("codigobacia", "")).strip(),
            "sub_bacia_pref": codigo[:2] if codigo else "",
        })
    return pd.DataFrame(linhas)


def rankear_candidatas(
    df_candidatas: pd.DataFrame,
    pluvios: pd.DataFrame,
    *,
    peso_anos: float = 0.5,
    peso_falhas: float = 0.3,
    peso_proximidade: float = 0.2,
    anos_referencia: float = 40.0,
    raio_referencia_km: float = 20.0,
) -> pd.DataFrame:
    """Calcula score composto e ordena candidatas.

    Parameters
    ----------
    df_candidatas
        Saída de `descobrir_fluvio()`.
    pluvios
        DataFrame com colunas `codigo, lat, lon` das estações pluviométricas
        de referência (idealmente as 3 atuais do projeto).

    Returns
    -------
    DataFrame ordenado por score decrescente, com colunas adicionais:
      dist_min_km, dist_centroide_km, score_anos, score_falhas,
      score_proximidade, score.
    """
    df = df_candidatas.copy()

    centro = _centroide(zip(pluvios["lat"], pluvios["lon"]))

    def _dist_min(lat, lon) -> float | None:
        if lat is None or lon is None:
            return None
        pts = [
            (float(r.lat), float(r.lon))
            for r in pluvios.itertuples()
            if r.lat is not None and r.lon is not None
        ]
        if not pts:
            return None
        return min(haversine((lat, lon), p) for p in pts)

    df["dist_min_km"] = df.apply(
        lambda r: _dist_min(r.get("lat"), r.get("lon")), axis=1
    )
    df["dist_centroide_km"] = df.apply(
        lambda r: haversine((r.lat, r.lon), centro) if (
            centro is not None
            and r.get("lat") is not None
            and r.get("lon") is not None
        ) else None,
        axis=1,
    )

    df["score_anos"] = (df["anos_dados"].fillna(0) / anos_referencia).clip(0, 1)
    # Sem dado de falhas no inventário; usamos placeholder neutro de 0% até
    # validar com a série real. Se quiser refinar, baixar série rápida.
    df["score_falhas"] = 1.0
    df["score_proximidade"] = 1.0 / (
        1.0 + df["dist_min_km"].fillna(raio_referencia_km * 10) / raio_referencia_km
    )

    df["score"] = (
        peso_anos * df["score_anos"]
        + peso_falhas * df["score_falhas"]
        + peso_proximidade * df["score_proximidade"]
    )

    cols = [
        "codigo", "nome", "lat", "lon", "altitude",
        "area_drenagem_km2", "anos_dados", "data_inicio", "data_fim",
        "operando", "operadora", "bacia_nome", "sub_bacia_pref",
        "dist_min_km", "dist_centroide_km",
        "score_anos", "score_falhas", "score_proximidade", "score",
    ]
    cols = [c for c in cols if c in df.columns]
    return df[cols].sort_values("score", ascending=False).reset_index(drop=True)
