"""
Preenchimento de falhas na estação de referência usando duas abordagens:

  1. Regressão linear múltipla
     Treina com o período comum (todas as estações com dado) e aplica para
     dias onde a referência tem NaN mas ao menos uma auxiliar tem dado.

  2. IDW (Inverse Distance Weighting)
     Usa distâncias haversine entre estações. Para cada dia com NaN na
     referência, pondera as auxiliares disponíveis pelo inverso da distância^p.

Validação:
  O mesmo conjunto de holdout (10% do período comum, selecionado com seed
  fixo) é usado para ambos os métodos, garantindo comparação justa.
  O vencedor é o de menor RMSE no holdout.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
from haversine import haversine, Unit
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error

logger = logging.getLogger(__name__)


def _holdout_mask(
    df_comum: pd.DataFrame,
    holdout_pct: float,
    random_state: int,
) -> pd.Series:
    """Retorna máscara booleana True para linhas reservadas ao holdout."""
    n = len(df_comum)
    n_holdout = max(1, int(round(n * holdout_pct)))
    rng = np.random.default_rng(random_state)
    idx = rng.choice(n, size=n_holdout, replace=False)
    mask = pd.Series(False, index=df_comum.index)
    mask.iloc[idx] = True
    return mask


def fill_regressao_multipla(
    df_pivot: pd.DataFrame,
    estacao_ref: str,
    estacoes_aux: list[str],
    holdout_pct: float = 0.10,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Regressão linear múltipla para preenchimento de falhas.

    Parameters
    ----------
    df_pivot : DataFrame com index=data, colunas=códigos das estações
    estacao_ref : código da estação de referência
    estacoes_aux : lista de códigos das estações auxiliares
    holdout_pct : fração do período comum reservada para validação
    random_state : semente para reprodutibilidade

    Returns
    -------
    dict com:
        equacao (str legível), coeficientes (dict), intercepto (float),
        r2_treino (float), rmse_holdout (float), n_preenchidos (int),
        serie_preenchida (pd.Series), mascara_preenchidos (pd.Series[bool])
    """
    logger.info("[Regressão] Iniciando preenchimento por regressão múltipla")

    # Período comum: todos os 3+ postos com dado
    colunas = [estacao_ref] + estacoes_aux
    df_comum = df_pivot[colunas].dropna()

    if len(df_comum) < 20:
        raise ValueError(
            f"Período comum insuficiente: apenas {len(df_comum)} dias com dados "
            f"em todas as estações. Mínimo recomendado: 20."
        )

    mask_holdout = _holdout_mask(df_comum, holdout_pct, random_state)
    df_treino = df_comum[~mask_holdout]
    df_holdout = df_comum[mask_holdout]

    X_treino = df_treino[estacoes_aux].values
    y_treino = df_treino[estacao_ref].values
    X_holdout = df_holdout[estacoes_aux].values
    y_holdout = df_holdout[estacao_ref].values

    model = LinearRegression(fit_intercept=True)
    model.fit(X_treino, y_treino)

    r2_treino = float(model.score(X_treino, y_treino))
    y_pred_holdout = model.predict(X_holdout)
    rmse_holdout = float(np.sqrt(mean_squared_error(y_holdout, y_pred_holdout)))

    # Equação legível
    termos = [f"{c:.4f}×P_{cod}" for c, cod in zip(model.coef_, estacoes_aux)]
    equacao = f"P_{estacao_ref} = " + " + ".join(termos) + f" + {model.intercept_:.4f}"

    # Aplica para dias onde ref tem NaN e ao menos todas as auxiliares têm dado
    mascara_preenchidos = pd.Series(False, index=df_pivot.index)
    serie_preenchida = df_pivot[estacao_ref].copy()

    dias_com_falha = df_pivot[df_pivot[estacao_ref].isna()].index
    df_aux_disponivel = df_pivot.loc[dias_com_falha, estacoes_aux].dropna()
    n_preenchidos = 0

    if len(df_aux_disponivel) > 0:
        X_pred = df_aux_disponivel.values
        y_pred = model.predict(X_pred)
        # Evita valores negativos (precipitação não pode ser < 0)
        y_pred = np.clip(y_pred, 0, None)
        serie_preenchida.loc[df_aux_disponivel.index] = y_pred
        mascara_preenchidos.loc[df_aux_disponivel.index] = True
        n_preenchidos = len(df_aux_disponivel)

    logger.info(
        f"[Regressão] R²(treino)={r2_treino:.4f} | "
        f"RMSE(holdout)={rmse_holdout:.4f} mm | "
        f"Dias preenchidos: {n_preenchidos}"
    )
    logger.info(f"[Regressão] {equacao}")

    return {
        "equacao": equacao,
        "coeficientes": {cod: float(c) for cod, c in zip(estacoes_aux, model.coef_)},
        "intercepto": float(model.intercept_),
        "r2_treino": round(r2_treino, 6),
        "rmse_holdout": round(rmse_holdout, 6),
        "n_preenchidos": n_preenchidos,
        "serie_preenchida": serie_preenchida,
        "mascara_preenchidos": mascara_preenchidos,
    }


