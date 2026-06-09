"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CloudRain, Activity } from "lucide-react";

import { useEstacoesFluvio } from "@/hooks/useEstacoesFluvio";
import {
  useComparacaoUH,
  useEventos,
  useHUObservado,
  useHUScs,
} from "@/hooks/useEventos";

import { Hietograma } from "@/components/charts/Hietograma";
import { HidrogramaUnitarioChart } from "@/components/charts/HidrogramaUnitario";
import { KPICard } from "@/components/KPICard";

import { fmtVazao } from "@/lib/utils";

export default function EventosPage() {
  const { data: estacoes } = useEstacoesFluvio();
  const [stationIdx, setStationIdx] = useState(0);
  const [eventoSel, setEventoSel] = useState<number | null>(null);

  useEffect(() => {
    if (estacoes.length === 0) return;
    let idx = estacoes.findIndex((e) => e.is_outlet);
    if (idx < 0) idx = 0;
    setStationIdx(idx);
  }, [estacoes]);

  const codigo = estacoes[stationIdx]?.codigo ?? "";

  const { data: eventos, loading: ldEv } = useEventos(codigo);
  const { data: huos }                    = useHUObservado(codigo);
  const { data: scs }                     = useHUScs(codigo);
  const { data: comparacoes }             = useComparacaoUH(codigo);

  const huoMedio = useMemo(() => huos.find((h) => h.evento_id == null) ?? null, [huos]);
  const comparacaoMedio = useMemo(
    () => comparacoes.find((c) => c.escopo === "medio") ?? null,
    [comparacoes],
  );

  useEffect(() => {
    if (eventos.length > 0 && eventoSel == null) setEventoSel(eventos[0].id);
  }, [eventos, eventoSel]);

  const evento = useMemo(
    () => eventos.find((e) => e.id === eventoSel) ?? null,
    [eventos, eventoSel],
  );
  const huoEvento = useMemo(
    () => huos.find((h) => h.evento_id === eventoSel) ?? null,
    [huos, eventoSel],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <CloudRain className="h-6 w-6 text-blue-700" />
          Eventos & Hidrograma Unitário
        </h1>
        <p className="mt-1 text-slate-500">
          Isolamento de eventos chuva-vazão, ajuste do hidrograma unitário
          observado e comparação com o HU SCS triangular.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KPICard titulo="Eventos detectados" valor={String(eventos.length)} />
        <KPICard
          titulo="HU médio (Q pico)"
          valor={huoMedio?.q_pico_uh != null ? `${huoMedio.q_pico_uh.toFixed(2)} m³/s/mm` : "—"}
          subtitulo={huoMedio?.n_eventos ? `n=${huoMedio.n_eventos} eventos` : ""}
        />
        <KPICard
          titulo="HU SCS (Q pico)"
          valor={scs?.qp_m3s_per_mm != null ? `${scs.qp_m3s_per_mm.toFixed(2)} m³/s/mm` : "—"}
          subtitulo={scs?.t_pico_h != null ? `Tp = ${scs.t_pico_h.toFixed(2)} h` : ""}
        />
        <KPICard
          titulo="Nash-Sutcliffe (médio)"
          valor={comparacaoMedio?.nse != null ? comparacaoMedio.nse.toFixed(3) : "—"}
          subtitulo={
            comparacaoMedio?.erro_pico_pct != null
              ? `erro pico ${comparacaoMedio.erro_pico_pct.toFixed(1)} %`
              : ""
          }
          destaque
        />
      </div>

      {/* Layout 2 colunas: lista de eventos + painel principal */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Calendar className="h-4 w-4 text-blue-700" />
            Eventos
          </h3>
          {ldEv && <p className="text-xs text-slate-400">Carregando…</p>}
          {!ldEv && eventos.length === 0 && (
            <p className="text-xs text-slate-500">
              Nenhum evento detectado ainda. Verifique os parâmetros da bacia em
              <code className="ml-1 rounded bg-slate-100 px-1">config.yaml</code>.
            </p>
          )}
          <ul className="space-y-1">
            {eventos.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setEventoSel(e.id)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                    e.id === eventoSel
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <p className="font-semibold">#{e.id} · {e.t_pico.slice(0, 10)}</p>
                  <p className="font-mono text-slate-500">
                    P = {e.p_total_mm.toFixed(0)} mm · Q = {e.q_pico_m3s.toFixed(0)} m³/s
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          {/* Painel do evento selecionado */}
          {evento && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-700">
                  <Activity className="h-4 w-4 text-blue-700" />
                  Evento #{evento.id} — {evento.t_inicio.slice(0, 10)} → {evento.t_fim.slice(0, 10)}
                </h3>
                <span className="text-xs text-slate-500">
                  {evento.duracao_dias} dias · pico em {evento.t_pico.slice(0, 10)}
                </span>
              </div>
              <div className="mb-3 grid gap-3 sm:grid-cols-5">
                <KPICard titulo="P total" valor={`${evento.p_total_mm.toFixed(0)} mm`} />
                <KPICard
                  titulo="P efetiva"
                  valor={evento.p_efetiva_mm != null ? `${evento.p_efetiva_mm.toFixed(0)} mm` : "—"}
                />
                <KPICard titulo="Q pico" valor={fmtVazao(evento.q_pico_m3s)} />
                <KPICard titulo="Lâmina" valor={`${evento.lamina_mm.toFixed(1)} mm`} />
                <KPICard
                  titulo="φ-index"
                  valor={evento.phi_index_mm_dia != null ? `${evento.phi_index_mm_dia.toFixed(2)} mm/d` : "—"}
                />
              </div>
              <Hietograma hietograma={evento.hietograma} hidrograma={evento.hidrograma} />
              {huoEvento && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <strong>HU deste evento:</strong> Q pico = {huoEvento.q_pico_uh?.toFixed(3)} m³/s/mm
                  · base time = {huoEvento.base_time_dias} dias · lâmina ={" "}
                  {huoEvento.lamina_mm?.toFixed(2)} mm.
                </div>
              )}
            </div>
          )}

          {/* HU médio observado vs SCS */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-700">
              HU médio observado × HU SCS triangular
            </h3>
            {!huoMedio && !scs && (
              <p className="text-sm text-slate-500">
                Faltam dados — rode o pipeline e confira{" "}
                <code className="rounded bg-slate-100 px-1">bacia.area_km2 / L / Δh</code>{" "}
                em <code className="rounded bg-slate-100 px-1">config.yaml</code>.
              </p>
            )}
            {(huoMedio || scs) && (
              <HidrogramaUnitarioChart observado={huoMedio} scs={scs} />
            )}
            {scs && (
              <p className="mt-2 text-xs text-slate-500">
                SCS: tc = {scs.tc_min?.toFixed(1)} min ({scs.tc_metodo}) · Tp ={" "}
                {scs.t_pico_h?.toFixed(2)} h · tb = {scs.tb_h?.toFixed(2)} h · Qp ={" "}
                {scs.qp_m3s_per_mm?.toFixed(2)} m³/s/mm.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
