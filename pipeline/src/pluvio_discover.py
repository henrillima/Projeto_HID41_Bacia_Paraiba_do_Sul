"""
Descoberta e ranqueamento de estações pluviométricas candidatas para o
Projeto 2 (chuva-vazão da bacia do exutório fluvio).

Análogo a `fluvio_discover.py`, mas:
  - filtra `Tipo_Estacao` começando com "pluv"
  - sub-bacias prefixos de 5 dígitos (02244/02245/02344/02345 = Paraíba do Sul)
  - referência de proximidade é o EXUTÓRIO fluvio, não o centroide dos pluvios P1.

Score composto (normalizado em [0, 1]):
    score = peso_anos · score_anos
          + peso_falhas · score_falhas
          + peso_proximidade · score_proximidade
"""

from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd
from haversine import haversine

from .ana_client import HidroWebClient

logger = logging.getLogger(__name__)


# Prefixos de 4 dígitos cobrindo a bacia do Paraíba do Sul / cabeceira (URGHI 2).
# O inventário ANA REST retorna `codigoestacao` com 7 dígitos (ex.: "2245048"
# para PINDAMONHANGABA), sem zero à esquerda, portanto o prefixo são os
# primeiros 4 dígitos (banda lat/lon).
SUB_BACIAS_PLUVIO_PARAIBA_SUL = {"2244", "2245", "2344", "2345"}


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


def _anos_dados_pluvio(item: dict) -> float:
    """Estima anos de dados a partir das datas de período pluviométrico
    (campo `Data_Periodo_Pluviometro_*` no inventário REST da ANA)."""
    ini = (
        _parse_date(item.get("Data_Periodo_Pluviometro_Inicio"))
        or _parse_date(item.get("Data_Periodo_Registrador_Chuva_Inicio"))
        or _parse_date(item.get("Data_Periodo_Climatologica_Inicio"))
    )
    fim = (
        _parse_date(item.get("Data_Periodo_Pluviometro_Fim"))
        or _parse_date(item.get("Data_Periodo_Registrador_Chuva_Fim"))
        or _parse_date(item.get("Data_Periodo_Climatologica_Fim"))
        or _parse_date(item.get("Data_Ultima_Atualizacao"))
    )
    if ini is None or fim is None or fim <= ini:
        return 0.0
    return (fim - ini).days / 365.25


def _eh_pluvio(item: dict) -> bool:
    """O inventário REST não expõe `Tipo_Estacao` — identificamos pluvios
    pela presença de período pluviométrico válido."""
    return bool(item.get("Data_Periodo_Pluviometro_Inicio"))