def fill_idw(
    df_pivot: pd.DataFrame,
    estacao_ref: str,
    estacoes_aux: list[str],
    coords: dict[str, tuple[float, float]],
    expoente: int = 2,
    holdout_pct: float = 0.10,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    IDW (Inverse Distance Weighting) para preenchimento de falhas.

    Parameters
    ----------
    df_pivot : DataFrame com index=data, colunas=códigos das estações
    estacao_ref : código da estação de referência
    estacoes_aux : lista de códigos das estações auxiliares
    coords : {codigo: (lat, lon)} em graus decimais
    expoente : expoente p da distância (default 2)
    holdout_pct, random_state : para validação cruzada idêntica à regressão

    Formula
    -------
    P_ref(t) = Σ_i [ P_i(t) / d_i^p ] / Σ_i [ 1 / d_i^p ]
    onde a soma é apenas sobre as estações com dado no dia t.

    Returns
    -------
    dict com:
        distancias_km (dict), expoente (int), rmse_holdout (float),
        n_preenchidos (int), serie_preenchida (pd.Series),
        mascara_preenchidos (pd.Series[bool])
    """
    logger.info("[IDW] Iniciando preenchimento por IDW")

    # Distâncias haversine (km) entre referência e cada auxiliar
    coord_ref = coords[estacao_ref]
    distancias_km: dict[str, float] = {}
    for cod in estacoes_aux:
        d = haversine(coord_ref, coords[cod], unit=Unit.KILOMETERS)
        distancias_km[cod] = round(d, 3)
        logger.info(f"  Distância {estacao_ref}↔{cod}: {d:.2f} km")

    def _idw_predict(row: pd.Series) -> float:
        """Calcula precipitação estimada para um único dia."""
        numerador = 0.0
        denominador = 0.0
        for cod in estacoes_aux:
            v = row.get(cod)
            if pd.notna(v) and distancias_km[cod] > 0:
                w = 1.0 / (distancias_km[cod] ** expoente)
                numerador += w * v
                denominador += w
        if denominador == 0:
            return np.nan
        return max(0.0, numerador / denominador)

    # Validação usando o mesmo holdout da regressão
    colunas = [estacao_ref] + estacoes_aux
    df_comum = df_pivot[colunas].dropna()

    if len(df_comum) < 10:
        raise ValueError(f"[IDW] Período comum insuficiente: {len(df_comum)} dias.")

    mask_holdout = _holdout_mask(df_comum, holdout_pct, random_state)
    df_holdout = df_comum[mask_holdout]

    y_true = df_holdout[estacao_ref].values
    y_pred_holdout = df_holdout[estacoes_aux].apply(_idw_predict, axis=1).values
    rmse_holdout = float(np.sqrt(mean_squared_error(y_true, y_pred_holdout)))

    # Aplica IDW para dias com NaN na referência
    mascara_preenchidos = pd.Series(False, index=df_pivot.index)
    serie_preenchida = df_pivot[estacao_ref].copy()

    dias_com_falha = df_pivot[df_pivot[estacao_ref].isna()].index
    n_preenchidos = 0

    for data in dias_com_falha:
        row = df_pivot.loc[data, estacoes_aux]
        v = _idw_predict(row)
        if not np.isnan(v):
            serie_preenchida.loc[data] = v
            mascara_preenchidos.loc[data] = True
            n_preenchidos += 1

    logger.info(
        f"[IDW] RMSE(holdout)={rmse_holdout:.4f} mm | "
        f"Dias preenchidos: {n_preenchidos}"
    )

    return {
        "distancias_km": distancias_km,
        "expoente": expoente,
        "rmse_holdout": round(rmse_holdout, 6),
        "n_preenchidos": n_preenchidos,
        "serie_preenchida": serie_preenchida,
        "mascara_preenchidos": mascara_preenchidos,
    }


def comparar_metodos(
    reg: dict[str, Any],
    idw: dict[str, Any],
) -> dict[str, Any]:
    """
    Compara os dois métodos pelo RMSE no holdout e retorna o vencedor.

    Returns
    -------
    dict com: melhor_metodo, justificativa, rmse_regressao, rmse_idw
    """
    rmse_reg = reg["rmse_holdout"]
    rmse_idw = idw["rmse_holdout"]

    if rmse_reg <= rmse_idw:
        melhor = "regressao"
        justif = (
            f"Regressão múltipla (RMSE={rmse_reg:.4f} mm) superou IDW "
            f"(RMSE={rmse_idw:.4f} mm) no holdout de validação."
        )
    else:
        melhor = "idw"
        justif = (
            f"IDW (RMSE={rmse_idw:.4f} mm) superou regressão múltipla "
            f"(RMSE={rmse_reg:.4f} mm) no holdout de validação."
        )

    logger.info(f"[Comparação] Método vencedor: {melhor.upper()} | {justif}")

    return {
        "melhor_metodo": melhor,
        "justificativa": justif,
        "rmse_regressao": rmse_reg,
        "rmse_idw": rmse_idw,
    }
