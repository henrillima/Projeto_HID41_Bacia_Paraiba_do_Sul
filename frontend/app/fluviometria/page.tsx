"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Waves } from "lucide-react";

import { useEstacoesFluvio } from "@/hooks/useEstacoesFluvio";
import { useFluvioDiaria } from "@/hooks/useFluvioDiaria";
import { useFluvioMensal } from "@/hooks/useFluvioMensal";
import { useFluvioAnual } from "@/hooks/useFluvioAnual";
import {
  useCurvaChaveAjuste,
  useCurvaChaveMedicoes,
} from "@/hooks/useCurvaChave";

import { SerieVazao } from "@/components/charts/SerieVazao";
import { CurvaChave } from "@/components/charts/CurvaChave";
import { Histograma } from "@/components/charts/Histograma";
import { TabelaEstatisticas } from "@/components/TabelaEstatisticas";
import { KPICard } from "@/components/KPICard";

import { MES_ABREV } from "@/lib/types";
import { computeHistogram, fmtArea, fmtVazao } from "@/lib/utils";

type Tab = "diaria" | "mensal" | "anual";
const TABS: Tab[] = ["diaria", "mensal", "anual"];
const ANO_ATUAL = new Date().getFullYear();

const TAB_LABEL: Record<Tab, string> = {
  diaria: "Diária",
  mensal: "Mensal",
  anual:  "Anual",
};

