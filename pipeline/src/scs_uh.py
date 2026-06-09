"""
Hidrograma Unitário Sintético do SCS (triangular) e método SCS-CN para
chuva efetiva — Fase 3 do Projeto 2.

Conforme HID41_Projeto2_Metodologia.md (etapa 4 e 5):

Tempo de concentração:
  - Kirpich (1940), bacias pequenas/rurais:
        tc[min] = 57 · (L³/Δh)^0.385, L em km, Δh em m.
  - Watt & Chow (1985), bacias maiores (até ~5840 km²):
        tc[min] = 7.68 · (L / S^0.5)^0.79, S adimensional.

HU SCS triangular (com duração efetiva d):
  tp = 0.6 · tc                            [h]
  Tp = tp + d/2                            [h]
  Qp = 0.208 · A / Tp                      [m³/s/mm]
  tb = 2.67 · Tp                           [h]

Chuva efetiva pelo SCS-CN:
  S = 25400/CN − 254                       [mm]
  Ia = 0.2 · S                             [mm]
  Q = (P − Ia)² / (P − Ia + S)             se P > Ia; senão Q = 0.
"""

from __future__ import annotations

import logging
from typing import Iterable

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tempos de concentração
# ---------------------------------------------------------------------------

def tc_kirpich(L_km: float, delta_h_m: float) -> float:
    """tc por Kirpich (1940) em **minutos**. L em km, Δh em m."""
    if L_km is None or delta_h_m is None or L_km <= 0 or delta_h_m <= 0:
        raise ValueError("L_km e delta_h_m devem ser positivos.")
    return 57.0 * ((L_km ** 3) / delta_h_m) ** 0.385


def tc_watt_chow(L_km: float, S: float) -> float:
    """tc por Watt & Chow (1985) em **minutos**. L em km, S adimensional."""
    if L_km is None or S is None or L_km <= 0 or S <= 0:
        raise ValueError("L_km e S devem ser positivos.")
    return 7.68 * (L_km / (S ** 0.5)) ** 0.79


# ---------------------------------------------------------------------------
# HU SCS triangular
# ---------------------------------------------------------------------------

def huo_scs_triangular(
    area_km2: float,
    tc_min: float,
    duracao_efetiva_min: float | None = None,
    dt_min: float = 60.0,
) -> dict:
    """Gera as ordenadas (em m³/s/mm) do HU SCS triangular para 1 mm de lâmina.

    Parameters
    ----------
    area_km2
        Área de drenagem (km²).
    tc_min
        Tempo de concentração (min).
    duracao_efetiva_min
        Duração da chuva efetiva (min). Default = 1/3 do tc (regra prática).
    dt_min
        Passo de discretização do HU (min).
    """
    tc_h = tc_min / 60.0
    d_h = (duracao_efetiva_min or (tc_min / 3.0)) / 60.0
    tp = 0.6 * tc_h
    Tp_h = tp + d_h / 2.0
    Qp = 0.208 * area_km2 / Tp_h               # m³/s/mm
    tb_h = 2.67 * Tp_h
    dt_h = dt_min / 60.0
    n_pts = int(np.ceil(tb_h / dt_h)) + 1
    tempos_h = np.arange(0, tb_h + dt_h, dt_h)[:n_pts]
    ordenadas = np.zeros_like(tempos_h)
    # Ramo ascendente (0 → Tp)
    rising = tempos_h <= Tp_h
    ordenadas[rising] = Qp * tempos_h[rising] / Tp_h
    # Ramo descendente (Tp → tb)
    falling = (tempos_h > Tp_h) & (tempos_h <= tb_h)
    ordenadas[falling] = Qp * (tb_h - tempos_h[falling]) / (tb_h - Tp_h)
    return {
        "ordenadas_m3s_per_mm": ordenadas.tolist(),
        "tempos_h": tempos_h.tolist(),
        "tp_h": float(tp),           # tp = 0.6 · tc
        "t_pico_h": float(Tp_h),     # Tp = tp + d/2 — tempo até o pico
        "tb_h": float(tb_h),
        "qp_m3s_per_mm": float(Qp),
        "tc_min": float(tc_min),
        "duracao_efetiva_min": float(duracao_efetiva_min or tc_min / 3.0),
        "dt_min": float(dt_min),
        "area_km2": float(area_km2),
    }


# ---------------------------------------------------------------------------
# SCS-CN — chuva efetiva
# ---------------------------------------------------------------------------

