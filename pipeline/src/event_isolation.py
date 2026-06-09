"""
Isolamento de eventos chuva–vazão para construção do Hidrograma Unitário
observado (Fase 3 do Projeto 2).

Conforme HID41_Projeto2_Metodologia.md (etapa 3), um evento útil é:
  - Causado por uma chuva curta e intensa (>= p_min_evento_mm em ≤ duracao_max_dias).
  - Hidrograma com pico bem definido e recessão limpa (sem 2º pico).
  - Fim do escoamento direto na inflexão; aproximado por:
        D_dias ≈ 0,827 · A^0,2     (A em km²)
  - Volume escoado direto convertido em lâmina sobre a bacia:
        h_mm = V / A

Implementação:
  1. Detecta picos em Q via `scipy.signal.find_peaks` (proeminência e
     espaçamento mínimo configuráveis).
  2. Para cada pico, recua até a "inflexão de subida" (onde Q começa a crescer
     após uma queda) e avança D_dias após o pico (ou até Q < Q_base + 5% do
     pico, o que vier primeiro).
  3. Separa a vazão de base do evento por método linha-reta (interpola
     linearmente entre Q no início e no fim do hidrograma direto).
  4. Associa a chuva: soma a chuva do dia anterior ao início até o pico.
  5. Filtra eventos pelos critérios mínimos.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta

import numpy as np
import pandas as pd
from scipy.signal import find_peaks

logger = logging.getLogger(__name__)


@dataclass
class EventoChuvaVazao:
    """Representação de um evento isolado chuva-vazão."""
    id: int
    t_inicio: pd.Timestamp
    t_pico: pd.Timestamp
    t_fim: pd.Timestamp
    duracao_dias: int
    p_total_mm: float           # soma da chuva
    p_efetiva_mm: float | None  # calculada pelo phi-index ou SCS-CN
    q_pico_m3s: float
    q_base_inicio_m3s: float
    q_base_fim_m3s: float
    volume_direto_m3: float
    lamina_mm: float
    hietograma: list[dict] = field(default_factory=list)  # [{data, p_mm}]
    hidrograma: list[dict] = field(default_factory=list)  # [{data, q_total, q_base, q_direto}]


def base_time_scs(area_km2: float) -> float:
    """`D_dias ≈ 0.827 · A^0.2` — tempo aproximado do escoamento direto."""
    if area_km2 is None or area_km2 <= 0:
        return 5.0  # fallback
    return 0.827 * (area_km2 ** 0.2)


def identificar_eventos(
    df_diaria: pd.DataFrame,
    serie_chuva: pd.Series,
    area_km2: float,
    *,
    prominencia_pico_m3s: float | None = None,
    distancia_min_picos_dias: int = 5,
    p_min_evento_mm: float = 20.0,
    duracao_max_dias: int | None = None,
    quantil_pico: float = 0.95,
) -> list[EventoChuvaVazao]:
    """Identifica eventos isolados na série diária.

    Parameters
    ----------
    df_diaria
        DataFrame com colunas `data` (date/datetime) e `vazao_m3s`.
    serie_chuva
        Série pandas de chuva diária média da bacia, em mm. Indexada por data.
    area_km2
        Área de drenagem para conversão Q → lâmina (mm).
    prominencia_pico_m3s
        Proeminência mínima do pico (m³/s). Default = `quantil_pico` da série.
    distancia_min_picos_dias
        Espaçamento mínimo entre picos detectados.
    p_min_evento_mm
        Lâmina precipitada mínima para aceitar o evento.
    duracao_max_dias
        Duração máxima total do evento (chuva → fim recessão). Default =
        ceil(D + 2), onde D é o base-time SCS.
    """
    df = df_diaria.copy()
    df["data"] = pd.to_datetime(df["data"])
    df = df.dropna(subset=["vazao_m3s"]).sort_values("data").reset_index(drop=True)
    if df.empty:
        return []

    q = df["vazao_m3s"].to_numpy(dtype=float)
    if prominencia_pico_m3s is None:
        prominencia_pico_m3s = float(np.nanquantile(q, quantil_pico) * 0.3)

    base_time = base_time_scs(area_km2)
    if duracao_max_dias is None:
        # Para bacias grandes a recessão dura muito mais que o D_dias SCS;
        # usamos 4×base_time + 5 com piso de 20 dias para captar eventos reais.
        duracao_max_dias = max(int(np.ceil(base_time * 4 + 5)), 20)

    picos, _ = find_peaks(
        q,
        distance=distancia_min_picos_dias,
        prominence=prominencia_pico_m3s,
    )
    logger.info(
        f"[eventos] {len(picos)} picos detectados (prom>{prominencia_pico_m3s:.1f} m³/s, "
        f"dist>{distancia_min_picos_dias} d). Base-time SCS ≈ {base_time:.1f} d."
    )

    chuva = serie_chuva.reindex(df["data"]).fillna(0.0)
    # Diagnóstico: contadores de quantos picos foram cortados por cada filtro
    cortes = {"duracao": 0, "chuva_baixa": 0}
    eventos: list[EventoChuvaVazao] = []
    for k, idx_pico in enumerate(picos):
        # Recua para encontrar início (último mínimo local antes do pico)
        ini = idx_pico
        while ini > 0 and q[ini - 1] < q[ini]:
            ini -= 1
        # Avança D_dias após o pico, mas para se encontrar próximo pico antes
        fim = min(idx_pico + int(np.ceil(base_time)), len(q) - 1)
        next_peak = picos[k + 1] if k + 1 < len(picos) else len(q)
        if next_peak <= fim:
            fim = next_peak - 1
        duracao_d = (df.loc[fim, "data"] - df.loc[ini, "data"]).days + 1
        if duracao_d <= 0 or duracao_d > duracao_max_dias:
            cortes["duracao"] += 1
            continue

        # Chuva acumulada do evento (inclui dia anterior ao início para captar lag)
        p_inicio = df.loc[ini, "data"] - timedelta(days=1)
        p_fim = df.loc[idx_pico, "data"]
        chuva_evento = chuva.loc[
            (chuva.index >= p_inicio) & (chuva.index <= p_fim)
        ].sum()
        if chuva_evento < p_min_evento_mm:
            cortes["chuva_baixa"] += 1
            continue

        # Base linear entre os extremos (método da linha reta)
        q_base_ini = float(q[ini])
        q_base_fim = float(q[fim])
        n_pts = fim - ini + 1
        base = np.linspace(q_base_ini, q_base_fim, n_pts)
        direto = q[ini : fim + 1] - base
        direto = np.maximum(direto, 0.0)

        # Volume escoado direto (m³): Σ Q * Δt (Δt = 86400 s)
        volume = float(direto.sum() * 86400.0)
        # Lâmina (mm) sobre a bacia: V / A / 1000 → V em m³, A em km² → mm.
        # 1 mm sobre 1 km² = 1000 m³.
        lamina_mm = volume / (area_km2 * 1000.0) if area_km2 > 0 else 0.0

        hietograma = [
            {"data": d.date().isoformat(), "p_mm": float(p)}
            for d, p in chuva.loc[
                (chuva.index >= p_inicio) & (chuva.index <= p_fim)
            ].items()
        ]
        hidrograma = [
            {
                "data": df.loc[i, "data"].date().isoformat(),
                "q_total": float(q[i]),
                "q_base": float(base[i - ini]),
                "q_direto": float(direto[i - ini]),
            }
            for i in range(ini, fim + 1)
        ]

        eventos.append(EventoChuvaVazao(
            id=len(eventos) + 1,
            t_inicio=df.loc[ini, "data"],
            t_pico=df.loc[idx_pico, "data"],
            t_fim=df.loc[fim, "data"],
            duracao_dias=duracao_d,
            p_total_mm=float(chuva_evento),
            p_efetiva_mm=None,
            q_pico_m3s=float(q[idx_pico]),
            q_base_inicio_m3s=q_base_ini,
            q_base_fim_m3s=q_base_fim,
            volume_direto_m3=volume,
            lamina_mm=float(lamina_mm),
            hietograma=hietograma,
            hidrograma=hidrograma,
        ))

    logger.info(
        f"[eventos] {len(eventos)} eventos válidos | "
        f"cortados — duração: {cortes['duracao']}, chuva<{p_min_evento_mm}mm: {cortes['chuva_baixa']}"
    )
    return eventos


def calcular_phi_index(evento: EventoChuvaVazao) -> float:
    """Determina o índice φ (em **mm/dia**) que casa o volume da chuva efetiva
    com a lâmina escoada direta.

    Aproximação iterativa (bissecção): φ tal que `Σ max(P_i − φ, 0) = lamina_mm`.
    Como o passo de chuva é diário (cada P_i é a chuva do dia em mm), φ tem
    unidade de mm/dia. Para mm/h, dividir por 24.
    """
    chuvas_mm = np.array([h["p_mm"] for h in evento.hietograma], dtype=float)
    target = evento.lamina_mm
    if target <= 0 or chuvas_mm.sum() <= 0:
        return 0.0
    lo, hi = 0.0, chuvas_mm.max()
    for _ in range(50):
        phi = 0.5 * (lo + hi)
        pe = np.maximum(chuvas_mm - phi, 0.0).sum()
        if pe > target:
            lo = phi
        else:
            hi = phi
    return 0.5 * (lo + hi)
