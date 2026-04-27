"""
Estatísticas descritivas e histogramas para séries de precipitação.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

logger = logging.getLogger(__name__)


def histograma(serie: pd.Series, n_bins: int = 30) -> dict[str, Any]:
    """
    Calcula histograma de frequência absoluta.

    Exclui NaN e zeros para a série diária e mensal (dias/meses sem chuva
    não contribuem para a distribuição de intensidades).

    Returns
    -------
    dict: {bins, counts, bin_centers} — listas JSON-serializáveis.
    Retorna estrutura vazia se a série tiver menos de 2 valores.
    """
    valores = serie.dropna()
    if len(valores) < 2:
        logger.warning("[histograma] Série vazia ou insuficiente — retornando estrutura vazia.")
        return {"bins": [], "counts": [], "bin_centers": []}

    counts, bin_edges = np.histogram(valores, bins=n_bins)

    bin_centers = [(bin_edges[i] + bin_edges[i + 1]) / 2 for i in range(len(bin_edges) - 1)]

    return {
        "bins": [round(float(b), 4) for b in bin_edges.tolist()],
        "counts": [int(c) for c in counts.tolist()],
        "bin_centers": [round(float(c), 4) for c in bin_centers],
    }


def estatisticas_descritivas(serie: pd.Series) -> dict[str, Any]:
    """
    Calcula estatísticas descritivas completas.

    Returns
    -------
    dict com: media, mediana, desvio_padrao, min, max,
              p25, p50, p75, p90, p95, p99,
              n_observacoes, n_falhas, pct_falhas,
              coef_variacao, assimetria, curtose
    Todos os valores são float (NaN-safe). Retorna None nos campos
    numéricos se a série estiver completamente vazia.
    """
    n_total = len(serie)
    n_falhas = int(serie.isna().sum())
    n_obs = n_total - n_falhas
    pct_falhas = round(100.0 * n_falhas / n_total, 4) if n_total > 0 else 0.0

    valores = serie.dropna()

    def _safe(v: Any) -> float | None:
        if v is None:
            return None
        try:
            f = float(v)
            return None if np.isnan(f) or np.isinf(f) else round(f, 4)
        except (TypeError, ValueError):
            return None

    if len(valores) == 0:
        base: dict[str, Any] = {k: None for k in [
            "media", "mediana", "desvio_padrao", "min", "max",
            "p25", "p50", "p75", "p90", "p95", "p99",
            "coef_variacao", "assimetria", "curtose",
        ]}
        base.update({"n_observacoes": n_obs, "n_falhas": n_falhas, "pct_falhas": pct_falhas})
        return base

    media = valores.mean()
    mediana = valores.median()
    desvio = valores.std(ddof=1)
    cv = (desvio / media) if media != 0 else None
    assimetria = _safe(scipy_stats.skew(valores, bias=False))
    curtose = _safe(scipy_stats.kurtosis(valores, bias=False))  # excess kurtosis

    quantis = valores.quantile([0.25, 0.50, 0.75, 0.90, 0.95, 0.99])

    return {
        "media":         _safe(media),
        "mediana":       _safe(mediana),
        "desvio_padrao": _safe(desvio),
        "min":           _safe(valores.min()),
        "max":           _safe(valores.max()),
        "p25":           _safe(quantis[0.25]),
        "p50":           _safe(quantis[0.50]),
        "p75":           _safe(quantis[0.75]),
        "p90":           _safe(quantis[0.90]),
        "p95":           _safe(quantis[0.95]),
        "p99":           _safe(quantis[0.99]),
        "n_observacoes": int(n_obs),
        "n_falhas":      int(n_falhas),
        "pct_falhas":    pct_falhas,
        "coef_variacao": _safe(cv),
        "assimetria":    assimetria,
        "curtose":       curtose,
    }


def histograma_com_estatisticas(
    serie: pd.Series,
    n_bins: int = 30,
) -> dict[str, Any]:
    """
    Combina histograma e estatísticas descritivas em um único dict JSONB.
    Estrutura: { bins, counts, bin_centers, estatisticas: {...} }
    """
    hist = histograma(serie, n_bins)
    est = estatisticas_descritivas(serie)
    return {**hist, "estatisticas": est}