export default function FluviometriaPage() {
  const { data: estacoes, loading: ldE } = useEstacoesFluvio();
  const [stationIdx, setStationIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("diaria");

  // Range temporal
  const [anoInicio, setAnoInicio] = useState(1900);
  const [anoFim, setAnoFim] = useState(ANO_ATUAL);

  useEffect(() => {
    if (estacoes.length === 0) return;
    let idx = estacoes.findIndex((e) => e.is_outlet);
    if (idx < 0) idx = 0;
    const param = new URLSearchParams(window.location.search).get("estacao");
    if (param) {
      const found = estacoes.findIndex((e) => e.codigo === param);
      if (found >= 0) idx = found;
    }
    setStationIdx(idx);
    const ini = Number(estacoes[idx]?.data_inicio?.slice(0, 4));
    setAnoInicio(ini > 1800 ? ini : 1900);
    setAnoFim(ANO_ATUAL);
  }, [estacoes]);

  const estacao = estacoes[stationIdx];
  const codigo = estacao?.codigo ?? "";

  const dataInicio = `${anoInicio}-01-01`;
  const dataFim = `${anoFim}-12-31`;

  const { data: diaria, loading: ldD } = useFluvioDiaria(codigo, dataInicio, dataFim);
  const { data: mensal, loading: ldM } = useFluvioMensal(codigo);
  const { data: anual,  loading: ldA } = useFluvioAnual(codigo);

  const { data: ajustes } = useCurvaChaveAjuste(codigo);
  const { data: medicoes } = useCurvaChaveMedicoes(codigo);
  const ajusteAtual = ajustes[0] ?? null;

  const dadosDiaria = useMemo(
    () =>
      diaria.map((d) => ({
        label: d.data.slice(0, 10),
        valor: d.vazao_m3s,
        preenchido: d.preenchido,
      })),
    [diaria],
  );

  const mensalFiltrado = useMemo(
    () => mensal.filter((d) => d.ano >= anoInicio && d.ano <= anoFim),
    [mensal, anoInicio, anoFim],
  );
  const anualFiltrado = useMemo(
    () => anual.filter((d) => d.ano >= anoInicio && d.ano <= anoFim),
    [anual, anoInicio, anoFim],
  );

  const dadosMensal = useMemo(
    () =>
      mensalFiltrado.map((d) => ({
        label: `${MES_ABREV[(d.mes ?? 1) - 1]}/${d.ano}`,
        valor: d.valido ? d.vazao_media : null,
      })),
    [mensalFiltrado],
  );

  const dadosAnual = useMemo(
    () =>
      anualFiltrado.map((d) => ({
        label: String(d.ano),
        valor: d.valido ? d.vazao_media : null,
      })),
    [anualFiltrado],
  );

  const dadosPorTab: Record<Tab, { label: string; valor: number | null; preenchido?: boolean }[]> = {
    diaria: dadosDiaria,
    mensal: dadosMensal,
    anual:  dadosAnual,
  };

  const valoresPorTab: Record<Tab, (number | null)[]> = useMemo(
    () => ({
      diaria: diaria.map((d) => d.vazao_m3s),
      mensal: mensalFiltrado.map((d) => (d.valido ? d.vazao_media : null)),
      anual:  anualFiltrado.map((d) => (d.valido ? d.vazao_media : null)),
    }),
    [diaria, mensalFiltrado, anualFiltrado],
  );

  const histDinamico = useMemo(() => {
    const vals = valoresPorTab[tab];
    return vals.length > 0 ? computeHistogram(vals, 20) : null;
  }, [valoresPorTab, tab]);

  const loading = ldE || ldD || ldM || ldA;

  // KPIs derivados
  const mediaGlobal = useMemo(() => {
    const v = anual
      .filter((d) => d.valido && d.vazao_media != null)
      .map((d) => d.vazao_media as number);
    if (!v.length) return null;
    return v.reduce((s, x) => s + x, 0) / v.length;
  }, [anual]);

  const minMaxObs = useMemo(() => {
    const v = diaria.filter((d) => d.vazao_m3s != null).map((d) => d.vazao_m3s as number);
    if (!v.length) return { min: null, max: null };
    return { min: Math.min(...v), max: Math.max(...v) };
  }, [diaria]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Waves className="h-6 w-6 text-blue-700" />
          Fluviometria — exutório da bacia
        </h1>
        <p className="mt-1 text-slate-500">
          Séries diária, mensal e anual de vazão na estação fluviométrica do exutório,
          com curva-chave ajustada às medições oficiais da ANA.
        </p>
      </div>

      {/* Seletor de estação */}
      {estacoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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

      {estacao && (
        <div className="grid gap-3 sm:grid-cols-4">
          <KPICard titulo="Área de drenagem" valor={fmtArea(estacao.area_drenagem_km2)} />
          <KPICard
            titulo="Anos de dados"
            valor={estacao.anos_dados != null ? `${estacao.anos_dados.toFixed(1)} anos` : "—"}
            subtitulo={`${estacao.data_inicio ?? "—"} → ${estacao.data_fim ?? "—"}`}
          />
          <KPICard titulo="Vazão média anual" valor={fmtVazao(mediaGlobal)} destaque />
          <KPICard
            titulo="Faixa observada"
            valor={`${fmtVazao(minMaxObs.min)} → ${fmtVazao(minMaxObs.max)}`}
            subtitulo="(diária)"
          />
        </div>
      )}

      {/* Range temporal */}
      {estacao && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Período</span>
          <input
            type="number"
            value={anoInicio}
            onChange={(e) => setAnoInicio(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-300"
          />
          <span className="text-slate-400">—</span>
          <input
            type="number"
            value={anoFim}
            onChange={(e) => setAnoFim(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              t === tab
                ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Gráfico principal */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-700">
          <Activity className="h-4 w-4 text-blue-700" />
          Série {TAB_LABEL[tab].toLowerCase()} — Q (m³/s)
        </h3>
        {loading ? (
          <div className="flex h-72 items-center justify-center text-sm text-slate-400">Carregando…</div>
        ) : (
          <SerieVazao
            dados={dadosPorTab[tab]}
            media={mediaGlobal ?? undefined}
            yLog={tab === "diaria"}
          />
        )}
      </div>

      {/* Histograma + Estatísticas */}
      {histDinamico && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="mb-3 text-base font-semibold text-slate-700">Distribuição de Q</h3>
            <Histograma dados={histDinamico} />
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">Estatísticas descritivas</h3>
            <TabelaEstatisticas est={histDinamico.estatisticas} unidade="m³/s" />
          </div>
        </div>
      )}

      {/* Curva-chave */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-700">
          Curva-chave (Q = a·(h − h₀)<sup>b</sup>)
        </h3>
        {ajusteAtual || medicoes.length > 0 ? (
          <>
            {ajusteAtual && (
              <div className="mb-3 grid gap-3 sm:grid-cols-5">
                <KPICard titulo="a" valor={ajusteAtual.parametros.a.toFixed(4)} />
                <KPICard titulo="b" valor={ajusteAtual.parametros.b.toFixed(3)} />
                <KPICard titulo="h₀ (m)" valor={ajusteAtual.parametros.h0.toFixed(2)} />
                <KPICard titulo="R²" valor={ajusteAtual.r2?.toFixed(4) ?? "—"} destaque />
                <KPICard titulo="n pontos" valor={ajusteAtual.n_pontos != null ? String(ajusteAtual.n_pontos) : "—"} />
              </div>
            )}
            <CurvaChave ajuste={ajusteAtual} medicoes={medicoes} />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhuma curva-chave ou medição cadastrada para esta estação.
          </p>
        )}
      </div>
    </div>
  );
}
