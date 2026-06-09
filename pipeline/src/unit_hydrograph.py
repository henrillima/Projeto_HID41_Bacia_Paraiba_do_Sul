"""
Hidrograma Unitário Observado (HU) — Fase 3 do Projeto 2.

Conforme HID41_Projeto2_Metodologia.md (etapa 3):

  - HU = hidrograma de escoamento direto resultante de uma chuva efetiva
    UNITÁRIA (1 mm) de duração D distribuída uniformemente sobre a bacia.
  - Hipóteses: linearidade, invariância temporal, proporcionalidade.

Procedimento por evento:
  1. Já temos `q_direto` separado em [`event_isolation.py`] (método linha-reta).
  2. Calculamos `h_mm = V_direto / A` — lâmina total escoada direta.
  3. Normalizamos cada ordenada: `u_i = q_direto_i / h_mm`.
     Verificação: a soma das ordenadas (em m³/s/mm) integrada ao longo do
     tempo dá ≈ 1 mm de lâmina total.
  4. Anotamos a duração efetiva D da chuva (em dias) — depende do evento.

Para o HU médio:
  - Padroniza-se a duração D entre eventos via redilho temporal (curva S
    pode ser usada para combinar diferentes durações). Por simplicidade,
    aqui agregamos ordenadas alinhadas pelo pico, com média ponderada pelo
    inverso do erro relativo do volume escoado.
"""

from __future__ import annotations

import logging

import numpy as np

from .event_isolation import EventoChuvaVazao

logger = logging.getLogger(__name__)


def huo_observado(evento: EventoChuvaVazao) -> dict:
    """Calcula o HU observado a partir de um evento já separado.

    Returns
    -------
    {
        "ordenadas_m3s_per_mm": [...],
        "lamina_mm": <float>,
        "q_pico_uh": <float>,         # m³/s/mm
        "t_pico_idx": <int>,          # índice da ordenada do pico
        "base_time_dias": <int>,
        "dt_dias": 1,
    }
    """
    direto = np.array([h["q_direto"] for h in evento.hidrograma], dtype=float)
    lamina = evento.lamina_mm
    if lamina <= 0:
        raise ValueError("Lâmina escoada direta nula — não dá para normalizar.")
    u = direto / lamina   # m³/s por mm de lâmina
    return {
        "ordenadas_m3s_per_mm": u.tolist(),
        "lamina_mm": float(lamina),
        "q_pico_uh": float(np.max(u)),
        "t_pico_idx": int(np.argmax(u)),
        "base_time_dias": len(u),
        "dt_dias": 1,
    }


def huo_medio(huos: list[dict], *, n_max_ordenadas: int | None = None) -> dict:
    """Calcula um HU médio entre vários eventos, alinhando pelo pico.

    Cada HU é alinhado no índice do pico e zero-padding completa as bordas.
    A ordenada final é a média (simples) sobre os eventos.
    """
    if not huos:
        raise ValueError("Lista de HUOs vazia.")
    if n_max_ordenadas is None:
        n_max_ordenadas = max(len(h["ordenadas_m3s_per_mm"]) for h in huos)

    # Empilha alinhando pelo pico
    max_left = max(h["t_pico_idx"] for h in huos)
    n = n_max_ordenadas + max_left
    stack = np.zeros((len(huos), n), dtype=float)
    for i, h in enumerate(huos):
        u = np.array(h["ordenadas_m3s_per_mm"], dtype=float)
        offset = max_left - h["t_pico_idx"]
        stack[i, offset : offset + len(u)] = u

    medio = stack.mean(axis=0)
    desvio = stack.std(axis=0, ddof=1) if stack.shape[0] > 1 else np.zeros_like(medio)
    return {
        "ordenadas_m3s_per_mm": medio.tolist(),
        "desvio_ordenadas": desvio.tolist(),
        "n_eventos": len(huos),
        "q_pico_uh": float(np.max(medio)),
        "t_pico_idx": int(np.argmax(medio)),
        "base_time_dias": int(len(medio)),
        "dt_dias": 1,
    }


def aplicar_huo(huo: dict, hietograma_efetivo_mm: list[float]) -> np.ndarray:
    """Convolução discreta: Q_n = Σ_j P_j · u_{n−j+1}.

    Parameters
    ----------
    huo
        Dict com ordenadas em m³/s/mm.
    hietograma_efetivo_mm
        Lista de pulsos de chuva efetiva (mm), um por intervalo Δt.
    """
    u = np.array(huo["ordenadas_m3s_per_mm"], dtype=float)
    p = np.array(hietograma_efetivo_mm, dtype=float)
    return np.convolve(p, u)
