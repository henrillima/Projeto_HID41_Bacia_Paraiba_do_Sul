"use client";

import dynamic from "next/dynamic";
import { useEstacoes } from "@/hooks/useEstacoes";
import { EstacaoCard } from "@/components/EstacaoCard";
import { KPICard } from "@/components/KPICard";
import { fmtMm } from "@/lib/utils";

// Leaflet requer SSR desabilitado
const MapaEstacoes = dynamic(
  () => import("@/components/MapaEstacoes").then((m) => m.MapaEstacoes),
  { ssr: false, loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-slate-100" /> }
);

export default function DashboardPage() {
  const { data: estacoes, loading } = useEstacoes();

  const ref = estacoes.find((e) => e.is_referencia);
  const mediaTotal = estacoes.length
    ? estacoes.reduce((s, e) => s + (e.media_anual_mm ?? 0), 0) / estacoes.length
    : null;
  const anosMin = estacoes.length
    ? Math.min(...estacoes.map((e) => parseInt(e.data_inicio?.slice(0, 4) ?? "9999")))
    : null;
  const anosMax = estacoes.length
    ? Math.max(...estacoes.map((e) => parseInt(e.data_fim?.slice(0, 4) ?? "0")))
    : null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section>
        <h1 className="text-2xl font-bold text-slate-800">
          Análise Pluviométrica — Bacia do Paraíba do Sul
        </h1>
        <p className="mt-1 text-slate-500">
          Séries históricas diárias, mensais e anuais · Preenchimento de falhas por regressão e IDW
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard
          titulo="Estações"
          valor={loading ? "—" : String(estacoes.length)}
          subtitulo="pluviométricas"
        />
        <KPICard
          titulo="Período"
          valor={loading || !anosMin ? "—" : `${anosMin}–${anosMax}`}
          subtitulo="anos disponíveis"
        />
        <KPICard
          titulo="Média anual"
          valor={loading ? "—" : fmtMm(mediaTotal, 0)}
          subtitulo="(todas as estações)"
          destaque
        />
        <KPICard
          titulo="Referência"
          valor={loading ? "—" : (ref?.codigo ?? "—")}
          subtitulo={ref?.nome ?? ""}
        />
      </section>

      {/* Mapa */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700">Localização das estações</h2>
        {loading ? (
          <div className="h-[380px] animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <MapaEstacoes estacoes={estacoes} height="380px" />
        )}
      </section>

      {/* Cards das estações */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700">Estações monitoradas</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {estacoes.map((e) => (
              <EstacaoCard key={e.codigo} estacao={e} />
            ))}
          </div>
        )}
      </section>

      {/* Nota metodológica */}
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-slate-600">
        <p className="font-semibold text-blue-800">Metodologia resumida</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Dados: ANA Hidroweb — séries diárias de precipitação pluviométrica.</li>
          <li>Consistência: registros de nível 2 (consistido) priorizados sobre nível 1 (bruto).</li>
          <li>Meses com &gt;5% de falhas marcados como inválidos nas agregações mensais/anuais.</li>
          <li>
            Preenchimento de falhas da estação de referência por{" "}
            <strong>regressão linear múltipla</strong> e <strong>IDW</strong> —
            método vencedor selecionado pelo menor RMSE em holdout de 10%.
          </li>
          <li>Ver página <a href="/preenchimento" className="text-blue-600 underline">Preenchimento</a> para detalhes.</li>
        </ul>
      </section>
    </div>
  );
}
