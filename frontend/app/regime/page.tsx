"use client";

import { useEffect, useState } from "react";
import { Droplets, GitBranch, TrendingDown } from "lucide-react";

import { useEstacoesFluvio } from "@/hooks/useEstacoesFluvio";
import {
  useCurvaPermanencia,
  useEckhardtParams,
  useEckhardtSerie,
  useQ710Ajuste,
  useQ7Minimos,
  useQuantisPermanencia,
} from "@/hooks/useRegime";

import { CurvaPermanencia } from "@/components/charts/CurvaPermanencia";
import { HidrogramaSeparado } from "@/components/charts/HidrogramaSeparado";
import { AjusteLowFlow } from "@/components/charts/AjusteLowFlow";
import { KPICard } from "@/components/KPICard";

import { fmtVazao } from "@/lib/utils";

type Tab = "permanencia" | "eckhardt" | "q7_10";
const TABS: { key: Tab; label: string; icon: typeof Droplets }[] = [
  { key: "permanencia", label: "Permanência",         icon: Droplets },
  { key: "eckhardt",    label: "Escoamento de base",  icon: GitBranch },
  { key: "q7_10",       label: "Vazão mínima Q7,10",  icon: TrendingDown },
];

export default function RegimePage() {
  const { data: estacoes, loading: ldE } = useEstacoesFluvio();
  const [stationIdx, setStationIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("permanencia");

  useEffect(() => {
    if (estacoes.length === 0) return;
    let idx = estacoes.findIndex((e) => e.is_outlet);
    if (idx < 0) idx = 0;
    setStationIdx(idx);
  }, [estacoes]);

  const codigo = estacoes[stationIdx]?.codigo ?? "";

  const { data: perm,    loading: ldP }   = useCurvaPermanencia(codigo);
  const { data: quantis, loading: ldQ }   = useQuantisPermanencia(codigo);
  const { data: eckSerie, loading: ldES } = useEckhardtSerie(codigo);
  const { data: eckParams }               = useEckhardtParams(codigo);
  const { data: q7Min }                   = useQ7Minimos(codigo);
  const { data: q710 }                    = useQ710Ajuste(codigo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Droplets className="h-6 w-6 text-blue-700" />
          Regime de vazões
        </h1>
        <p className="mt-1 text-slate-500">
          Curva de permanência (Q90/Q50/Q10), separação dos escoamentos
          (filtro de Eckhardt) e vazão mínima de referência Q7,10.
        </p>
      </div>

      {/* Seletor de estação */}
      {estacoes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {estacoes.map((e, i) => (
            <button
              key={e.codigo}
              onClick={() => setStationIdx(i)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                i === stationIdx
                  ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {e.codigo} {e.is_outlet && <span className="text-amber-600">★</span>}{" "}
              <span className="text-slate-500">{e.nome}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPIs globais */}
      <div className="grid gap-3 sm:grid-cols-5">
        <KPICard titulo="Q10" valor={fmtVazao(quantis?.q10)} subtitulo="vazões altas frequentes" />
        <KPICard titulo="Q50 (mediana)" valor={fmtVazao(quantis?.q50)} />
        <KPICard titulo="Q90 (outorga)" valor={fmtVazao(quantis?.q90)} destaque />
        <KPICard
          titulo="BFI global"
          valor={eckParams?.bfi_global != null ? eckParams.bfi_global.toFixed(3) : "—"}
          subtitulo={`α = ${eckParams?.alpha?.toFixed(4) ?? "—"} · k = ${eckParams?.k_dias?.toFixed(1) ?? "—"} d`}
        />
        <KPICard
          titulo="Q7,10 (ecológica)"
          valor={fmtVazao(q710?.q7_10_m3s)}
          subtitulo={`LP3 · KS p=${q710?.ks_pvalue?.toFixed(3) ?? "—"} · n=${q710?.n_anos ?? "—"}`}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                tab === t.key
                  ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das abas */}
      {tab === "permanencia" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Curva de permanência (eixo Y log)
            </h3>
            {ldP ? (
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                Carregando…
              </div>
            ) : perm.length > 0 ? (
              <CurvaPermanencia pontos={perm} quantis={quantis} yLog />
            ) : (
              <p className="text-sm text-slate-500">
                Pipeline ainda não populou a curva. Rode{" "}
                <code className="rounded bg-slate-100 px-1">python pipeline_fluvio.py</code>.
              </p>
            )}
          </div>
          {quantis && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-semibold text-slate-700">
                Vazões de referência (todos os percentis)
              </h3>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {([
                  ["Q1",  quantis.q1],  ["Q5",  quantis.q5],  ["Q10", quantis.q10],
                  ["Q25", quantis.q25], ["Q50", quantis.q50], ["Q75", quantis.q75],
                  ["Q90", quantis.q90], ["Q95", quantis.q95], ["Q99", quantis.q99],
                ] as [string, number | null][]).map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-slate-50 p-3 text-center">
                    <p className="text-xs font-semibold uppercase text-slate-500">{k}</p>
                    <p className="mt-1 font-mono text-sm text-slate-800">{fmtVazao(v)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Razão Q10/Q90 ={" "}
                <strong>{quantis.razao_q10_q90?.toFixed(2) ?? "—"}</strong> —
                índice de variabilidade do regime (quanto maior, mais "torrencial").
                Declividade log (entre P=10% e 90%) = {quantis.declividade_log?.toFixed(4) ?? "—"}.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "eckhardt" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Separação de escoamentos (Eckhardt 2005)
            </h3>
            {ldES ? (
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                Carregando…
              </div>
            ) : eckSerie.length > 0 ? (
              <HidrogramaSeparado serie={eckSerie} />
            ) : (
              <p className="text-sm text-slate-500">Aguardando pipeline.</p>
            )}
          </div>
          {eckParams && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-semibold text-slate-700">
                Parâmetros do filtro
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <KPICard
                  titulo="α (constante recessão)"
                  valor={eckParams.alpha?.toFixed(4) ?? "—"}
                  subtitulo={`k = ${eckParams.k_dias?.toFixed(1) ?? "—"} dias`}
                />
                <KPICard
                  titulo="BFI_max"
                  valor={eckParams.bfi_max?.toFixed(2) ?? "—"}
                  subtitulo="0.80 = aquífero poroso"
                />
                <KPICard
                  titulo="BFI global"
                  valor={eckParams.bfi_global?.toFixed(3) ?? "—"}
                  destaque
                />
                <KPICard
                  titulo="Janelas de recessão"
                  valor={String(eckParams.n_janelas_recessao ?? 0)}
                  subtitulo={`k entre ${eckParams.k_min?.toFixed(1) ?? "—"} e ${eckParams.k_max?.toFixed(1) ?? "—"} d`}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Equação:{" "}
                <span className="font-mono">
                  b<sub>i</sub> = ((1−BFI<sub>max</sub>)·α·b<sub>i−1</sub> +
                  (1−α)·BFI<sub>max</sub>·y<sub>i</sub>) / (1−α·BFI<sub>max</sub>),
                  com b<sub>i</sub> ≤ y<sub>i</sub>
                </span>
                . α estimado pela mediana de regressões log-lineares em janelas de recessão
                (queda monotônica ≥ 5 dias após 3+ dias sem chuva).
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "q7_10" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Análise de frequência dos mínimos de 7 dias (LP3)
            </h3>
            {q7Min.length === 0 ? (
              <p className="text-sm text-slate-500">Aguardando pipeline.</p>
            ) : (
              <AjusteLowFlow minimos={q7Min} ajuste={q710} />
            )}
          </div>
          {q710 && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-semibold text-slate-700">
                Parâmetros LP3 (em log(Q7))
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <KPICard titulo="μ (log)" valor={q710.parametros.mu_log?.toFixed(4) ?? "—"} />
                <KPICard titulo="σ (log)" valor={q710.parametros.sigma_log?.toFixed(4) ?? "—"} />
                <KPICard titulo="Assimetria (log)" valor={q710.parametros.skew_log?.toFixed(3) ?? "—"} />
                <KPICard
                  titulo="Q7,10"
                  valor={fmtVazao(q710.q7_10_m3s)}
                  destaque
                  subtitulo={`KS p = ${q710.ks_pvalue?.toFixed(3) ?? "—"} | n = ${q710.n_anos}`}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Q7,10 = quantil de probabilidade de não-excedência 10% (TR = 10 anos
                para mínimos). Ano hidrológico padronizado out → set.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
