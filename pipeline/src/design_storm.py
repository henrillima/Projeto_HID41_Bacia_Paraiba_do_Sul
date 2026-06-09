"""
Chuva de projeto — método dos Blocos Alternados.

Conforme HID41_Projeto2_Metodologia.md (etapa 10):

  1. Define duração total t_d (geralmente = tc da bacia) e número de blocos n;
     Δt = t_d / n.
  2. Para cada t_k = k·Δt (k = 1..n), calcula a intensidade i_k pela IDF
     no TR desejado e a profundidade acumulada P_k = i_k · t_k.
  3. Incrementos: ΔP_k = P_k − P_{k−1}.
  4. Reordena com o maior bloco no centro, alternando antes/depois (padrão
     intermediário). Outros padrões: adiantado (decresce), atrasado (cresce).
"""

from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd

from .idf import IDFRegional

PadraoTemporal = Literal["intermediario", "adiantado", "atrasado"]


def chuva_projeto_blocos_alternados(
    idf: IDFRegional,
    tr_anos: int,
    duracao_total_min: float,
    n_blocos: int,
    *,
    padrao: PadraoTemporal = "intermediario",
) -> pd.DataFrame:
    """Hietograma de projeto por blocos alternados.

    Returns
    -------
    DataFrame com colunas:
      t_min     : instante final de cada bloco (Δt, 2Δt, ...)
      p_mm      : profundidade incremental do bloco (mm)
      i_mm_h    : intensidade equivalente (mm/h) = p_mm / (Δt/60)
    """
    if n_blocos < 2:
        raise ValueError("n_blocos deve ser ≥ 2.")
    if duracao_total_min <= 0:
        raise ValueError("duracao_total_min deve ser > 0.")

    dt = duracao_total_min / n_blocos
    # Profundidade acumulada em cada t_k
    acumulada = np.array([
        idf.precipitacao(tr_anos, (k + 1) * dt) for k in range(n_blocos)
    ])
    incrementos = np.diff(np.concatenate(([0.0], acumulada)))

    # Ordena decrescente para depois alternar
    ordem = np.argsort(incrementos)[::-1]
    decrescentes = incrementos[ordem]

    if padrao == "adiantado":
        seq = decrescentes
    elif padrao == "atrasado":
        seq = decrescentes[::-1]
    else:
        # Intermediário: maior no centro, alternando
        seq = np.zeros(n_blocos, dtype=float)
        centro = n_blocos // 2
        for i, v in enumerate(decrescentes):
            offset = ((i + 1) // 2) * (1 if i % 2 == 0 else -1)
            pos = centro + offset
            # Se pos sair dos limites, encaixa no slot livre mais próximo
            while pos < 0 or pos >= n_blocos or seq[pos] != 0:
                pos += 1 if pos < n_blocos // 2 else -1
                if pos < 0:
                    pos = n_blocos - 1
                if pos >= n_blocos:
                    pos = 0
            seq[pos] = v

    t = np.arange(1, n_blocos + 1) * dt
    return pd.DataFrame({
        "t_min": t,
        "p_mm": seq,
        "i_mm_h": seq / (dt / 60.0),
    })


def hidrograma_projeto_via_hu(
    hietograma_mm: list[float],
    huo_scs_ordenadas: list[float],
    cn: float | None = None,
) -> pd.DataFrame:
    """Combina chuva de projeto + HU SCS para obter hidrograma de projeto.

    Se `cn` for fornecido, aplica SCS-CN ao hietograma antes da convolução.
    """
    from .scs_uh import aplicar_scs    # import local para evitar ciclo
    aplicado = aplicar_scs(
        {"ordenadas_m3s_per_mm": huo_scs_ordenadas},
        hietograma_mm,
        cn=cn,
    )
    return pd.DataFrame({
        "passo": np.arange(len(aplicado["hidrograma_m3s"])),
        "q_m3s": aplicado["hidrograma_m3s"],
    })
