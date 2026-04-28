"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

import { useEstacoes } from "@/hooks/useEstacoes";
import { useSerieDiaria } from "@/hooks/useSerieDiaria";
import { useSerieMensal } from "@/hooks/useSerieMensal";
import { useSerieAnual } from "@/hooks/useSerieAnual";
import { useMaxDiariaAnual } from "@/hooks/useMaxDiariaAnual";

import { SerieTemporal } from "@/components/charts/SerieTemporal";
import { SeriePreenchimento } from "@/components/charts/SeriePreenchimento";
import { Histograma } from "@/components/charts/Histograma";
import { TabelaEstatisticas } from "@/components/TabelaEstatisticas";

import type { TipoSerie } from "@/lib/types";
import { TIPO_SERIE_LABELS, MES_ABREV } from "@/lib/types";
import { fmtMm, computeHistogram } from "@/lib/utils";

type TabKey = TipoSerie;
const TABS: TabKey[] = ["diaria", "mensal", "anual", "max_diaria_anual"];
const ANO_ATUAL = new Date().getFullYear();

export default function SeriesPage() {
  const { data: estacoes, loading: ldE } = useEstacoes();

  // Station selector — default to reference station once loaded
  const [stationIdx, setStationIdx] = useState(0);
  useEffect(() => {
    if (estacoes.length === 0) return;
    const refIdx = estacoes.findIndex((e) => e.is_referencia);
    if (refIdx >= 0) setStationIdx(refIdx);
  }, [estacoes]);

  // Series type tab
  const [tab, setTab] = useState<TabKey>("diaria");

  // Time range — default last 10 years
  const [anoInicio, setAnoInicio] = useState(ANO_ATUAL - 9);
  const [anoFim, setAnoFim] = useState(ANO_ATUAL);
  const dataInicio = `${anoInicio}-01-01`;
  const dataFim = `${anoFim}-12-31`;

  const estacao = estacoes[stationIdx];
  const codigo = estacao?.codigo ?? "";

  const { data: diaria,   loading: ldD  } = useSerieDiaria(codigo, dataInicio, dataFim);
  const { data: mensal,   loading: ldM  } = useSerieMensal(codigo);
  const { data: anual,    loading: ldA  } = useSerieAnual(codigo);
  const { data: maxAnual, loading: ldMx } = useMaxDiariaAnual(codigo);

  const dadosDiaria = useMemo(() => diaria.map((d) => ({
    label: d.data.slice(0, 10),
    valor: d.valor,
    preenchido: d.preenchido ?? false,
  })), [diaria]);

  const mensalFiltrado = useMemo(
    () => mensal.filter((d) => d.ano >= anoInicio && d.ano <= anoFim),
    [mensal, anoInicio, anoFim],
  );
  const anualFiltrado = useMemo(
    () => anual.filter((d) => d.ano >= anoInicio && d.ano <= anoFim),
    [anual, anoInicio, anoFim],
  );
  const maxFiltrado = useMemo(
    () => maxAnual.filter((d) => d.ano >= anoInicio && d.ano <= anoFim),
    [maxAnual, anoInicio, anoFim],
  );

  const dadosMensal = useMemo(() => mensalFiltrado.map((d) => ({
    label: `${MES_ABREV[(d.mes ?? 1) - 1]}/${d.ano}`,
    valor: d.valido ? d.valor : null,
  })), [mensalFiltrado]);

  const dadosAnual = useMemo(() => anualFiltrado.map((d) => ({
    label: String(d.ano),
    valor: d.valido ? d.valor : null,
  })), [anualFiltrado]);

  const dadosMax = useMemo(() => maxFiltrado.map((d) => ({
    label: String(d.ano), valor: d.valor,
  })), [maxFiltrado]);

  type PontoDado = { label: string; valor: number | null; preenchido?: boolean };
  const dadosPorTab: Record<TabKey, PontoDado[]> = {
    diaria: dadosDiaria,
    mensal: dadosMensal,
    anual: dadosAnual,
    max_diaria_anual: dadosMax,
  };

  // Valores brutos de cada tab para cálculo dinâmico de stats e histograma
  const valoresPorTab: Record<TabKey, (number | null)[]> = useMemo(() => ({
    diaria:            diaria.map((d) => d.valor),
    mensal:            mensalFiltrado.map((d) => d.valido ? d.valor : null),
    anual:             anualFiltrado.map((d) => d.valido ? d.valor : null),
    max_diaria_anual:  maxFiltrado.map((d) => d.valor),
  }), [diaria, mensalFiltrado, anualFiltrado, maxFiltrado]);

  const histDataDynamic = useMemo(() => {
    const vals = valoresPorTab[tab];
    return vals.length > 0 ? computeHistogram(vals, 20) : null;
  }, [valoresPorTab, tab]);

  const loading = ldD || ldM || ldA || ldMx;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Séries temporais</h1>
        <p className="mt-1 text-sm text-slate-500">
          Séries diária, mensal, anual e máxima diária anual com histogramas e estatísticas.
        </p>
      </div>

      {/* Tabs de estação */}
      {ldE ? (
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {estacoes.map((e, i) => (
            <button
              key={e.codigo}
              onClick={() => setStationIdx(i)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                stationIdx === i
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <span className="font-mono text-xs opacity-70">{e.codigo}</span>
              <span className="truncate max-w-[160px]">{e.nome}</span>
              {e.is_referencia && (
                <Star
                  size={12}
                  className={stationIdx === i ? "text-yellow-300" : "text-blue-400"}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {estacao && (
        <>
          {/* Info da estação ativa */}
          <div className="flex items-start justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="font-semibold text-slate-800">
                {estacao.nome}
                {estacao.is_referencia && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    <Star size={10} /> Referência
                  </span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-400">
                {codigo} · {estacao.lat?.toFixed(4)}, {estacao.lon?.toFixed(4)}
                {estacao.altitude != null && ` · ${estacao.altitude} m`}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Falhas: <strong>{estacao.pct_falhas_original?.toFixed(1)}%</strong></p>
              {estacao.is_referencia && estacao.pct_falhas_pos_preenchimento != null && (
                <p>Pós-preenchimento: <strong>{estacao.pct_falhas_pos_preenchimento.toFixed(1)}%</strong></p>
              )}
            </div>
          </div>

          {/* Seletor de intervalo */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Intervalo:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1900}
                max={anoFim}
                value={anoInicio}
                onChange={(e) => setAnoInicio(Math.min(Number(e.target.value), anoFim))}
                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-slate-400">→</span>
              <input
                type="number"
                min={anoInicio}
                max={ANO_ATUAL}
                value={anoFim}
                onChange={(e) => setAnoFim(Math.max(Number(e.target.value), anoInicio))}
                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="ml-auto flex gap-2">
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => { setAnoFim(ANO_ATUAL); setAnoInicio(ANO_ATUAL - n + 1); }}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {n} anos
                </button>
              ))}
              <button
                onClick={() => {
                  const ini = estacao.data_inicio?.slice(0, 4);
                  if (ini) { setAnoInicio(Number(ini)); setAnoFim(ANO_ATUAL); }
                }}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                Série completa
              </button>
            </div>
          </div>

          {/* Tabs de tipo de série */}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === t
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {TIPO_SERIE_LABELS[t]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Série temporal */}
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  Série {TIPO_SERIE_LABELS[tab]}
                  {tab === "diaria" && (
                    <>
                      <span className="ml-2 inline-block h-2 w-6 rounded bg-orange-400 align-middle" />
                      <span className="ml-1 text-xs font-normal text-slate-400">= valores preenchidos</span>
                    </>
                  )}
                </h2>
                {tab === "diaria" ? (
                  <SeriePreenchimento
                    dados={dadosDiaria}
                    media={histDataDynamic?.estatisticas?.media ?? undefined}
                    maxPoints={2000}
                  />
                ) : (
                  <SerieTemporal
                    dados={dadosPorTab[tab]}
                    media={histDataDynamic?.estatisticas?.media ?? undefined}
                  />
                )}
              </div>

              {/* Histograma + Estatísticas */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-700">
                    Histograma — {TIPO_SERIE_LABELS[tab]}
                    <span className="ml-2 text-xs font-normal text-slate-400">intervalo selecionado</span>
                  </h2>
                  {loading ? (
                    <div className="h-48 animate-pulse rounded bg-slate-100" />
                  ) : histDataDynamic ? (
                    <Histograma dados={histDataDynamic} />
                  ) : (
                    <p className="text-sm text-slate-400">Sem dados no intervalo selecionado.</p>
                  )}
                </div>
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-700">
                    Estatísticas descritivas
                    <span className="ml-2 text-xs font-normal text-slate-400">intervalo selecionado</span>
                  </h2>
                  {loading ? (
                    <div className="h-48 animate-pulse rounded bg-slate-100" />
                  ) : histDataDynamic?.estatisticas ? (
                    <TabelaEstatisticas est={histDataDynamic.estatisticas} />
                  ) : (
                    <p className="text-sm text-slate-400">Sem dados estatísticos.</p>
                  )}
                </div>
              </div>

              {/* Tabela anual */}
              {tab === "anual" && (
                <div className="rounded-xl border bg-white shadow-sm">
                  <div className="border-b px-5 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">Série anual — tabela</h2>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-2 text-left">Ano</th>
                          <th className="px-4 py-2 text-right">Total (mm)</th>
                          <th className="px-4 py-2 text-right">Falhas (%)</th>
                          <th className="px-4 py-2 text-center">Válido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anual.map((a) => (
                          <tr key={a.ano} className="border-b last:border-0">
                            <td className="px-4 py-2 font-mono">{a.ano}</td>
                            <td className="px-4 py-2 text-right">{fmtMm(a.valor, 1)}</td>
                            <td className="px-4 py-2 text-right">{a.pct_falhas?.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-center">
                              {a.valido
                                ? <span className="text-emerald-600">✓</span>
                                : <span className="text-slate-300">✗</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
