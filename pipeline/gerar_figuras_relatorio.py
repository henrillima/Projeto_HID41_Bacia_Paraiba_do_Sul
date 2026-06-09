"""
Gera todas as figuras para o relatorio (PNGs em docs/figuras/).
Le os resultados do pipeline diretamente do Supabase.

Uso:
    cd pipeline
    .venv/Scripts/python.exe gerar_figuras_relatorio.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
from dotenv import load_dotenv

ROOT = Path(__file__).parent
PROJ = ROOT.parent
FIGS = PROJ / "docs" / "figuras"
FIGS.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))
from src.supabase_loader import get_client

load_dotenv(ROOT / ".env")
client = get_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# ---------------------------------------------------------------------------
# Estilo global
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "figure.dpi": 110,
    "savefig.dpi": 160,
    "figure.figsize": (10, 5.5),
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.titleweight": "bold",
    "axes.labelsize": 10,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.alpha": 0.25,
    "grid.linestyle": "--",
    "legend.frameon": False,
})

COR_AZUL  = "#00205B"
COR_AZUL2 = "#0048b3"
COR_VERDE = "#10b981"
COR_AMBAR = "#f59e0b"
COR_VERMELHO = "#dc2626"
COR_ROXO  = "#7c3aed"

OUTLET = "58142200"
PLUVIOS_P1 = ["2245048", "2245055", "2345065"]
PLUVIOS_P2 = ["2345019", "2345064", "2245054"]

# ---------------------------------------------------------------------------
# Helpers de leitura (lidam com paginacao do Supabase: limit default 1000)
# ---------------------------------------------------------------------------

def fetch_all(table: str, select: str, **filters) -> pd.DataFrame:
    """Faz paginacao manual para superar o limite de 1000 linhas do Supabase."""
    rows: list[dict] = []
    PAGE = 1000
    offset = 0
    while True:
        q = client.table(table).select(select)
        for k, v in filters.items():
            if isinstance(v, list):
                q = q.in_(k, v)
            else:
                q = q.eq(k, v)
        q = q.range(offset, offset + PAGE - 1)
        r = q.execute()
        chunk = r.data or []
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
    return pd.DataFrame(rows)


def save(fig, name: str):
    out = FIGS / name
    fig.savefig(out, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  >> {out.name}")


# ===========================================================================
# PROJETO 1 — pluviometria
# ===========================================================================

def fig_p1_series_anual():
    """F02 — Total anual de precipitacao das 3 estacoes P1."""
    df = fetch_all("precipitacao_anual", "estacao_codigo, ano, valor, valido",
                   estacao_codigo=PLUVIOS_P1)
    if df.empty:
        return
    df = df[df["valido"] == True].copy()
    nomes = {"2245048": "Pindamonhangaba (ref)",
             "2245055": "Estrada do Cunha",
             "2345065": "São Luís do Paraitinga"}
    fig, ax = plt.subplots()
    for cod, grp in df.groupby("estacao_codigo"):
        grp = grp.sort_values("ano")
        ax.plot(grp["ano"], grp["valor"], marker="o", ms=4,
                label=nomes.get(cod, cod), lw=1.5)
    ax.set_title("Projeto 1 — Precipitação total anual (mm)")
    ax.set_xlabel("Ano")
    ax.set_ylabel("Precipitação anual (mm)")
    ax.legend(loc="lower left", ncol=3)
    save(fig, "F02_pluvio_p1_anual.png")


def fig_p1_histograma_referencia():
    """F03 — Histograma diaria + max diaria anual da estacao referencia."""
    cod_ref = "2245048"
    df = fetch_all("precipitacao_diaria", "data, valor",
                   estacao_codigo=cod_ref)
    if df.empty:
        return
    chuva = df["valor"].dropna()
    chuva = chuva[chuva > 0]  # remove dias sem chuva (zeros) para melhor visual

    df_max = fetch_all("max_diaria_anual", "ano, valor", estacao_codigo=cod_ref)

    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))

    axes[0].hist(chuva, bins=40, color=COR_AZUL, alpha=0.85, edgecolor="white")
    axes[0].axvline(chuva.mean(),   color=COR_VERMELHO, lw=2, label=f"média = {chuva.mean():.1f} mm")
    axes[0].axvline(chuva.median(), color=COR_AMBAR,    lw=2, label=f"mediana = {chuva.median():.1f} mm")
    axes[0].set_title("Histograma — chuva diária (dias com P > 0)")
    axes[0].set_xlabel("Precipitação diária (mm)")
    axes[0].set_ylabel("Frequência (dias)")
    axes[0].legend()

    if not df_max.empty:
        axes[1].bar(df_max["ano"], df_max["valor"], color=COR_AZUL2, alpha=0.85)
        axes[1].axhline(df_max["valor"].mean(), color=COR_VERMELHO, lw=2,
                         label=f"média = {df_max['valor'].mean():.1f} mm")
        axes[1].set_title("Máxima diária por ano")
        axes[1].set_xlabel("Ano")
        axes[1].set_ylabel("Precipitação máxima diária (mm)")
        axes[1].legend()

    fig.suptitle(f"Projeto 1 — estação de referência {cod_ref} (Pindamonhangaba)",
                 y=1.02, fontweight="bold")
    save(fig, "F03_pluvio_p1_histograma_referencia.png")


def fig_p1_preenchimento():
    """F04 — Comparacao Regressao vs IDW na estacao referencia."""
    cod_ref = "2245048"
    r = client.table("preenchimento_resultado").select("*").eq(
        "estacao_referencia", cod_ref).execute().data
    if not r:
        return
    df_metodos = pd.DataFrame(r)

    df_dia = fetch_all("preenchimento_diario",
                       "data, valor_regressao, valor_idw",
                       estacao_codigo=cod_ref)
    if df_dia.empty:
        return
    df_dia = df_dia.dropna(subset=["valor_regressao", "valor_idw"])

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    # Esquerda: scatter regressao vs idw
    axes[0].scatter(df_dia["valor_regressao"], df_dia["valor_idw"],
                    s=10, alpha=0.4, color=COR_AZUL)
    lim = max(df_dia["valor_regressao"].max(), df_dia["valor_idw"].max()) * 1.05
    axes[0].plot([0, lim], [0, lim], ls="--", color="gray", lw=1.2, label="y = x")
    axes[0].set_xlim(0, lim)
    axes[0].set_ylim(0, lim)
    axes[0].set_xlabel("Regressão múltipla (mm)")
    axes[0].set_ylabel("IDW (mm)")
    axes[0].set_title("Preenchimento — valores estimados por método")
    axes[0].legend()

    # Direita: RMSE
    ord_m = df_metodos.sort_values("rmse_holdout")
    cores = [COR_VERDE if v else "#9ca3af" for v in ord_m["is_vencedor"]]
    axes[1].barh(ord_m["metodo"].str.upper(), ord_m["rmse_holdout"],
                  color=cores, alpha=0.9)
    for i, (m, rmse, win) in enumerate(zip(ord_m["metodo"], ord_m["rmse_holdout"],
                                            ord_m["is_vencedor"])):
        suf = "  ← vencedor" if win else ""
        axes[1].text(rmse + 0.05, i, f"{rmse:.3f}{suf}", va="center", fontsize=10)
    axes[1].set_xlabel("RMSE no holdout (mm)")
    axes[1].set_title("Comparação no holdout 10% (seed=42)")
    axes[1].set_xlim(0, ord_m["rmse_holdout"].max() * 1.25)

    fig.suptitle(f"Projeto 1 — preenchimento de falhas na referência {cod_ref}",
                 y=1.02, fontweight="bold")
    save(fig, "F04_pluvio_p1_preenchimento.png")


# ===========================================================================
# PROJETO 2 — fluviometria (Buquirinha II)
# ===========================================================================

def fig_p2_curva_chave():
    """F05 — Curva-chave Q = a(h-h0)^b com medicoes pontuais."""
    medic = fetch_all("curva_chave_medicoes",
                      "cota_m, vazao_m3s, data_medicao",
                      estacao_codigo=OUTLET)
    ajuste = client.table("curva_chave_ajuste").select("*").eq(
        "estacao_codigo", OUTLET).eq("forma", "potencia").eq(
        "vigente", True).execute().data
    if medic.empty or not ajuste:
        return
    p = ajuste[0]["parametros"]
    a, b, h0 = p["a"], p["b"], p["h0"]
    medic = medic.dropna(subset=["cota_m", "vazao_m3s"])

    h_curve = np.linspace(max(h0 + 0.001, medic["cota_m"].min() * 0.95),
                          medic["cota_m"].max() * 1.05, 200)
    q_curve = a * (h_curve - h0) ** b

    fig, ax = plt.subplots()
    ax.scatter(medic["cota_m"], medic["vazao_m3s"], s=22, alpha=0.7,
                color=COR_AZUL, label=f"medições ANA (n={len(medic)})", zorder=3)
    ax.plot(h_curve, q_curve, color=COR_VERMELHO, lw=2.2,
            label=f"Q = {a:.3f}·(h − {h0})$^{{{b:.3f}}}$  |  R² = {ajuste[0]['r2']:.4f}")
    ax.set_yscale("log")
    ax.set_xlabel("Cota h (m)")
    ax.set_ylabel("Vazão Q (m³/s)  [escala log]")
    ax.set_title(f"Projeto 2 — curva-chave da estação {OUTLET} (Buquirinha II)")
    ax.legend()
    save(fig, "F05_curva_chave.png")


def fig_p2_serie_vazao():
    """F06 — Serie diaria e media mensal de vazao."""
    diaria = fetch_all("fluviometria_diaria", "data, vazao_m3s",
                       estacao_codigo=OUTLET)
    mensal = fetch_all("fluviometria_mensal",
                       "ano, mes, vazao_media",
                       estacao_codigo=OUTLET)
    if diaria.empty:
        return
    diaria["data"] = pd.to_datetime(diaria["data"])
    diaria = diaria.sort_values("data")

    if not mensal.empty:
        mensal["data"] = pd.to_datetime(
            mensal["ano"].astype(str) + "-" +
            mensal["mes"].astype(str).str.zfill(2) + "-15"
        )
        mensal = mensal.sort_values("data")

    fig, ax = plt.subplots()
    ax.fill_between(diaria["data"], 0, diaria["vazao_m3s"],
                     alpha=0.18, color=COR_AZUL2, label="diária")
    if not mensal.empty:
        ax.plot(mensal["data"], mensal["vazao_media"], color=COR_AZUL,
                lw=1.3, label="média mensal")
    ax.set_xlabel("Ano")
    ax.set_ylabel("Vazão Q (m³/s)")
    ax.set_title(f"Projeto 2 — série de vazão {OUTLET} (Buquirinha II)")
    ax.legend(loc="upper left")
    save(fig, "F06_serie_vazao.png")


def fig_p2_curva_permanencia():
    """F07 — Curva de permanencia com Q90/Q50/Q10 destacados."""
    perm = fetch_all("curva_permanencia", "percentil, vazao_m3s",
                     estacao_codigo=OUTLET)
    qrows = client.table("quantis_permanencia").select("*").eq(
        "estacao_codigo", OUTLET).execute().data
    if perm.empty or not qrows:
        return
    perm = perm.dropna().sort_values("percentil")
    qmap = qrows[0]

    fig, ax = plt.subplots()
    ax.plot(perm["percentil"], perm["vazao_m3s"], color=COR_AZUL, lw=2)
    ax.set_yscale("log")
    ax.set_xlabel("Probabilidade de excedência (%)")
    ax.set_ylabel("Vazão Q (m³/s)  [escala log]")
    for label, k, cor in [("Q10", "q10", COR_VERMELHO),
                           ("Q50", "q50", COR_AMBAR),
                           ("Q90", "q90", COR_VERDE),
                           ("Q95", "q95", COR_ROXO)]:
        v = qmap.get(k)
        if v is None:
            continue
        p = int(label[1:])
        ax.axhline(v, color=cor, ls=":", lw=1)
        ax.axvline(p, color=cor, ls=":", lw=1)
        ax.plot(p, v, "o", color=cor, ms=8, zorder=4)
        ax.annotate(f"{label} = {v:.2f} m³/s", xy=(p, v),
                    xytext=(p + 5, v * 1.4),
                    fontsize=9, color=cor, fontweight="bold")
    ax.set_title(f"Projeto 2 — curva de permanência {OUTLET} (Weibull)")
    save(fig, "F07_curva_permanencia.png")


def fig_p2_eckhardt():
    """F08 — Hidrograma com separacao Eckhardt (escoamento base)."""
    df = fetch_all("eckhardt_serie",
                   "data, q_total, q_base, q_direto",
                   estacao_codigo=OUTLET)
    if df.empty:
        return
    df["data"] = pd.to_datetime(df["data"])
    df = df.sort_values("data")
    sub = df[(df["data"] >= "2010-01-01") & (df["data"] < "2013-01-01")]
    if sub.empty:
        sub = df.tail(1000)

    parm = client.table("eckhardt_params").select("*").eq(
        "estacao_codigo", OUTLET).execute().data
    bfi = parm[0].get("bfi_global") if parm else None

    fig, ax = plt.subplots()
    ax.fill_between(sub["data"], 0, sub["q_base"],
                     color=COR_VERDE, alpha=0.55, label="escoamento de base")
    ax.fill_between(sub["data"], sub["q_base"], sub["q_total"],
                     color=COR_AZUL2, alpha=0.55, label="escoamento direto")
    ax.plot(sub["data"], sub["q_total"], color=COR_AZUL, lw=1.2,
            label="vazão total")
    titulo = f"Projeto 2 — separação de escoamento (filtro de Eckhardt) — {OUTLET}"
    if bfi is not None:
        titulo += f"   |   BFI = {bfi:.2f}"
    ax.set_title(titulo)
    ax.set_xlabel("Data")
    ax.set_ylabel("Vazão Q (m³/s)")
    ax.legend(loc="upper right")
    save(fig, "F08_eckhardt.png")


def fig_p2_q7_10():
    """F09 — Q7 minimos anuais + Q7,10 estimado."""
    df = fetch_all("q7_minimos_anuais", "ano_hidrologico, q7_m3s, data_ocorrencia",
                   estacao_codigo=OUTLET)
    ajuste = client.table("q7_10_ajuste").select("*").eq(
        "estacao_codigo", OUTLET).execute().data
    if df.empty or not ajuste:
        return
    a = ajuste[0]
    q7_10 = a.get("q7_10_m3s")
    ks_p = a.get("ks_pvalue")
    distrib = a.get("distribuicao", "log_pearson3")

    fig, ax = plt.subplots()
    ax.bar(df["ano_hidrologico"], df["q7_m3s"], color=COR_AZUL, alpha=0.85,
           label="Q$_{7,min}$ anual")
    if q7_10 is not None:
        ax.axhline(q7_10, color=COR_VERMELHO, lw=2.2,
                    label=f"Q$_{{7,10}}$ = {float(q7_10):.3f} m³/s  ({distrib})")
    ax.set_xlabel("Ano hidrológico (out → set)")
    ax.set_ylabel("Q$_{7,min}$ (m³/s)")
    ks_str = f"  |  KS p = {float(ks_p):.3f}" if ks_p is not None else ""
    ax.set_title(f"Projeto 2 — vazão mínima de estiagem Q$_{{7,10}}$ — {OUTLET}{ks_str}")
    ax.legend()
    save(fig, "F09_q7_10.png")


def fig_p2_eventos():
    """F10 — 3 maiores eventos chuva-vazao (subplots)."""
    ev_rows = client.table("eventos_chuva_vazao").select(
        "id, t_inicio, t_fim, t_pico, q_pico_m3s, lamina_mm, p_total_mm, "
        "hietograma, hidrograma"
    ).eq("estacao_codigo", OUTLET).order(
        "q_pico_m3s", desc=True).limit(3).execute().data
    if not ev_rows:
        return
    fig, axes = plt.subplots(3, 1, figsize=(11, 9), sharex=False)
    for ax, ev in zip(axes, ev_rows):
        hietogr = ev.get("hietograma") or []
        hidro   = ev.get("hidrograma") or []
        if not hietogr or not hidro:
            continue
        df_h = pd.DataFrame(hietogr)
        df_q = pd.DataFrame(hidro)
        df_h["data"] = pd.to_datetime(df_h["data"])
        df_q["data"] = pd.to_datetime(df_q["data"])

        ax2 = ax.twinx()
        ax2.invert_yaxis()
        ax2.bar(df_h["data"], df_h["p_mm"], color=COR_AZUL2, alpha=0.7, width=0.7)
        ax2.set_ylabel("Chuva (mm/dia)", color=COR_AZUL2)
        ax2.tick_params(axis="y", labelcolor=COR_AZUL2)

        ax.plot(df_q["data"], df_q["q_total"], color=COR_AZUL, lw=2, label="Q total")
        if "q_base" in df_q.columns:
            ax.fill_between(df_q["data"], 0, df_q["q_base"],
                            color=COR_VERDE, alpha=0.45, label="Q base")
        ax.set_ylabel("Vazão Q (m³/s)", color=COR_AZUL)
        ax.tick_params(axis="y", labelcolor=COR_AZUL)

        ax.set_title(f"Evento {ev['t_inicio'][:10]} → {ev['t_fim'][:10]}   "
                     f"Q_pico = {float(ev['q_pico_m3s']):.1f} m³/s   "
                     f"lâmina = {float(ev['lamina_mm']):.1f} mm   "
                     f"P_total = {float(ev['p_total_mm']):.1f} mm")
        ax.set_xlabel("")
        ax.legend(loc="upper left")

    fig.suptitle(f"Projeto 2 — Top 3 eventos chuva-vazão isolados (estação {OUTLET})",
                 y=1.00, fontweight="bold")
    fig.tight_layout()
    save(fig, "F10_eventos_chuva_vazao.png")


def fig_p2_hu_observado_vs_scs():
    """F11 — HU observado medio vs HU SCS triangular.

    Comparacao em malha DIARIA (a do observado): o SCS horario eh agregado
    para dias somando suas ordenadas por janela de 24 h. Em paralelo,
    mostra-se o SCS na malha horaria nativa em painel separado.
    """
    huo_rows = client.table("hidrograma_unitario_observado").select(
        "dt_dias, ordenadas_m3s_per_mm, n_eventos").eq(
        "estacao_codigo", OUTLET).execute().data

    huscs = client.table("hidrograma_unitario_scs").select(
        "tempos_h, ordenadas_m3s_per_mm, dt_min, tc_min, t_pico_h, qp_m3s_per_mm"
    ).eq("estacao_codigo", OUTLET).execute().data

    if not huo_rows and not huscs:
        return

    # Prepara HU observado (diario)
    huo_medio = next((h for h in huo_rows if h.get("n_eventos")), huo_rows[0]) if huo_rows else None
    huo_ords = huo_medio.get("ordenadas_m3s_per_mm") if huo_medio else None
    huo_dt_dias = huo_medio.get("dt_dias", 1) if huo_medio else 1

    # Prepara HU SCS (horario nativo)
    scs = huscs[0] if huscs else None
    scs_tempos_h = scs.get("tempos_h") if scs else None
    scs_ords     = scs.get("ordenadas_m3s_per_mm") if scs else None
    scs_dt_min   = float(scs.get("dt_min", 60)) if scs else 60
    scs_tc_min   = float(scs.get("tc_min", 0)) if scs else 0

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # --- Painel 1: HU observado medio (escala diaria, com Tp do SCS indicado) ---
    ax = axes[0]
    huo_tp_dias = None
    if huo_ords:
        tempo_dia = np.arange(len(huo_ords)) * huo_dt_dias
        ax.plot(tempo_dia, huo_ords, color=COR_AZUL, lw=2.2, marker="o", ms=5,
                label=f"HU observado médio (n={huo_medio.get('n_eventos','?')} eventos)")
        # truncar a janela ao que importa (ate decaimento)
        n_show = min(len(huo_ords), 25)
        ax.set_xlim(0, n_show * huo_dt_dias)
        # Tp empirico
        i_peak = int(np.argmax(huo_ords))
        huo_tp_dias = i_peak * huo_dt_dias
        ax.axvline(huo_tp_dias, color=COR_AZUL, ls=":", alpha=0.6,
                   label=f"Tp obs. ≈ {huo_tp_dias:.0f} dias")

    if scs and scs.get("t_pico_h") is not None:
        tp_scs_dias = float(scs["t_pico_h"]) / 24.0
        ax.axvline(tp_scs_dias, color=COR_VERMELHO, ls="--", lw=2,
                   label=f"Tp SCS ≈ {float(scs['t_pico_h']):.1f} h ({tp_scs_dias:.2f} d)")
    ax.set_xlabel("Tempo (dias)")
    ax.set_ylabel("q (m³/s/mm)")
    ax.set_title("HU observado médio — malha diária")
    ax.legend(loc="upper right", fontsize=9)

    # --- Painel 2: HU SCS em malha horaria nativa ---
    ax = axes[1]
    if scs_tempos_h and scs_ords:
        ax.plot(scs_tempos_h, scs_ords, color=COR_VERMELHO, lw=2.2,
                label=f"HU SCS triangular (Δt={scs_dt_min:.0f} min)")
        ax.fill_between(scs_tempos_h, 0, scs_ords, color=COR_VERMELHO, alpha=0.18)
    ax.set_xlabel("Tempo (h)")
    ax.set_ylabel("q (m³/s/mm)")
    ax.set_title(f"HU SCS sintético — tc Kirpich = {scs_tc_min:.0f} min")
    ax.legend(loc="upper right", fontsize=9)
    ax.set_xlim(left=0)

    fig.suptitle(
        f"Projeto 2 — Hidrograma Unitário (1 mm efetivo) — estação {OUTLET}\n"
        f"escalas distintas: observado em DIAS (Δt da série), SCS em HORAS — "
        f"comparação direta inválida; reportar Tp lado-a-lado",
        fontweight="bold", fontsize=11,
    )
    fig.tight_layout(rect=[0, 0, 1, 0.90])
    save(fig, "F11_hu_observado_vs_scs.png")


def fig_p2_frequencia_cheias():
    """F12 — Distribuicoes ajustadas + Q(TR) com IC."""
    aj = client.table("frequencia_ajuste").select("*").eq(
        "estacao_codigo", OUTLET).execute().data
    qtrs = client.table("frequencia_quantis").select("*").eq(
        "estacao_codigo", OUTLET).order("tr").execute().data
    max_anual = fetch_all("max_anual_vazao", "ano, q_max_m3s",
                         estacao_codigo=OUTLET)
    if not qtrs or max_anual.empty:
        return
    qtrs_df = pd.DataFrame(qtrs)

    rec = next((a for a in aj if a.get("recomendado")), aj[0] if aj else None)
    nome_rec = rec.get("distribuicao", "?") if rec else "?"

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    ax = axes[0]
    vals = pd.to_numeric(max_anual["q_max_m3s"], errors="coerce").dropna().values
    ax.hist(vals, bins=12, density=True, color="#cbd5e1", alpha=0.75,
            edgecolor="white", label="empírica (AMS)")
    ax.set_xlabel("Q máxima anual (m³/s)")
    ax.set_ylabel("Densidade")
    ax.set_title(f"AMS — {len(vals)} anos | dist. recomendada: {nome_rec.upper()}")
    ax.legend()

    ax = axes[1]
    rec_q = qtrs_df[qtrs_df["distribuicao"] == nome_rec].sort_values("tr")
    if not rec_q.empty:
        ax.plot(rec_q["tr"], rec_q["q_tr_m3s"], color=COR_VERMELHO,
                lw=2.3, marker="o", label=f"{nome_rec.upper()} (estimativa)")
        if rec_q["ic_lo"].notna().any():
            ax.fill_between(rec_q["tr"], rec_q["ic_lo"], rec_q["ic_hi"],
                            color=COR_VERMELHO, alpha=0.18, label="IC 90% (bootstrap)")
    for d in qtrs_df["distribuicao"].unique():
        if d == nome_rec:
            continue
        sub = qtrs_df[qtrs_df["distribuicao"] == d].sort_values("tr")
        ax.plot(sub["tr"], sub["q_tr_m3s"], color="#9ca3af",
                lw=1.1, alpha=0.7, label=d.upper())
    ax.set_xscale("log")
    ax.set_xlabel("Tempo de retorno TR (anos)")
    ax.set_ylabel("Q$_{TR}$ (m³/s)")
    ax.set_title("Vazões de projeto Q(TR)")
    ax.legend(loc="upper left", fontsize=8)

    fig.suptitle(f"Projeto 2 — Análise de frequência de cheias — {OUTLET}",
                 y=1.02, fontweight="bold")
    save(fig, "F12_frequencia_cheias.png")


def fig_p2_idf():
    """F13 — Curvas IDF (intensidade x duracao para varios TR)."""
    rows = client.table("idf_curva").select(
        "tr, duracao_min, intensidade_mm_h").order(
        "tr").order("duracao_min").execute().data
    if not rows:
        return
    df = pd.DataFrame(rows)
    df["tr"] = pd.to_numeric(df["tr"])
    df["duracao_min"] = pd.to_numeric(df["duracao_min"])
    df["intensidade_mm_h"] = pd.to_numeric(df["intensidade_mm_h"])
    fig, ax = plt.subplots()
    for tr in sorted(df["tr"].unique()):
        sub = df[df["tr"] == tr].sort_values("duracao_min")
        ax.plot(sub["duracao_min"], sub["intensidade_mm_h"],
                marker="o", ms=4, lw=1.6, label=f"TR = {int(tr)} anos")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Duração da chuva (min)")
    ax.set_ylabel("Intensidade i (mm/h)  [escala log]")
    ax.set_title("Projeto 2 — Curvas IDF — São José dos Campos (Ferreira & Waltz 2001)")
    ax.legend(loc="lower left", ncol=2, fontsize=8)
    save(fig, "F13_idf.png")


def fig_p2_chuva_projeto():
    """F14 — Chuva de projeto (blocos alternados) para TR=10 e TR=100."""
    rows = client.table("chuva_projeto").select("*").execute().data
    if not rows:
        return
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.0), sharey=True)
    for ax, tr in zip(axes, [10, 100]):
        r = next((x for x in rows if int(x.get("tr", -1)) == tr), None)
        if not r or not r.get("hietograma"):
            continue
        df = pd.DataFrame(r["hietograma"])
        col_p = "p_mm" if "p_mm" in df.columns else "chuva_mm"
        ax.bar(df["t_min"], df[col_p], width=float(r.get("dt_min", 10)) * 0.85,
               color=COR_AZUL2 if tr == 10 else COR_VERMELHO, alpha=0.85,
               edgecolor="white")
        ax.set_xlabel("Tempo (min)")
        if tr == 10:
            ax.set_ylabel("Precipitação no bloco (mm)")
        ax.set_title(
            f"TR = {tr} anos  ·  total = {df[col_p].sum():.1f} mm\n"
            f"Δt = {r.get('dt_min', '?')} min  |  padrão {r.get('padrao', '?')}",
            fontsize=11,
        )
    fig.suptitle("Projeto 2 — Chuva de projeto (blocos alternados) — São José dos Campos",
                 fontweight="bold", fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.93])
    save(fig, "F14_chuva_projeto.png")


# ===========================================================================
# Pluviometria P2 — chuva da bacia
# ===========================================================================

def fig_p2_validacao_excel():
    """F16 — Validacao cruzada: curva de permanencia Excel (Parte 1) vs pipeline.

    Confronta os 19 pontos tabelados na planilha Curva de Permanencia do
    Excel da Parte 1 com a curva calculada pelo pipeline na MESMA janela
    (1980-10-01 a 2010-09-30) e parametros (Weibull, ordenada decrescente).
    Demonstra que o metodo de calculo e identico.
    """
    import openpyxl  # noqa: F401  (ensure available)
    XLSX_NAME = "Projeto2_parte1_HID41_Gustavo_Henri_PedroFeitosa (1).xlsx"
    xlsx = PROJ / XLSX_NAME
    if not xlsx.exists():
        print(f"  (excel nao encontrado em {xlsx}, pulando)")
        return

    # Curva do Excel
    raw = pd.read_excel(xlsx, sheet_name="Curva de Permanência", header=None)
    perm = raw.iloc[11:, [6, 7]].copy()
    perm.columns = ["permanencia", "vazao_q"]
    perm = perm.apply(pd.to_numeric, errors="coerce").dropna().sort_values("permanencia")

    # Streamflow do Excel (na mesma janela)
    sf_excel = pd.to_numeric(raw.iloc[11:, 3], errors="coerce").dropna().values

    # Curva do pipeline na MESMA janela
    rows = fetch_all("fluviometria_diaria", "data, vazao_m3s", estacao_codigo=OUTLET)
    if rows.empty:
        return
    rows["data"] = pd.to_datetime(rows["data"])
    rows["vazao_m3s"] = pd.to_numeric(rows["vazao_m3s"], errors="coerce")
    mask = (rows["data"] >= "1980-10-01") & (rows["data"] <= "2010-09-30")
    q_pipe = rows.loc[mask, "vazao_m3s"].dropna().values

    # Plotting curve from pipeline (Weibull)
    q_sorted = np.sort(q_pipe)[::-1]
    n = len(q_sorted)
    p_pipe = np.arange(1, n + 1) / (n + 1) * 100  # %

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Esquerda: curvas sobrepostas
    ax = axes[0]
    ax.plot(p_pipe, q_sorted, color=COR_AZUL, lw=2.2,
            label=f"Pipeline (n={n:,} dias)")
    ax.scatter(perm["permanencia"] * 100, perm["vazao_q"],
               color=COR_VERMELHO, s=70, zorder=5,
               edgecolor="white", linewidth=1.5,
               label="Excel — Parte 1 (19 quantis tabelados)")
    ax.set_yscale("log")
    ax.set_xlabel("Probabilidade de excedência (%)")
    ax.set_ylabel("Vazão Q (m³/s)  [escala log]")
    ax.set_title("Curva de permanência — pipeline × Excel (mesma janela)")
    ax.legend(loc="upper right")

    # Direita: tabela comparativa
    ax = axes[1]
    ax.axis("off")
    p_alvo = [5, 10, 25, 50, 75, 90, 95]
    rows_table = [["P% exc.", "Excel (m³/s)", "Pipeline", "Δ (%)"]]
    for p in p_alvo:
        # excel
        v_x = perm.loc[np.isclose(perm["permanencia"], p / 100), "vazao_q"]
        v_x = float(v_x.iloc[0]) if not v_x.empty else np.nan
        # pipeline
        v_p = float(np.quantile(q_pipe, 1 - p / 100))
        delta = (v_p - v_x) / v_x * 100 if v_x else np.nan
        rows_table.append([f"Q{p}%", f"{v_x:.2f}", f"{v_p:.2f}",
                           f"{delta:+.2f}%"])
    # Estatisticas agregadas
    rows_table.append(["", "", "", ""])
    rows_table.append(["média",
                       f"{sf_excel.mean():.2f}",
                       f"{q_pipe.mean():.2f}",
                       f"{(q_pipe.mean()-sf_excel.mean())/sf_excel.mean()*100:+.2f}%"])
    rows_table.append(["máx.",
                       f"{sf_excel.max():.2f}",
                       f"{q_pipe.max():.2f}",
                       f"{(q_pipe.max()-sf_excel.max())/sf_excel.max()*100:+.2f}%"])
    rows_table.append(["BFI Eckhardt", "0.7548", "0.7425", "-1.23 p.p."])
    rows_table.append(["n (dias)",
                       f"{len(sf_excel):,}", f"{n:,}",
                       f"{(n-len(sf_excel))/len(sf_excel)*100:+.1f}%"])

    tbl = ax.table(cellText=rows_table, loc="center", cellLoc="center",
                   colWidths=[0.22, 0.26, 0.26, 0.26])
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(10)
    tbl.scale(1, 1.55)
    # cabeçalho
    for j in range(4):
        tbl[0, j].set_facecolor("#00205B")
        tbl[0, j].set_text_props(color="white", weight="bold")
    ax.set_title("Validação numérica (mesma janela do Excel: 1980-10 a 2010-09)")

    fig.suptitle(
        f"Projeto 2 — Validação cruzada vs Parte 1 (Excel) — estação {OUTLET}",
        fontweight="bold", fontsize=12,
    )
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    save(fig, "F16_validacao_vs_excel.png")


def fig_p2_pluvio_anual():
    """F15 — Total anual das 3 estacoes P2 (dentro/proximo da bacia)."""
    # Soma anual a partir da serie diaria (precipitacao_anual nao foi populada para P2)
    df = fetch_all("precipitacao_diaria", "estacao_codigo, data, valor",
                   estacao_codigo=PLUVIOS_P2)
    if df.empty:
        return
    df["data"] = pd.to_datetime(df["data"])
    df["ano"] = df["data"].dt.year
    nomes = {"2245054": "Monteiro Lobato (22,6 km — cabeceiras)",
             "2345064": "Buquirinha (1,3 km — dentro da bacia)",
             "2345019": "São José dos Campos (7,0 km — foz)"}

    fig, ax = plt.subplots()
    for cod, grp in df.groupby("estacao_codigo"):
        anu = grp.groupby("ano")["valor"].sum().reset_index()
        # so anos com >300 dias
        cont = grp.groupby("ano").size()
        anu = anu[anu["ano"].isin(cont[cont >= 300].index)]
        ax.plot(anu["ano"], anu["valor"], marker="o", ms=4,
                label=nomes.get(cod, cod), lw=1.5)
    ax.set_title("Projeto 2 — Pluviômetros P2 — precipitação total anual (chuva-vazão)")
    ax.set_xlabel("Ano")
    ax.set_ylabel("Precipitação anual (mm)")
    ax.legend(loc="lower left")
    save(fig, "F15_pluvio_p2_anual.png")


# ===========================================================================
# Main
# ===========================================================================

def main():
    print(f"Gerando figuras em {FIGS}\n")
    figs = [
        fig_p1_series_anual,
        fig_p1_histograma_referencia,
        fig_p1_preenchimento,
        fig_p2_curva_chave,
        fig_p2_serie_vazao,
        fig_p2_curva_permanencia,
        fig_p2_eckhardt,
        fig_p2_q7_10,
        fig_p2_eventos,
        fig_p2_hu_observado_vs_scs,
        fig_p2_frequencia_cheias,
        fig_p2_idf,
        fig_p2_chuva_projeto,
        fig_p2_pluvio_anual,
        fig_p2_validacao_excel,
    ]
    for f in figs:
        try:
            print(f"[{f.__name__}]")
            f()
        except Exception as e:
            print(f"  !! erro: {e}")
    print(f"\nFiguras geradas em: {FIGS}")


if __name__ == "__main__":
    main()
