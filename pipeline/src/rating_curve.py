"""
Ajuste e aplicação de curvas-chave (rating curves).

Forma adotada: potência clássica Strickler/Manning:

        Q = a · (h − h₀)^b              (h > h₀)

onde:
    h₀  → "cota zero da escala" (cm ou m, mesmo sistema de h)
    a   → constante de fórmula
    b   → expoente da curva (usualmente 1.5–3.0)

Implementação:
  - Cota é convertida para metros (vinda em cm da ANA).
  - `h₀` é estimado por **grid-search** entre 0 e (h_min − ε), passo configurável,
    minimizando SSR do ajuste log-linear `ln Q = ln a + b · ln(h − h₀)`.
  - Após o melhor h₀, refinamos `a, b` por `scipy.optimize.curve_fit` na escala
    natural (mais robusto a heterocedasticidade que log-linear puro).
  - Métricas: R² (1 − SSR/SST), RMSE, KS p-value dos resíduos normalizados.
"""

from __future__ import annotations

import logging
from typing import Iterable

import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import curve_fit

logger = logging.getLogger(__name__)


def _power_curve(h: np.ndarray, a: float, b: float, h0: float) -> np.ndarray:
    """Função-modelo Q = a·(h − h₀)^b, com clipping para evitar log(negativo)."""
    eps = 1e-6
    return a * np.maximum(h - h0, eps) ** b


def _log_linear_fit(
    h: np.ndarray, q: np.ndarray, h0: float
) -> tuple[float, float, float]:
    """Ajuste log-linear `ln q = ln a + b·ln(h − h₀)`. Devolve (a, b, ssr_log)."""
    mask = (h > h0) & (q > 0)
    if mask.sum() < 3:
        return float("nan"), float("nan"), float("inf")
    x = np.log(h[mask] - h0)
    y = np.log(q[mask])
    n = len(x)
    sx, sy = x.mean(), y.mean()
    sxx = np.sum((x - sx) ** 2)
    if sxx == 0:
        return float("nan"), float("nan"), float("inf")
    b = float(np.sum((x - sx) * (y - sy)) / sxx)
    a = float(np.exp(sy - b * sx))
    y_hat = b * x + (sy - b * sx)
    ssr = float(np.sum((y - y_hat) ** 2))
    return a, b, ssr


