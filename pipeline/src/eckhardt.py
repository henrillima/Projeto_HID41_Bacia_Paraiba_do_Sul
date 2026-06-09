"""
Filtro Digital de Eckhardt (2005) — separação de escoamentos.

Conforme HID41_Projeto2_Metodologia.md (etapa 2) e Collischonn & Dornelles (cap. 15):

Equação recursiva:

    b_i = [ (1 - BFI_max) · a · b_{i-1} + (1 - a) · BFI_max · y_i ]
          / (1 - a · BFI_max)

com a restrição  b_i ≤ y_i  e  f_i = y_i - b_i.

Parâmetros:
  - a = exp(-Δt / k), onde k é a constante de recessão (dias) estimada
    em trechos de depleção (estiagem sem chuva).
  - BFI_max (valores típicos de Eckhardt 2005):
        0.80 — rios perenes com aquífero poroso
        0.50 — rios perenes com aquífero fraturado/rochoso
        0.25 — rios efêmeros

BFI global = Σ b_i / Σ y_i.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

BFI_MAX_AQUIFERO_POROSO = 0.80
BFI_MAX_AQUIFERO_FRATURADO = 0.50
BFI_MAX_EFEMERO = 0.25


def estimar_constante_recessao(
    serie_q: pd.Series,
    serie_chuva: pd.Series | None = None,
    *,
    min_dias_sem_chuva: int = 3,
    janela_min_dias: int = 5,
    janela_max_dias: int = 60,
) -> dict:
    """Estima `k` e `a` por regressão log-linear nas recessões.

    Parameters
    ----------
    serie_q
        Vazão diária indexada por data.
    serie_chuva
        Chuva diária da bacia (mm), opcional. Se ausente, usamos apenas a
        heurística de "vazão monotonicamente decrescente" para detectar recessões.
    min_dias_sem_chuva
        Quantos dias sem chuva antes de aceitar como início de recessão.
    janela_min_dias / janela_max_dias
        Limites da janela contínua de recessão.

    Returns
    -------
    {
      "k": <float>,            # constante de recessão em dias
      "a": <float>,            # = exp(-1/k) para Δt = 1 dia
      "n_janelas": <int>,
      "ajuste_log": {...}      # diagnóstico do ajuste
    }
    """
    q = serie_q.astype(float).dropna()
    if q.empty:
        return {"k": float("nan"), "a": float("nan"), "n_janelas": 0}

    # Identifica períodos sem chuva (se disponível); caso contrário aceita
    # qualquer trecho descendente.
    if serie_chuva is not None:
        chuva = serie_chuva.astype(float).reindex(q.index).fillna(0.0)
        sem_chuva = chuva == 0
        sem_chuva_rolling = sem_chuva.rolling(min_dias_sem_chuva).sum()
        elegivel = sem_chuva_rolling >= min_dias_sem_chuva
    else:
        elegivel = pd.Series(True, index=q.index)

    # Detecta janelas de queda monotônica em q
    diffs = q.diff()
    descendo = (diffs < 0) & elegivel

    janelas: list[tuple[pd.Timestamp, pd.Timestamp]] = []
    inicio: pd.Timestamp | None = None
    fim: pd.Timestamp | None = None
    for ts, val in descendo.items():
        if val:
            if inicio is None:
                inicio = ts
            fim = ts
        else:
            if inicio is not None and fim is not None:
                dias = (fim - inicio).days + 1
                if dias >= janela_min_dias:
                    janelas.append((inicio, min(fim, inicio + pd.Timedelta(days=janela_max_dias))))
            inicio = None
            fim = None
    if inicio is not None and fim is not None:
        dias = (fim - inicio).days + 1
        if dias >= janela_min_dias:
            janelas.append((inicio, min(fim, inicio + pd.Timedelta(days=janela_max_dias))))

    if not janelas:
        logger.warning("[eckhardt] Nenhuma janela de recessão encontrada; usando default.")
        return {"k": float("nan"), "a": 0.98, "n_janelas": 0}

    # Para cada janela, ajusta ln(Q) = ln(Q0) - t/k → slope = -1/k
    ks: list[float] = []
    for ini, end in janelas:
        seg = q.loc[ini:end]
        if (seg <= 0).any() or len(seg) < janela_min_dias:
            continue
        x = np.arange(len(seg), dtype=float)
        y = np.log(seg.values)
        # Mínimos quadrados simples
        n = len(x)
        sx, sy = x.mean(), y.mean()
        sxx = float(np.sum((x - sx) ** 2))
        if sxx == 0:
            continue
        slope = float(np.sum((x - sx) * (y - sy)) / sxx)
        if slope >= 0:
            continue   # não é recessão
        k_est = -1.0 / slope
        if 1.0 <= k_est <= 500.0:
            ks.append(k_est)

    if not ks:
        logger.warning("[eckhardt] Janelas detectadas mas slopes inválidos; usando default.")
        return {"k": float("nan"), "a": 0.98, "n_janelas": len(janelas)}

    # Mediana é mais robusta que média na presença de outliers
    k_final = float(np.median(ks))
    a_final = float(np.exp(-1.0 / k_final))
    logger.info(
        f"[eckhardt] k={k_final:.2f} dias (mediana de {len(ks)} janelas) → "
        f"a={a_final:.4f}"
    )
    return {
        "k": k_final,
        "a": a_final,
        "n_janelas": len(ks),
        "k_min": float(np.min(ks)),
        "k_max": float(np.max(ks)),
    }


def filtrar_eckhardt(
    serie_q: pd.Series,
    *,
    alpha: float,
    bfi_max: float,
    b0: float | None = None,
) -> pd.DataFrame:
    """Aplica o filtro recursivo de Eckhardt (2005) em uma série de vazão diária.

    Parameters
    ----------
    serie_q
        Vazão total diária (m³/s), indexada por data.
    alpha
        Constante de recessão a = exp(-Δt/k).
    bfi_max
        Índice de escoamento de base máximo (fração 0–1).
    b0
        Vazão de base inicial. Default = primeiro valor de q.

    Returns
    -------
    DataFrame com colunas:
        q_total, q_base, q_direto, bfi_diario
        Indexado pela data.
    """
    if not (0 < alpha < 1):
        raise ValueError("alpha deve estar em (0, 1).")
    if not (0 < bfi_max < 1):
        raise ValueError("bfi_max deve estar em (0, 1).")

    q = serie_q.astype(float)
    # Para a recursão, vazões NaN são copiadas como NaN (sem afetar o cálculo).
    base = pd.Series(np.nan, index=q.index, dtype=float)
    primeiro_idx = q.first_valid_index()
    if primeiro_idx is None:
        return pd.DataFrame({
            "q_total": q,
            "q_base": base,
            "q_direto": q - base,
            "bfi_diario": base,
        })

    base.iloc[q.index.get_loc(primeiro_idx)] = (
        b0 if b0 is not None else float(q.loc[primeiro_idx])
    )

    denom = 1.0 - alpha * bfi_max
    num_a = (1.0 - bfi_max) * alpha
    num_b = (1.0 - alpha) * bfi_max

    prev_base = float(base.loc[primeiro_idx])
    prev_idx = primeiro_idx
    for ts, qv in q.items():
        if ts == prev_idx:
            continue
        if pd.isna(qv):
            base.loc[ts] = np.nan
            continue
        bi = (num_a * prev_base + num_b * qv) / denom
        bi = min(bi, qv)  # restrição física
        base.loc[ts] = bi
        prev_base = bi
        prev_idx = ts

    direto = q - base
    direto = direto.clip(lower=0.0)
    bfi_diario = base / q
    bfi_diario = bfi_diario.where(q > 0, np.nan)

    return pd.DataFrame({
        "q_total": q,
        "q_base": base,
        "q_direto": direto,
        "bfi_diario": bfi_diario,
    })


def bfi_global(df_eckhardt: pd.DataFrame) -> float:
    """BFI = Σ b / Σ y (ignorando NaN)."""
    soma_base = float(df_eckhardt["q_base"].sum(skipna=True))
    soma_total = float(df_eckhardt["q_total"].sum(skipna=True))
    if soma_total <= 0:
        return float("nan")
    return soma_base / soma_total
