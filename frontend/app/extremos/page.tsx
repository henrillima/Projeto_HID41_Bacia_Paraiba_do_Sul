"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CloudRain, Sigma } from "lucide-react";

import { useEstacoesFluvio } from "@/hooks/useEstacoesFluvio";
import {
  useChuvasProjeto,
  useFrequenciaAjustes,
  useFrequenciaQuantis,
  useIDFCurva,
  useIDFParametros,
  useMaxAnualVazao,
} from "@/hooks/useExtremos";

import { AjusteDistribuicao } from "@/components/charts/AjusteDistribuicao";
import { CurvaIDF } from "@/components/charts/CurvaIDF";
import { HietogramaProjeto } from "@/components/charts/HietogramaProjeto";
import { KPICard } from "@/components/KPICard";

import { fmtVazao } from "@/lib/utils";

const REGIAO_IDF_DEFAULT = "sjc-paraiba-do-sul";

type Tab = "ajustes" | "vazoes_projeto" | "idf" | "chuva_projeto";
const TABS: { key: Tab; label: string; icon: typeof Sigma }[] = [
  { key: "ajustes",         label: "Ajuste de distribuições", icon: Sigma },
  { key: "vazoes_projeto",  label: "Vazões de projeto",       icon: AlertTriangle },
  { key: "idf",             label: "Curvas IDF",              icon: BarChart3 },
  { key: "chuva_projeto",   label: "Chuva de projeto",        icon: CloudRain },
];

const NOME_LEGIVEL: Record<string, string> = {
  gumbel:    "Gumbel (EV1)",
  gev:       "GEV",
  lognormal: "LogNormal",
  p3:        "Pearson III",
  lp3:       "Log-Pearson III",
};

export default function ExtremosPage() {
  const { data: estacoes } = useEstacoesFluvio();
  const [stationIdx, setStationIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("ajustes");

  useEffect(() => {
    if (estacoes.length === 0) return;
    let idx = estacoes.findIndex((e) => e.is_outlet);
    if (idx < 0) idx = 0;
    setStationIdx(idx);
  }, [estacoes]);

  const codigo = estacoes[stationIdx]?.codigo ?? "";

  const { data: maximos } = useMaxAnualVazao(codigo);
  const { data: ajustes } = useFrequenciaAjustes(codigo);
  const recomendada = useMemo(
    () => ajustes.find((a) => a.recomendado)?.distribuicao,
    [ajustes],
  );
  const { data: quantis } = useFrequenciaQuantis(codigo, recomendada);
  const { data: idfParams } = useIDFParametros(REGIAO_IDF_DEFAULT);
  const { data: idfCurva }  = useIDFCurva(REGIAO_IDF_DEFAULT);
  const { data: chuvas }    = useChuvasProjeto(REGIAO_IDF_DEFAULT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <AlertTriangle className="h-6 w-6 text-blue-700" />
          Eventos extremos — frequência de cheias, IDF e chuva de projeto
        </h1>
        <p className="mt-1 text-slate-500">
          Análise de frequência das vazões máximas anuais com ajuste e seleção
          entre Gumbel, GEV, LogNormal, Pearson III e Log-Pearson III; curvas
          IDF regionais; chuva de projeto pelo método dos blocos alternados.
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

      {/* Tab 1: Ajustes */}
      {tab === "ajustes" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Papel de probabilidade — Q × TR (distribuição recomendada)
            </h3>
            {quantis.length > 0 || maximos.length > 0 ? (
              <AjusteDistribuicao maximos={maximos} quantis={quantis} />
            ) : (
              <p className="text-sm text-slate-500">Aguardando pipeline.</p>
            )}
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Ranking dos ajustes (AIC ↓ é melhor)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Distribuição</th>
                    <th className="py-2 pr-3 text-right">AIC</th>
                    <th className="py-2 pr-3 text-right">BIC</th>
                    <th className="py-2 pr-3 text-right">log L</th>
                    <th className="py-2 pr-3 text-right">KS stat</th>
                    <th className="py-2 pr-3 text-right">KS p-value</th>
                    <th className="py-2 pr-3 text-right">n</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {ajustes.map((a) => (
                    <tr key={a.distribuicao} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-2 pr-3 text-slate-700">
                        {NOME_LEGIVEL[a.distribuicao] ?? a.distribuicao}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-700">
                        {a.aic?.toFixed(2) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">
                        {a.bic?.toFixed(2) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">
                        {a.log_lik?.toFixed(2) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">
                        {a.ks_stat?.toFixed(3) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                            (a.ks_pvalue ?? 0) >= 0.05
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {a.ks_pvalue?.toFixed(3) ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">{a.n_amostras ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {a.recomendado && (
                          <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                            RECOMENDADA
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Critério primário: <strong>AIC</strong>. KS p-value ≥ 0,05 indica
              aderência aceitável; se nenhuma passar, a melhor pelo AIC ainda é
              destacada (atenção ao reportar incerteza).
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Vazões de projeto */}
      {tab === "vazoes_projeto" && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-700">
            Q(TR) — distribuição recomendada com IC 90 % (bootstrap paramétrico)
          </h3>
          {quantis.length === 0 ? (
            <p className="text-sm text-slate-500">Aguardando pipeline.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">TR (anos)</th>
                    <th className="py-2 pr-3 text-right">Q (m³/s)</th>
                    <th className="py-2 pr-3 text-right">IC inferior</th>
                    <th className="py-2 pr-3 text-right">IC superior</th>
                  </tr>
                </thead>
                <tbody>
                  {quantis.map((q) => (
                    <tr key={q.tr} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-2 pr-3 font-mono text-slate-700">{q.tr}</td>
                      <td className="py-2 pr-3 text-right font-mono font-bold text-blue-700">
                        {fmtVazao(q.q_tr_m3s)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">
                        {fmtVazao(q.ic_lo)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-500">
                        {fmtVazao(q.ic_hi)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: IDF */}
      {tab === "idf" && (
        <div className="space-y-4">
          {idfParams && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Equação adotada</p>
              <p className="mt-1 font-mono">
                i = {idfParams.parametros.a.toFixed(2)} · TR^{idfParams.parametros.b.toFixed(3)} /
                (t<sub>d</sub> + {idfParams.parametros.c.toFixed(1)})^{idfParams.parametros.d.toFixed(3)}
              </p>
              <p className="mt-1 text-amber-800/80">Fonte: {idfParams.fonte}</p>
            </div>
          )}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              Família de curvas IDF (uma curva por TR)
            </h3>
            {idfCurva.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados — rode o pipeline.</p>
            ) : (
              <CurvaIDF pontos={idfCurva} />
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Chuva de projeto */}
      {tab === "chuva_projeto" && (
        <div className="space-y-4">
          {chuvas.length === 0 ? (
            <p className="text-sm text-slate-500">Sem chuvas de projeto registradas.</p>
          ) : (
            chuvas.map((c) => (
              <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-700">
                    TR = {c.tr} anos · duração {c.duracao_total_min.toFixed(0)} min · padrão {c.padrao}
                  </h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                    Σ P = {c.hietograma.reduce((s, b) => s + b.p_mm, 0).toFixed(1)} mm
                  </span>
                </div>
                <HietogramaProjeto chuva={c} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