def ajustar_potencia(
    df_med: pd.DataFrame,
    *,
    cota_col: str = "cota_m",
    vazao_col: str = "vazao_m3s",
    h0_step_cm: float = 5.0,
    h0_min_cm: float = 0.0,
    min_pontos: int = 6,
) -> dict:
    """Ajusta `Q = a·(h − h₀)^b` por grid-search em h₀ + curve_fit em (a, b).

    Parameters
    ----------
    df_med
        DataFrame com pelo menos `cota_col` (em metros) e `vazao_col` (m³/s).
    h0_step_cm
        Passo do grid-search de h₀, em cm.
    h0_min_cm
        Limite inferior para h₀ (cm).
    min_pontos
        Mínimo de pontos válidos para tentar o ajuste.

    Returns
    -------
    dict com:
        forma: "potencia"
        a, b, h0           (h0 em metros)
        n_pontos
        r2, rmse, mae      (na escala natural Q m³/s)
        ks_pvalue          (dos resíduos normalizados)
        h_min, h_max       (faixa de validade, em metros)
        ssr_log            (SSR do ajuste log-linear inicial)
        residuos           (lista das residuais)
        pontos             (lista de [cota_m, vazao_m3s, vazao_ajustada])

    Raises
    ------
    ValueError se houver menos de `min_pontos` válidos.
    """
    df = df_med[[cota_col, vazao_col]].dropna().copy()
    df = df[(df[cota_col] > 0) & (df[vazao_col] > 0)]
    n = len(df)
    if n < min_pontos:
        raise ValueError(
            f"Pontos insuficientes para ajuste: {n} (mínimo {min_pontos})."
        )

    h = df[cota_col].to_numpy(dtype=float)
    q = df[vazao_col].to_numpy(dtype=float)

    # ----- Grid-search h0 -----
    h_min = float(h.min())
    h0_grid = np.arange(h0_min_cm / 100.0, h_min, h0_step_cm / 100.0)
    if len(h0_grid) == 0:
        h0_grid = np.array([0.0])

    best = (None, float("inf"), float("nan"), float("nan"))  # (h0, ssr_log, a, b)
    for h0 in h0_grid:
        a_ll, b_ll, ssr = _log_linear_fit(h, q, h0)
        if ssr < best[1] and np.isfinite(a_ll):
            best = (float(h0), ssr, a_ll, b_ll)

    h0_init, ssr_log, a_init, b_init = best
    if h0_init is None:
        raise ValueError("Grid-search de h₀ falhou em todos os candidatos.")

    # ----- Refinamento em curve_fit (a, b) na escala natural -----
    try:
        popt, _ = curve_fit(
            lambda hh, a, b: _power_curve(hh, a, b, h0_init),
            h, q,
            p0=[a_init, b_init],
            maxfev=5000,
        )
        a, b = float(popt[0]), float(popt[1])
    except Exception as exc:
        logger.warning(f"[rating] curve_fit falhou ({exc}); usando ajuste log-linear.")
        a, b = a_init, b_init

    q_hat = _power_curve(h, a, b, h0_init)
    residuos = q - q_hat
    ssr = float(np.sum(residuos ** 2))
    sst = float(np.sum((q - q.mean()) ** 2))
    r2 = 1.0 - ssr / sst if sst > 0 else float("nan")
    rmse = float(np.sqrt(ssr / n))
    mae = float(np.mean(np.abs(residuos)))

    # KS dos resíduos normalizados contra N(0,1)
    sigma = residuos.std(ddof=1) if residuos.std(ddof=1) > 0 else 1.0
    z = residuos / sigma
    ks_pvalue = float(stats.kstest(z, "norm").pvalue)

    return {
        "forma": "potencia",
        "a": a,
        "b": b,
        "h0": h0_init,
        "n_pontos": int(n),
        "r2": float(r2),
        "rmse": rmse,
        "mae": mae,
        "ks_pvalue": ks_pvalue,
        "h_min": float(h.min()),
        "h_max": float(h.max()),
        "ssr_log": float(ssr_log),
        "residuos": residuos.tolist(),
        "pontos": [
            {"cota_m": float(hh), "vazao_m3s": float(qq), "vazao_ajustada": float(qh)}
            for hh, qq, qh in zip(h, q, q_hat)
        ],
    }


def aplicar_curva(serie_cotas: pd.Series, params: dict) -> pd.Series:
    """Converte série de cotas (m) em vazões (m³/s) via curva ajustada.

    Cotas fora da faixa de validade [h_min, h_max] resultam em NaN, com aviso
    sobre extrapolação.
    """
    a = float(params["a"])
    b = float(params["b"])
    h0 = float(params["h0"])
    h_min = float(params.get("h_min", h0))
    h_max = float(params.get("h_max", np.inf))

    h = serie_cotas.astype(float)
    fora = (h < h_min) | (h > h_max)
    if fora.any():
        logger.info(
            f"[rating] {int(fora.sum())} cotas fora da faixa [{h_min:.2f}, {h_max:.2f}] "
            "m → NaN (extrapolação descartada)."
        )

    q = a * np.maximum(h - h0, 0.0) ** b
    q[h <= h0] = np.nan
    q[fora] = np.nan
    return q


def aplicar_curva_a_cotas_cm(
    cotas_cm: Iterable[float], params: dict
) -> pd.Series:
    """Conveniência: recebe cotas em centímetros (formato ANA) e devolve Q."""
    serie = pd.Series([c / 100.0 for c in cotas_cm], dtype=float)
    return aplicar_curva(serie, params)
