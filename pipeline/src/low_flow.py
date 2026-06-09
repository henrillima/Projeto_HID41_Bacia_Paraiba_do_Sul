"""
Vazão mínima de referência Q7,10 — análise de frequência de mínimos.

Conforme HID41_Projeto2_Metodologia.md (etapa 6):

  1. Para cada ano da série, calcular a média móvel de 7 dias da vazão e
     tomar o mínimo anual dessas médias → série Q7_min (uma por ano).
  2. Ajustar uma distribuição de mínimos. Padrão brasileiro: Log-Pearson III
     (LP3) ajustada por método dos momentos sobre log(Q7).
  3. Q7,10 = quantil correspondente a probabilidade de não-excedência 10%
     (TR = 10 anos para mínimos).
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def serie_q7(serie_diaria: pd.Series, janela_dias: int = 7) -> pd.Series:
    """Média móvel central (default 7 dias) da vazão diária."""
    return serie_diaria.astype(float).rolling(janela_dias, min_periods=janela_dias).mean()


def minimos_anuais_q7(
    serie_q7_val: pd.Series,
    *,
    ano_hidrologico_inicio_mes: int = 10,
) -> pd.DataFrame:
    """Extrai o Q7 mínimo de cada ano hidrológico (default: out → set).

    Parameters
    ----------
    serie_q7_val
        Série Q7 diária (média móvel já calculada), indexada por data.
    ano_hidrologico_inicio_mes
        Mês inicial do ano hidrológico (1–12). Para SE do Brasil, 10 (out).

    Returns
    -------
    DataFrame com colunas: ano_hidrologico, q7_m3s, data_ocorrencia.
    """
    s = serie_q7_val.dropna()
    if s.empty:
        return pd.DataFrame(columns=["ano_hidrologico", "q7_m3s", "data_ocorrencia"])

    # Ano hidrológico: se mês ≥ ano_hidrologico_inicio_mes, é o próprio ano + 1;
    # caso contrário, é o ano corrente.
    meses = s.index.month
    anos_hidro = np.where(
        meses >= ano_hidrologico_inicio_mes,
        s.index.year + 1,
        s.index.year,
    )

    df = pd.DataFrame({"q7": s.values, "data": s.index, "ano_hidro": anos_hidro})
    out_rows = []
    for ano, grp in df.groupby("ano_hidro"):
        # Exige que o ano hidrológico esteja "completo" o suficiente (≥ 300 dias)
        if len(grp) < 300:
            continue
        idx_min = grp["q7"].idxmin()
        out_rows.append({
            "ano_hidrologico": int(ano),
            "q7_m3s": float(grp.loc[idx_min, "q7"]),
            "data_ocorrencia": grp.loc[idx_min, "data"].date().isoformat(),
        })
    return pd.DataFrame(out_rows).sort_values("ano_hidrologico").reset_index(drop=True)


def ajustar_log_pearson_iii(
    minimos: pd.Series | list,
    *,
    prob_nao_excedencia: float = 0.10,
) -> dict:
    """Ajusta LP3 por método dos momentos em log(Q) e estima Q_p.

    Para mínimos com TR = 10 anos, prob_nao_excedencia = 1/10 = 0.10.

    Returns
    -------
    {
      "distribuicao": "log_pearson3",
      "parametros": {"mu": ..., "sigma": ..., "skew_log": ...},
      "q_estimado": <float>,        # Q7,10
      "n": <int>,
      "ks_pvalue": <float>,
      "tr_anos": <float>,
    }
    """
    vals = pd.Series(minimos).dropna().astype(float).to_numpy()
    n = len(vals)
    if n < 5:
        raise ValueError(f"Série muito curta ({n} anos) para ajuste LP3.")

    if (vals <= 0).any():
        raise ValueError("LP3 requer todos os valores > 0.")

    log_vals = np.log(vals)
    mu = float(np.mean(log_vals))
    sigma = float(np.std(log_vals, ddof=1))
    skew = float(stats.skew(log_vals, bias=False))

    # Pearson III no espaço log: alpha = 4/skew², beta = sigma*|skew|/2,
    # loc = mu - 2*sigma/skew (se skew != 0). scipy.stats.pearson3 usa
    # parametrização: skew, loc, scale (com escala = sigma e loc = mu).
    if abs(skew) < 1e-6:
        # Cai em LogNormal — tratamos via norm em log
        z = stats.norm.ppf(prob_nao_excedencia)
        q = float(np.exp(mu + z * sigma))
    else:
        # scipy.stats.pearson3.ppf usa (skew=skew, loc=mu, scale=sigma)
        q_log = stats.pearson3.ppf(prob_nao_excedencia, skew=skew, loc=mu, scale=sigma)
        q = float(np.exp(q_log))

    # KS test: compara distribuição empírica de log_vals com Pearson3 ajustada
    ks = stats.kstest(log_vals, "pearson3", args=(skew, mu, sigma))
    return {
        "distribuicao": "log_pearson3",
        "parametros": {"mu_log": mu, "sigma_log": sigma, "skew_log": skew},
        "q_estimado": q,
        "n": int(n),
        "ks_pvalue": float(ks.pvalue),
        "tr_anos": 1.0 / prob_nao_excedencia,
    }


def calcular_q7_10(
    serie_vazao: pd.Series,
    *,
    janela_dias: int = 7,
    ano_hidrologico_inicio_mes: int = 10,
) -> dict:
    """Pipeline completo: série diária → Q7 → mínimos anuais → LP3 → Q7,10.

    Returns
    -------
    dict com chaves "ajuste", "minimos_anuais" e métricas.
    """
    q7 = serie_q7(serie_vazao, janela_dias=janela_dias)
    minimos = minimos_anuais_q7(q7, ano_hidrologico_inicio_mes=ano_hidrologico_inicio_mes)
    if minimos.empty:
        raise ValueError("Sem mínimos anuais válidos (anos hidrológicos incompletos).")
    ajuste = ajustar_log_pearson_iii(minimos["q7_m3s"], prob_nao_excedencia=0.10)
    return {
        "ajuste": ajuste,
        "minimos_anuais": minimos,
        "q7_10_m3s": ajuste["q_estimado"],
        "n_anos": len(minimos),
        "ks_pvalue": ajuste["ks_pvalue"],
    }
