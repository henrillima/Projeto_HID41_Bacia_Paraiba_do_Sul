"""
Curvas IDF — equação regional pré-publicada.

Conforme HID41_Projeto2_Metodologia.md (etapa 9, Opção A — IDF pronta):

  i = (a · TR^b) / (t_d + c)^d        [mm/h]

onde TR em anos e t_d em minutos.

Parâmetros default usados aqui correspondem à equação de **Pfafstetter
generalizada** para São José dos Campos (vizinhança da bacia do Paraíba do
Sul cabeceira). Os valores são placeholders típicos da literatura e devem
ser substituídos pela equação confirmada para a cidade de interesse —
o config.yaml controla isso via `idf.parametros`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class IDFRegional:
    """Equação i = a·TR^b / (t_d + c)^d (mm/h, TR em anos, t_d em min)."""

    a: float
    b: float
    c: float
    d: float
    fonte: str = "Pfafstetter (DNOS) — São José dos Campos (placeholder)"

    def intensidade(self, tr_anos: float, t_min: float) -> float:
        """Retorna i em mm/h."""
        if tr_anos <= 0 or t_min < 0:
            raise ValueError("TR e t_d devem ser positivos.")
        return self.a * (tr_anos ** self.b) / ((t_min + self.c) ** self.d)

    def precipitacao(self, tr_anos: float, t_min: float) -> float:
        """Profundidade acumulada P(TR, t_d) = i · t_d/60 em mm."""
        i = self.intensidade(tr_anos, t_min)
        return i * (t_min / 60.0)

    def gerar_curva(
        self,
        trs: list[int],
        duracoes_min: list[float],
    ) -> pd.DataFrame:
        """DataFrame longo (tr × duracao × intensidade)."""
        rows = []
        for tr in trs:
            for t in duracoes_min:
                rows.append({
                    "tr": int(tr),
                    "duracao_min": float(t),
                    "intensidade_mm_h": self.intensidade(tr, t),
                })
        return pd.DataFrame(rows)


# Defaults para SJC; ver docs para troca por outra cidade.
IDF_SJC_DEFAULT = IDFRegional(
    a=1239.7,
    b=0.181,
    c=22.0,
    d=0.890,
    fonte="Pfafstetter / DNOS — São José dos Campos (placeholder; confirmar com fonte oficial)",
)


def from_config(cfg: dict | None = None) -> IDFRegional:
    """Constrói IDFRegional a partir de bloco `idf` em config.yaml."""
    if not cfg:
        return IDF_SJC_DEFAULT
    p = cfg.get("parametros") or {}
    return IDFRegional(
        a=float(p.get("a", IDF_SJC_DEFAULT.a)),
        b=float(p.get("b", IDF_SJC_DEFAULT.b)),
        c=float(p.get("c", IDF_SJC_DEFAULT.c)),
        d=float(p.get("d", IDF_SJC_DEFAULT.d)),
        fonte=cfg.get("fonte", IDF_SJC_DEFAULT.fonte),
    )