def chuva_efetiva_scs_cn(
    chuvas_mm: Iterable[float],
    cn: float,
    *,
    ia_ratio: float = 0.2,
) -> np.ndarray:
    """Aplica SCS-CN a uma sequência de chuvas acumuladas mm → P_efetiva.

    A fórmula é definida para a chuva ACUMULADA. Convertemos pulsos para
    cumulativo, aplicamos a fórmula, e devolvemos os incrementos (de chuva
    efetiva acumulada).
    """
    p = np.asarray(list(chuvas_mm), dtype=float)
    if cn <= 0 or cn > 100:
        raise ValueError("CN deve estar em (0, 100].")
    S = 25400.0 / cn - 254.0
    Ia = ia_ratio * S
    p_cum = np.cumsum(p)
    q_cum = np.where(
        p_cum > Ia,
        (p_cum - Ia) ** 2 / (p_cum - Ia + S),
        0.0,
    )
    pe = np.diff(np.concatenate(([0.0], q_cum)))
    return np.maximum(pe, 0.0)


def aplicar_scs(
    huo_scs: dict,
    hietograma_mm: Iterable[float],
    cn: float | None = None,
) -> dict:
    """Combina SCS-CN (opcional) + convolução com HU SCS triangular.

    Parameters
    ----------
    huo_scs
        Saída de `huo_scs_triangular`.
    hietograma_mm
        Hietograma BRUTO (ou efetivo, se `cn=None`) em mm.
    cn
        Curve Number. Se fornecido, aplica SCS-CN no hietograma antes da
        convolução; caso contrário trata o hietograma como já efetivo.
    """
    p = np.asarray(list(hietograma_mm), dtype=float)
    if cn is not None:
        p_efetiva = chuva_efetiva_scs_cn(p, cn=cn)
    else:
        p_efetiva = p
    u = np.array(huo_scs["ordenadas_m3s_per_mm"], dtype=float)
    q = np.convolve(p_efetiva, u)
    return {
        "p_efetiva_mm": p_efetiva.tolist(),
        "p_total_mm": float(p.sum()),
        "p_efetiva_total_mm": float(p_efetiva.sum()),
        "hidrograma_m3s": q.tolist(),
        "q_pico_m3s": float(np.max(q)),
        "t_pico_idx": int(np.argmax(q)),
    }


# ---------------------------------------------------------------------------
# Comparação observado × SCS
# ---------------------------------------------------------------------------

def comparar_obs_vs_scs(huo_obs: dict, huo_scs: dict) -> dict:
    """Métricas comparativas (Nash-Sutcliffe) entre HU observado e HU SCS.

    O HU observado é diário e o HU SCS é sub-horário. Comparar diretamente o
    pico instantâneo do SCS com o pico do observado (já uma média diária) é
    apples-to-oranges. Por isso a comparação é feita na **malha do observado**
    (a mais grossa): o HU SCS é agregado por média dentro de cada janela diária,
    reproduzindo a mesma suavização que o registro diário impõe ao observado
    (ver docs/REVISAO_METODOLOGICA.md M1). O pico instantâneo do SCS é mantido
    em `qp_scs_instantaneo` para referência.
    """
    u_obs = np.array(huo_obs["ordenadas_m3s_per_mm"], dtype=float)
    u_scs = np.array(huo_scs["ordenadas_m3s_per_mm"], dtype=float)
    dt_obs_h = float(huo_obs.get("dt_dias", 1)) * 24.0
    dt_scs_h = float(huo_scs.get("dt_min", 60.0)) / 60.0

    t_scs = np.arange(len(u_scs)) * dt_scs_h

    # Agrega o HU SCS por médias em janelas de dt_obs_h (malha do observado)
    u_scs_diario = np.zeros(len(u_obs), dtype=float)
    for i in range(len(u_obs)):
        lo, hi = i * dt_obs_h, (i + 1) * dt_obs_h
        m = (t_scs >= lo) & (t_scs < hi)
        if m.any():
            u_scs_diario[i] = float(u_scs[m].mean())
        else:
            u_scs_diario[i] = float(np.interp(lo, t_scs, u_scs, left=0.0, right=0.0))

    nse_num = np.sum((u_obs - u_scs_diario) ** 2)
    nse_den = np.sum((u_obs - u_obs.mean()) ** 2)
    nse = 1.0 - nse_num / nse_den if nse_den > 0 else float("nan")

    qp_obs = float(huo_obs["q_pico_uh"])
    qp_scs_diario = float(u_scs_diario.max()) if len(u_scs_diario) else float("nan")
    erro_pico = (qp_scs_diario - qp_obs) / qp_obs if qp_obs else float("nan")
    tp_obs_h = huo_obs["t_pico_idx"] * dt_obs_h
    tp_scs_h = huo_scs["t_pico_h"]

    return {
        "nse": float(nse),
        "erro_pico_pct": float(erro_pico * 100.0),
        "erro_tpico_h": float(tp_scs_h - tp_obs_h),
        "qp_obs": qp_obs,
        "qp_scs": qp_scs_diario,
        "qp_scs_instantaneo": float(huo_scs["qp_m3s_per_mm"]),
        "grade_comparacao": "diaria",
    }
