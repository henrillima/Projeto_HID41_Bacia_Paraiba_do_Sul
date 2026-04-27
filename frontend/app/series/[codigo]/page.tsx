"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";

import { useSerieDiaria } from "@/hooks/useSerieDiaria";
import { useSerieMensal } from "@/hooks/useSerieMensal";
import { useSerieAnual } from "@/hooks/useSerieAnual";
import { useMaxDiariaAnual } from "@/hooks/useMaxDiariaAnual";
import { useHistograma } from "@/hooks/useHistograma";
import { useEstacoes } from "@/hooks/useEstacoes";

import { SerieTemporal } from "@/components/charts/SerieTemporal";
import { Histograma } from "@/components/charts/Histograma";
import { TabelaEstatisticas } from "@/components/TabelaEstatisticas";

import type { TipoSerie } from "@/lib/types";
import { TIPO_SERIE_LABELS, MES_ABREV } from "@/lib/types";
import { fmtMm } from "@/lib/utils";

type TabKey = TipoSerie;
const TABS: TabKey[] = ["diaria", "mensal", "anual", "max_diaria_anual"];

export default function SeriesPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [tab, setTab] = useState<TabKey>("diaria");

  const { data: estacoes } = useEstacoes();
  const estacao = estacoes.find((e) => e.codigo === codigo);

  const { data: diaria, loading: ldD } = useSerieDiaria(codigo);
  const { data: mensal, loading: ldM } = useSerieMensal(codigo);
  const { data: anual, loading: ldA } = useSerieAnual(codigo);
  const { data: maxAnual, loading: ldMx } = useMaxDiariaAnual(codigo);
  const { data: histData, loading: ldH } = useHistograma(codigo, tab);

  // Prepara dados para SerieTemporal por aba
  const dadosDiaria = diaria.map((d) => ({
    label: d.data,
    valor: d.valor,
    preenchido: d.preenchido,
  }));

  const dadosMensal = mensal.map((d) => ({
    label: `${MES_ABREV[(d.mes ?? 1) - 1]}/${d.ano}`,
    valor: d.valido ? d.valor : null,
  }));

  const dadosAnual = anual.map((d) => ({
    label: String(d.ano),
    valor: d.valido ? d.valor : null,
  }));

  const dadosMax = maxAnual.map((d) => ({
    label: String(d.ano),
    valor: d.valor,
  }));

  type PontoDado = { label: string; valor: number | null; preenchido?: boolean };
  const dadosPorTab: Record<TabKey, PontoDado[]> = {
    diaria: dadosDiaria,
    mensal: dadosMensal,
    anual: dadosAnual,
    max_diaria_anual: dadosMax,
  };

  const mediaPorTab: Record<TabKey, number | undefined> = {
    diaria: histData?.dados?.estatisticas?.media ?? undefined,
    mensal: histData?.dados?.estatisticas?.media ?? undefined,
    anual: histData?.dados?.estatisticas?.media ?? undefined,
    max_diaria_anual: histData?.dados?.estatisticas?.media ?? undefined,
  };

  const loading = ldD || ldM || ldA || ldMx;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/estacoes" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft size={14} /> Estações
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-sm font-semibold text-slate-700">{codigo}</span>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {estacao?.nome ?? codigo}
            {estacao?.is_referencia && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700">
                <Star size={12} /> Referência
              </span>
            )}
          </h1>
          <p className="mt-0.5 font-mono text-sm text-slate-500">
            {codigo} · {estacao?.lat?.toFixed(4)}, {estacao?.lon?.toFixed(4)}
            {estacao?.altitude != null && ` · ${estacao.altitude} m`}
          </p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Falhas originais: <strong>{estacao?.pct_falhas_original?.toFixed(1)}%</strong></p>
          {estacao?.is_referencia && (
            <p>Após preenchimento: <strong>{estacao.pct_falhas_pos_preenchimento?.toFixed(1)}%</strong></p>
          )}
        </div>
      </div>

      {/* Tabs */}
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
                <span className="ml-2 inline-block h-2 w-6 rounded bg-orange-400 align-middle" />
              )}
              {tab === "diaria" && (
                <span className="ml-1 text-xs font-normal text-slate-400">= valores preenchidos</span>
              )}
            </h2>
            <SerieTemporal
              dados={dadosPorTab[tab]}
              media={mediaPorTab[tab]}
            />
          </div>

          {/* Histograma + Estatísticas */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Histograma de frequência — {TIPO_SERIE_LABELS[tab]}
              </h2>
              {ldH ? (
                <div className="h-48 animate-pulse rounded bg-slate-100" />
              ) : histData ? (
                <Histograma dados={histData.dados} />
              ) : (
                <p className="text-sm text-slate-400">Sem dados de histograma.</p>
              )}
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Estatísticas descritivas</h2>
              {ldH ? (
                <div className="h-48 animate-pulse rounded bg-slate-100" />
              ) : histData?.dados?.estatisticas ? (
                <TabelaEstatisticas est={histData.dados.estatisticas} />
              ) : (
                <p className="text-sm text-slate-400">Sem dados estatísticos.</p>
              )}
            </div>
          </div>

          {/* Tabela de dados brutos */}
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
    </div>
  );
}
