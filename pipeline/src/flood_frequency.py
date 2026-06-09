"""
Análise de frequência de cheias — ajuste de PDFs a vazões máximas anuais e
estimativa de quantis para TR = 5, 10, 25, 50, 100, 500, 1000 anos.

Conforme HID41_Projeto2_Metodologia.md (etapa 8) e Collischonn & Dornelles
cap. 14.

Distribuições candidatas:
  - Gumbel (EV1) — clássico para máximas
  - Generalized Extreme Value (GEV) — superset do Gumbel
  - Log-Normal — boa para variáveis multiplicativas
  - Pearson III (P3) — vazão em escala natural
  - Log-Pearson III (LP3) — vazão em log
"""

from __future__ import annotations

import logging
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

TR_PADRAO: tuple[int, ...] = (2, 5, 10, 25, 50, 100, 500, 1000)
_DISTRIBUICOES_PADRAO = ("gumbel", "gev", "lognormal", "p3", "lp3")


def serie_max_anual_q(
    df_diaria: pd.DataFrame,
    *,
    valor_col: str = "vazao_m3s",
    data_col: str = "data",
    min_dias_ano: int = 330,
) -> pd.DataFrame:
    """Máximo diário por ano (calendário); retorna ano + valor + data.

    Anos com menos de `min_dias_ano` dias válidos são descartados: anos de borda
    do registro (incompletos) produziriam um máximo espúrio que enviesa a
    distribuição de cheias para baixo (ver docs/REVISAO_METODOLOGICA.md B2).
    """
    df = df_diaria[[data_col, valor_col]].copy()
    df[data_col] = pd.to_datetime(df[data_col])
    df = df.dropna(subset=[valor_col])
    if df.empty:
        return pd.DataFrame(columns=["ano", "q_max_m3s", "data_ocorrencia"])
    df["ano"] = df[data_col].dt.year
    # Filtra anos com cobertura insuficiente de dias válidos
    dias_por_ano = df.groupby("ano")[valor_col].count()
    anos_validos = dias_por_ano[dias_por_ano >= min_dias_ano].index
    n_descartados = int(dias_por_ano.shape[0] - len(anos_validos))
    if n_descartados:
        logger.info(
            f"[freq] {n_descartados} ano(s) descartado(s) por < {min_dias_ano} "
            "dias válidos (anos incompletos)."
        )
    df = df[df["ano"].isin(anos_validos)]
    if df.empty:
        return pd.DataFrame(columns=["ano", "q_max_m3s", "data_ocorrencia"])
    out = (
        df.sort_values(valor_col, ascending=False)
        .drop_duplicates("ano")
        .sort_values("ano")
        .rename(columns={valor_col: "q_max_m3s"})[["ano", "q_max_m3s", data_col]]
    )
    out = out.rename(columns={data_col: "data_ocorrencia"})
    out["data_ocorrencia"] = out["data_ocorrencia"].dt.date.astype(str)
    return out.reset_index(drop=True)


def _fit_gumbel(x: np.ndarray) -> dict:
    """Ajuste Gumbel (máximos) por método dos momentos."""
    n = len(x)
    s = float(np.std(x, ddof=1))
    m = float(np.mean(x))
    alpha = s * np.sqrt(6) / np.pi
    u = m - 0.5772 * alpha
    log_lik = float(stats.gumbel_r.logpdf(x, loc=u, scale=alpha).sum())
    return {
        "nome": "gumbel",
        "params": {"loc": u, "scale": alpha},
        "log_lik": log_lik,
        "n_params": 2,
        "metodo": "momentos",
    }


def _fit_gev(x: np.ndarray) -> dict:
    """GEV via MLE (scipy)."""
    shape, loc, scale = stats.genextreme.fit(x)
    log_lik = float(stats.genextreme.logpdf(x, shape, loc=loc, scale=scale).sum())
    return {
        "nome": "gev",
        "params": {"shape": float(shape), "loc": float(loc), "scale": float(scale)},
        "log_lik": log_lik,
        "n_params": 3,
        "metodo": "mle",
    }


def _fit_lognormal(x: np.ndarray) -> dict:
    """LogNormal via momentos em log(x)."""
    log_x = np.log(x)
    mu = float(np.mean(log_x))
    sigma = float(np.std(log_x, ddof=1))
    # scipy.stats.lognorm parametrizado como (s=sigma, scale=exp(mu)):
    log_lik = float(stats.lognorm.logpdf(x, s=sigma, scale=np.exp(mu)).sum())
    return {
        "nome": "lognormal",
        "params": {"mu_log": mu, "sigma_log": sigma},
        "log_lik": log_lik,
        "n_params": 2,
        "metodo": "momentos",
    }


