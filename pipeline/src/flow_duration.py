"""
Curva de permanência e vazões de referência (Q90, Q50, Q10).

Conforme HID41_Projeto2_Metodologia.md (etapa 1):

  1. Toda a série de vazões diárias (n valores) é ordenada em ordem decrescente.
  2. Cada posição m = 1..n recebe a probabilidade empírica de excedência
     pela posição de plotagem de Weibull:

         P(%) = m / (n + 1) × 100

  3. Q_x (com x ∈ {5, 10, 25, 50, 75, 90, 95}) é interpolado linearmente
     entre os pontos vizinhos da curva.

Q90 → vazão de referência para outorga (CETESB/ANA).
Q50 → mediana de vazões (rio "firme").
Q10 → vazões altas de ocorrência frequente.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

PERCENTIS_PADRAO: tuple[float, ...] = (1, 5, 10, 25, 50, 75, 90, 95, 99)


def curva_permanencia(
    serie_vazao: pd.Series | list | np.ndarray,
    *,
    passo_pct: float = 0.5,
) -> pd.DataFrame:
    """Calcula a curva de permanência completa.

    Parameters
    ----------
    serie_vazao
        Série diária de vazão (m³/s). Valores NaN são descartados.
    passo_pct
        Resolução da curva em pontos percentuais. Default 0.5% → 201 pontos.

    Returns
    -------
    DataFrame com colunas:
        percentil  : float (0 a 100, ordem crescente)
        vazao_m3s  : float
    """
    valores = pd.Series(serie_vazao).dropna().astype(float).to_numpy()
    n = len(valores)
    if n == 0:
        return pd.DataFrame(columns=["percentil", "vazao_m3s"])

    ordenadas = np.sort(valores)[::-1]                 # decrescente
    posicoes = np.arange(1, n + 1)
    probs_excedencia = 100.0 * posicoes / (n + 1)      # Weibull

    grid = np.arange(0.0, 100.0 + passo_pct, passo_pct)
    # Interpolação linear; cuidado: probs_excedencia precisa estar ordenada
    # crescente para np.interp.
    curva = np.interp(grid, probs_excedencia, ordenadas)
    return pd.DataFrame({"percentil": grid, "vazao_m3s": curva})


def quantis_referencia(
    serie_vazao: pd.Series | list | np.ndarray,
    *,
    percentis: tuple[float, ...] = PERCENTIS_PADRAO,
) -> dict[str, float]:
    """Retorna {'Q5': ..., 'Q10': ..., ..., 'Q95': ...} via interpolação direta.

    Equivalente a `curva_permanencia` + lookup, mas mais preciso para os
    percentis solicitados (sem amostragem da curva).
    """
    valores = pd.Series(serie_vazao).dropna().astype(float).to_numpy()
    n = len(valores)
    if n == 0:
        return {f"Q{int(p) if p == int(p) else p}": float("nan") for p in percentis}

    ordenadas = np.sort(valores)[::-1]
    posicoes = np.arange(1, n + 1)
    probs = 100.0 * posicoes / (n + 1)

    out: dict[str, float] = {}
    for p in percentis:
        q = float(np.interp(p, probs, ordenadas))
        key = f"Q{int(p) if p == int(p) else p}"
        out[key] = q
    return out


def estatisticas_curva(curva: pd.DataFrame) -> dict[str, float]:
    """Caracteriza a forma da curva (achatada → BFI alto; íngreme → reposta rápida).

    - declividade_log: inclinação de log10(Q) entre P=10% e P=90% (negativa).
    - razao_Q10_Q90: índice de "torrência" do rio (maior → mais variável).
    """
    if curva.empty:
        return {"declividade_log": float("nan"), "razao_Q10_Q90": float("nan")}

    def at(pct: float) -> float:
        return float(np.interp(pct, curva["percentil"], curva["vazao_m3s"]))

    q10 = at(10)
    q90 = at(90)
    if q10 <= 0 or q90 <= 0:
        return {"declividade_log": float("nan"), "razao_Q10_Q90": float("nan")}
    decl = (np.log10(q90) - np.log10(q10)) / (90 - 10)
    return {
        "declividade_log": float(decl),
        "razao_Q10_Q90": q10 / q90,
    }