def descobrir_pluvio(
    client: HidroWebClient,
    *,
    ufs: list[str] | None = None,
    codigo_bacia_macro: int = 5,
    filtro_sub_bacia: set[str] | None = None,
    apenas_operando: bool = False,
) -> pd.DataFrame:
    """Consulta o inventário REST e devolve candidatas pluviométricas.

    Parameters
    ----------
    ufs
        Lista de UFs. Default sugerido: `["SP", "RJ", "MG"]`.
    codigo_bacia_macro
        Macrorregião hidrográfica. 5 (default) = Atlântico Trecho Leste,
        que contém o Paraíba do Sul. Use o mesmo valor da configuração
        `fluviometria.codigo_bacia`.
    filtro_sub_bacia
        Conjunto de prefixos de 5 dígitos para reter (default = Paraíba do Sul).
        Use `None` para não filtrar (cuidado: traz milhares de estações).
    apenas_operando
        Se True, descarta estações com `Operando` != "1".
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

    pluvio = [e for e in raw if _eh_pluvio(e)]
    if filtro_sub_bacia is not None:
        pluvio = [
            e for e in pluvio
            if any(
                str(e.get("codigoestacao", "")).strip().startswith(p)
                for p in filtro_sub_bacia
            )
        ]
    if apenas_operando:
        pluvio = [e for e in pluvio if str(e.get("Operando", "")).strip() == "1"]

    if not pluvio:
        logger.warning(
            f"Nenhuma pluviométrica encontrada (UFs={ufs}, "
            f"bacia={codigo_bacia_macro}, sub_bacias={filtro_sub_bacia})."
        )
        return pd.DataFrame()

    linhas = []
    for e in pluvio:
        codigo = str(e.get("codigoestacao", "")).strip()
        ini = _parse_date(e.get("Data_Periodo_Pluviometro_Inicio"))
        fim = (
            _parse_date(e.get("Data_Periodo_Pluviometro_Fim"))
            or _parse_date(e.get("Data_Ultima_Atualizacao"))
        )
        linhas.append({
            "codigo": codigo,
            "nome": str(e.get("Estacao_Nome", "")).strip(),
            "lat": _coerce_float(e.get("Latitude")),
            "lon": _coerce_float(e.get("Longitude")),
            "altitude": _coerce_float(e.get("Altitude")),
            "anos_dados": round(_anos_dados_pluvio(e), 2),
            "data_inicio": ini.date().isoformat() if ini is not None else None,
            "data_fim":    fim.date().isoformat() if fim is not None else None,
            "operando": str(e.get("Operando", "")).strip() == "1",
            "operadora": str(e.get("Operadora_Sigla", "")).strip(),
            "bacia_nome": str(e.get("Bacia_Nome", "")).strip(),
            "sub_bacia_pref": codigo[:4] if codigo else "",
        })
    return pd.DataFrame(linhas)


def rankear_pluvio_p2(
    df_candidatas: pd.DataFrame,
    *,
    exutorio_lat: float,
    exutorio_lon: float,
    centroide_bacia: tuple[float, float] | None = None,
    peso_anos: float = 0.5,
    peso_falhas: float = 0.3,
    peso_proximidade: float = 0.2,
    anos_referencia: float = 40.0,
    raio_referencia_km: float = 20.0,
) -> pd.DataFrame:
    """Ranqueia candidatas pluviométricas pela proximidade ao exutório.

    Parameters
    ----------
    df_candidatas
        Saída de `descobrir_pluvio()`.
    exutorio_lat, exutorio_lon
        Coordenadas do exutório fluviométrico (estação 58142200 — BUQUIRINHA II).
    centroide_bacia
        Opcional: (lat, lon) do centroide da bacia para a coluna
        `dist_centroide_bacia_km`. Se omitido, copia o exutório.
    """
    df = df_candidatas.copy()
    if df.empty:
        return df

    centroide = centroide_bacia if centroide_bacia is not None else (exutorio_lat, exutorio_lon)

    def _dist(lat, lon, ref) -> float | None:
        if lat is None or lon is None:
            return None
        try:
            return haversine((float(lat), float(lon)), ref)
        except Exception:
            return None

    df["dist_exutorio_km"] = df.apply(
        lambda r: _dist(r.get("lat"), r.get("lon"), (exutorio_lat, exutorio_lon)),
        axis=1,
    )
    df["dist_centroide_bacia_km"] = df.apply(
        lambda r: _dist(r.get("lat"), r.get("lon"), centroide),
        axis=1,
    )

    df["score_anos"] = (df["anos_dados"].fillna(0) / anos_referencia).clip(0, 1)
    # Inventário não traz % de falhas; preenche neutro até validar com a série.
    df["score_falhas"] = 1.0
    df["score_proximidade"] = 1.0 / (
        1.0 + df["dist_exutorio_km"].fillna(raio_referencia_km * 10) / raio_referencia_km
    )

    df["score"] = (
        peso_anos * df["score_anos"]
        + peso_falhas * df["score_falhas"]
        + peso_proximidade * df["score_proximidade"]
    )

    cols = [
        "codigo", "nome", "lat", "lon", "altitude",
        "anos_dados", "data_inicio", "data_fim",
        "operando", "operadora", "bacia_nome", "sub_bacia_pref",
        "dist_exutorio_km", "dist_centroide_bacia_km",
        "score_anos", "score_falhas", "score_proximidade", "score",
    ]
    cols = [c for c in cols if c in df.columns]
    return df[cols].sort_values("score", ascending=False).reset_index(drop=True)