def _fit_pearson3(x: np.ndarray) -> dict:
    """Pearson III via momentos (no espaço natural)."""
    mu = float(np.mean(x))
    sigma = float(np.std(x, ddof=1))
    skew = float(stats.skew(x, bias=False))
    log_lik = float(stats.pearson3.logpdf(x, skew=skew, loc=mu, scale=sigma).sum())
    return {
        "nome": "p3",
        "params": {"loc": mu, "scale": sigma, "skew": skew},
        "log_lik": log_lik,
        "n_params": 3,
        "metodo": "momentos",
    }


def _fit_log_pearson3(x: np.ndarray) -> dict:
    """Log-Pearson III via momentos em log(x)."""
    log_x = np.log(x)
    mu = float(np.mean(log_x))
    sigma = float(np.std(log_x, ddof=1))
    skew = float(stats.skew(log_x, bias=False))
    # log-likelihood: aplica pearson3 ao log + ajuste do jacobiano (1/x)
    log_lik = float(
        stats.pearson3.logpdf(log_x, skew=skew, loc=mu, scale=sigma).sum()
        - np.log(x).sum()
    )
    return {
        "nome": "lp3",
        "params": {"mu_log": mu, "sigma_log": sigma, "skew_log": skew},
        "log_lik": log_lik,
        "n_params": 3,
        "metodo": "momentos",
    }


_FITTERS = {
    "gumbel":    _fit_gumbel,
    "gev":       _fit_gev,
    "lognormal": _fit_lognormal,
    "p3":        _fit_pearson3,
    "lp3":       _fit_log_pearson3,
}


def _quantil(nome: str, p: float, params: dict) -> float:
    if nome == "gumbel":
        return float(stats.gumbel_r.ppf(p, loc=params["loc"], scale=params["scale"]))
    if nome == "gev":
        return float(stats.genextreme.ppf(p, params["shape"], loc=params["loc"], scale=params["scale"]))
    if nome == "lognormal":
        return float(stats.lognorm.ppf(p, s=params["sigma_log"], scale=np.exp(params["mu_log"])))
    if nome == "p3":
        return float(stats.pearson3.ppf(p, skew=params["skew"], loc=params["loc"], scale=params["scale"]))
    if nome == "lp3":
        q_log = float(stats.pearson3.ppf(p, skew=params["skew_log"], loc=params["mu_log"], scale=params["sigma_log"]))
        return float(np.exp(q_log))
    raise ValueError(f"Distribuição desconhecida: {nome}")


def _cdf(nome: str, x: np.ndarray, params: dict) -> np.ndarray:
    if nome == "gumbel":
        return stats.gumbel_r.cdf(x, loc=params["loc"], scale=params["scale"])
    if nome == "gev":
        return stats.genextreme.cdf(x, params["shape"], loc=params["loc"], scale=params["scale"])
    if nome == "lognormal":
        return stats.lognorm.cdf(x, s=params["sigma_log"], scale=np.exp(params["mu_log"]))
    if nome == "p3":
        return stats.pearson3.cdf(x, skew=params["skew"], loc=params["loc"], scale=params["scale"])
    if nome == "lp3":
        return stats.pearson3.cdf(np.log(x), skew=params["skew_log"], loc=params["mu_log"], scale=params["sigma_log"])
    raise ValueError(nome)


def ajustar_distribuicoes(
    valores: Sequence[float],
    *,
    distribuicoes: Sequence[str] = _DISTRIBUICOES_PADRAO,
) -> list[dict]:
    """Ajusta todas as distribuições candidatas e adiciona AIC, BIC, KS."""
    x = np.asarray([v for v in valores if v is not None and not np.isnan(v)], dtype=float)
    n = len(x)
    if n < 5:
        raise ValueError(f"Série muito curta ({n} anos) para análise de frequência.")
    if (x <= 0).any() and ("lp3" in distribuicoes or "lognormal" in distribuicoes):
        raise ValueError("Há valores ≤ 0 — incompatível com LP3 e LogNormal.")

    out: list[dict] = []
    for nome in distribuicoes:
        try:
            fit = _FITTERS[nome](x)
        except Exception as exc:
            logger.warning(f"[freq] {nome} falhou: {exc}")
            continue
        k = fit["n_params"]
        fit["aic"] = float(2 * k - 2 * fit["log_lik"])
        fit["bic"] = float(np.log(n) * k - 2 * fit["log_lik"])
        ks = stats.kstest(x, lambda v: _cdf(nome, v, fit["params"]))
        fit["ks_stat"] = float(ks.statistic)
        fit["ks_pvalue"] = float(ks.pvalue)
        fit["n"] = n
        out.append(fit)
    return out


