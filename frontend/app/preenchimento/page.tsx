"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Star } from "lucide-react";

import { useEstacoes } from "@/hooks/useEstacoes";
import { usePreenchimento } from "@/hooks/usePreenchimento";
import { useSerieDiaria } from "@/hooks/useSerieDiaria";
import { ComparacaoMetodos } from "@/components/charts/ComparacaoMetodos";
import { SeriePreenchimento, PontoPreenchimento } from "@/components/charts/SeriePreenchimento";
import { SerieTemporal } from "@/components/charts/SerieTemporal";

const ANO_ATUAL = new Date().getFullYear();

export default function PreenchimentoPage() {
  const { data: estacoes, loading: ldE } = useEstacoes();

  const ref  = estacoes.find((e) => e.is_referencia);
  const aux  = estacoes.filter((e) => !e.is_referencia);
  const aux0 = aux[0];
  const aux1 = aux[1];

  // Station tab — default to reference station
  const [stationIdx, setStationIdx] = useState(0);
  useEffect(() => {
    if (estacoes.length === 0) return;
    const refIdx = estacoes.findIndex((e) => e.is_referencia);
    if (refIdx >= 0) setStationIdx(refIdx);
  }, [estacoes]);

  const estacaoAtiva = estacoes[stationIdx];
  const isRef = estacaoAtiva?.is_referencia ?? false;

  // Time range — shared across all stations
  const [anoInicio, setAnoInicio] = useState(ANO_ATUAL - 9);
  const [anoFim, setAnoFim]       = useState(ANO_ATUAL);
  const dataInicio = `${anoInicio}-01-01`;
  const dataFim    = `${anoFim}-12-31`;

  // Hooks — all called unconditionally
  const { data: resultados, vencedor, loading: ldP } = usePreenchimento(ref?.codigo ?? "");
  const { data: diaria,     loading: ldD  } = useSerieDiaria(ref?.codigo  ?? "", dataInicio, dataFim);
  const { data: diariaAux0, loading: ldD0 } = useSerieDiaria(aux0?.codigo ?? "", dataInicio, dataFim);
  const { data: diariaAux1, loading: ldD1 } = useSerieDiaria(aux1?.codigo ?? "", dataInicio, dataFim);

  const loading = ldE || ldP;

  // Maps for tooltip auxiliares on filled days
  const mapAux0 = useMemo(
    () => new Map(diariaAux0.map((d) => [d.data.slice(0, 10), d.valor])),
    [diariaAux0],
  );
  const mapAux1 = useMemo(
    () => new Map(diariaAux1.map((d) => [d.data.slice(0, 10), d.valor])),
    [diariaAux1],
  );

  // Enriched series for reference station chart
  const dadosDiaria = useMemo<PontoPreenchimento[]>(() =>
    diaria.map((d) => {
      const date = d.data.slice(0, 10);
      if (!d.preenchido) return { label: date, valor: d.valor, preenchido: false };
      const auxiliares: Record<string, { nome: string; valor: number | null }> = {};
      if (aux0) auxiliares[aux0.codigo] = { nome: aux0.nome, valor: mapAux0.get(date) ?? null };
      if (aux1) auxiliares[aux1.codigo] = { nome: aux1.nome, valor: mapAux1.get(date) ?? null };
      return { label: date, valor: d.valor, preenchido: true, auxiliares };
    }),
    [diaria, aux0, aux1, mapAux0, mapAux1],
  );

  // Auxiliary station series (for when non-ref tab is active)
  const serieAuxAtiva = estacaoAtiva?.codigo === aux0?.codigo ? diariaAux0 : diariaAux1;
  const ldAuxAtiva    = estacaoAtiva?.codigo === aux0?.codigo ? ldD0 : ldD1;
  const dadosAux = serieAuxAtiva.map((d) => ({
    label: d.data.slice(0, 10),
    valor: d.valor,
  }));

  // Summary stats (reference only)
  const nPreenchidos    = diaria.filter((d) => d.preenchido).length;
  const nTotal          = diaria.length;
  const pctPreench      = nTotal > 0 ? (nPreenchidos / nTotal * 100).toFixed(2) : "—";
  const diasPreench     = diaria.filter((d) => d.preenchido);
  const primeiroPreench = diasPreench[0]?.data?.slice(0, 10) ?? null;
  const ultimoPreench   = diasPreench[diasPreench.length - 1]?.data?.slice(0, 10) ?? null;

  // Interval selector component (shared)
  const seletorIntervalo = (dataIni: string | undefined) => (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">Intervalo:</span>
      <input
        type="number" min={1900} max={anoFim} value={anoInicio}
        onChange={(e) => setAnoInicio(Math.min(Number(e.target.value), anoFim))}
        className="w-20 rounded border border-slate-200 bg-white px-2 py-0.5 text-center text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <span className="text-slate-400">→</span>
      <input
        type="number" min={anoInicio} max={ANO_ATUAL} value={anoFim}
        onChange={(e) => setAnoFim(Math.max(Number(e.target.value), anoInicio))}
        className="w-20 rounded border border-slate-200 bg-white px-2 py-0.5 text-center text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      {[10, 20, 30].map((n) => (
        <button key={n}
          onClick={() => { setAnoFim(ANO_ATUAL); setAnoInicio(ANO_ATUAL - n + 1); }}
          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >{n}a</button>
      ))}
      <button
        onClick={() => { if (dataIni) { setAnoInicio(Number(dataIni)); setAnoFim(ANO_ATUAL); } }}
        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
      >Completa</button>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Preenchimento de Falhas</h1>
        <p className="mt-1 text-slate-500">
          Comparação entre regressão linear múltipla e IDW · selecione a estação para visualizar a série.
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
                <Star size={12} className={stationIdx === i ? "text-yellow-300" : "text-blue-400"} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── CONTEÚDO PARA ESTAÇÃO DE REFERÊNCIA ── */}
      {isRef && (
        <>
          {/* Info card */}
          {ref && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm">
              <p className="font-semibold text-blue-800">Estação de referência</p>
              <p className="mt-0.5 text-blue-700">
                {ref.nome} <span className="font-mono text-blue-500">({ref.codigo})</span>
              </p>
              <p className="mt-1 text-blue-600">
                Falhas originais: <strong>{ref.pct_falhas_original?.toFixed(1)}%</strong>
                {" → "}
                após preenchimento: <strong>{ref.pct_falhas_pos_preenchimento?.toFixed(1)}%</strong>
              </p>
            </div>
          )}

          {/* Metodologia */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
              <Info size={16} className="text-blue-500" /> Metodologia
            </h2>
            <div className="mt-3 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-700">Regressão Linear Múltipla</p>
                <p className="mt-1">
                  Equação linear ajustada pelo período comum das 3 estações.
                  Treinada em 90% dos dados comuns (seed fixo), validada em 10% (holdout).
                  Aplica a equação para dias onde a referência tem falha e as auxiliares têm dado.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">IDW (Inverse Distance Weighting)</p>
                <p className="mt-1">
                  Interpolação ponderada pelo inverso da distância haversine ao quadrado.
                  Aceita preenchimento parcial (ao menos uma auxiliar com dado no dia).
                  Validado no mesmo holdout da regressão para comparação justa.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-mono text-slate-700">P_ref(t) = Σ [P_i(t) / d_i²] / Σ [1 / d_i²]</p>
              <p className="mt-1 text-xs text-slate-400">
                Onde d_i é a distância haversine (km) entre a referência e a estação auxiliar i.
                Apenas estações com dado no dia t entram na soma.
              </p>
            </div>
          </div>

          {/* Comparação */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-700">Comparação dos métodos</h2>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : (
              <ComparacaoMetodos resultados={resultados} />
            )}
          </div>

          {/* Vencedor */}
          {vencedor && !loading && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-700">
              <p className="font-semibold text-emerald-800">Método aplicado à série final</p>
              <p className="mt-2">
                O método de{" "}
                <strong>{vencedor.metodo === "regressao" ? "regressão linear múltipla" : "IDW"}</strong>{" "}
                foi selecionado como vencedor por apresentar menor RMSE no conjunto de validação
                holdout ({vencedor.rmse_holdout.toFixed(4)} mm). Os {vencedor.n_dias_preenchidos} dias
                preenchidos por este método estão destacados em laranja no gráfico abaixo.
              </p>
              {vencedor.metodo === "regressao" && vencedor.r2 != null && (
                <p className="mt-2">
                  R² no conjunto de treino: <strong>{vencedor.r2.toFixed(4)}</strong> —
                  indica boa capacidade explicativa da equação linear.
                </p>
              )}
            </div>
          )}

          {/* Série diária — referência */}
          {ref && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-700">
                  Série diária corrigida — {ref.nome ?? ref.codigo}
                </h2>
                {seletorIntervalo(ref.data_inicio?.slice(0, 4))}
              </div>

              <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-6 rounded bg-[#1565C0]" />
                  Observado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-6 rounded bg-orange-400" />
                  Preenchido
                </span>
              </div>

              {ldD ? (
                <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
              ) : diaria.length === 0 ? (
                <p className="text-sm text-slate-400">Aguardando execução do pipeline.</p>
              ) : (
                <>
                  <SeriePreenchimento dados={dadosDiaria} maxPoints={2000} />
                  {nPreenchidos > 0 && (
                    <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
                      <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">{nPreenchidos}</p>
                        <p className="text-xs text-orange-500">dias preenchidos</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border p-3 text-center">
                        <p className="text-2xl font-bold text-slate-700">{pctPreench}%</p>
                        <p className="text-xs text-slate-400">do total da série</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border p-3 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          {primeiroPreench} → {ultimoPreench}
                        </p>
                        <p className="text-xs text-slate-400">intervalo dos preenchimentos</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── CONTEÚDO PARA ESTAÇÃO AUXILIAR ── */}
      {!isRef && estacaoAtiva && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">{estacaoAtiva.nome}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{estacaoAtiva.codigo}</p>
            <p className="mt-2">
              Esta é uma estação auxiliar utilizada no cálculo do preenchimento da estação de referência.
              A análise comparativa (regressão vs. IDW) é realizada exclusivamente para a estação de referência.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-700">
                Série diária — {estacaoAtiva.nome}
              </h2>
              {seletorIntervalo(estacaoAtiva.data_inicio?.slice(0, 4))}
            </div>

            {ldAuxAtiva ? (
              <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
            ) : dadosAux.length === 0 ? (
              <p className="text-sm text-slate-400">Sem dados no período selecionado.</p>
            ) : (
              <SerieTemporal dados={dadosAux} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