def selecionar_melhor(fits: list[dict], criterio: str = "aic") -> dict | None:
    """Retorna o melhor ajuste pelo critério dado.

    Ressalvas (ver docs/REVISAO_METODOLOGICA.md M4/M5):
      - AIC/BIC pressupõem verossimilhança maximizada (MLE). Aqui só a GEV é
        ajustada por MLE; as demais usam momentos (padrão do livro-texto). Logo,
        comparar AIC/BIC entre métodos é apenas indicativo e tende a favorecer a
        GEV. Se for esse o critério, emite-se um aviso.
      - O p-valor do KS com parâmetros estimados da própria amostra é otimista;
        use-o como diagnóstico relativo (estatística D menor = melhor), não como
        gate rígido. Em empate, desempata-se pela menor estatística D do KS.
    """
    if not fits:
        return None
    metodos = {f.get("metodo", "?") for f in fits}
    if criterio in ("aic", "bic") and len(metodos) > 1:
        logger.warning(
            f"[freq] critério '{criterio}' compara ajustes de métodos distintos "
            f"({sorted(metodos)}); AIC/BIC assumem MLE e favorecem a GEV. "
            "Tratar como indicativo — considere 'ks' ou inspeção do papel de "
            "probabilidade."
        )
    # Filtra fits que passaram no KS (p ≥ 0.05); se nenhum passar, usa todos.
    aprovados = [f for f in fits if f.get("ks_pvalue", 0) >= 0.05] or fits
    chave = {"aic": "aic", "bic": "bic", "ks": "ks_pvalue"}[criterio]
    reverse = criterio == "ks"     # KS p-valor: maior é melhor
    melhor = sorted(
        aprovados,
        key=lambda f: (f[chave], f.get("ks_stat", np.inf)),
        reverse=reverse,
    )[0]
    return melhor


def quantis_tr(
    fit: dict,
    trs: Sequence[int] = TR_PADRAO,
    *,
    n_bootstrap: int = 1000,
    ic_nivel: float = 0.90,
    x_obs: Sequence[float] | None = None,
    seed: int = 42,
) -> pd.DataFrame:
    """Calcula Q(TR) para a distribuição ajustada com IC bootstrap paramétrico.

    O bootstrap reamostra a série original (x_obs), re-ajusta a distribuição e
    estima o quantil em cada amostra. Se x_obs não for fornecido, gera amostras
    da própria distribuição ajustada.
    """
    nome = fit["nome"]
    params = fit["params"]
    rng = np.random.default_rng(seed)
    quantis: dict[int, float] = {}
    icl: dict[int, float] = {}
    icu: dict[int, float] = {}
    for tr in trs:
        p = 1 - 1 / tr
        quantis[tr] = _quantil(nome, p, params)

    # Bootstrap
    if x_obs is not None and len(x_obs) >= 5:
        x = np.asarray(x_obs, dtype=float)
        n = len(x)
        samples: list[dict[int, float]] = []
        for _ in range(n_bootstrap):
            idx = rng.integers(0, n, size=n)
            try:
                f = _FITTERS[nome](x[idx])
            except Exception:
                continue
            samples.append({tr: _quantil(nome, 1 - 1 / tr, f["params"]) for tr in trs})
        for tr in trs:
            arr = np.array([s[tr] for s in samples if tr in s])
            if len(arr):
                lo = (1 - ic_nivel) / 2
                hi = 1 - lo
                icl[tr] = float(np.quantile(arr, lo))
                icu[tr] = float(np.quantile(arr, hi))

    rows = [
        {
            "tr": int(tr),
            "q_tr_m3s": float(quantis[tr]),
            "ic_lo": float(icl.get(tr, np.nan)),
            "ic_hi": float(icu.get(tr, np.nan)),
        }
        for tr in trs
    ]
    return pd.DataFrame(rows)


def posicao_plotagem_weibull(valores: Sequence[float]) -> pd.DataFrame:
    """Probabilidade empírica de excedência por Weibull (ordem decrescente)."""
    x = np.sort(np.asarray(valores, dtype=float))[::-1]
    n = len(x)
    m = np.arange(1, n + 1)
    p_exc = m / (n + 1)
    tr = 1 / p_exc
    return pd.DataFrame({"q": x, "p_excedencia": p_exc, "tr": tr})
