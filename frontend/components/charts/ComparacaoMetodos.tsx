"use client";

import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { PreenchimentoResultado } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComparacaoMetodosProps {
  resultados: PreenchimentoResultado[];
}

const LABELS: Record<string, string> = {
  regressao: "Regressão Múltipla",
  idw: "IDW",
};

function CardMetodo({ r }: { r: PreenchimentoResultado }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        r.is_vencedor ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <h3 className={cn("font-bold text-lg", r.is_vencedor ? "text-blue-700" : "text-slate-700")}>
          {LABELS[r.metodo] ?? r.metodo}
        </h3>
        {r.is_vencedor ? (
          <span className="flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            <CheckCircle size={12} /> Vencedor
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
            <XCircle size={12} /> —
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">RMSE (holdout)</dt>
          <dd className={cn("font-mono font-semibold", r.is_vencedor ? "text-blue-700" : "text-slate-700")}>
            {r.rmse_holdout.toFixed(4)} mm
          </dd>
        </div>
        {r.r2 != null && (
          <div className="flex justify-between">
            <dt className="text-slate-500">R² (treino)</dt>
            <dd className="font-mono font-semibold text-slate-700">{r.r2.toFixed(4)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Dias preenchidos</dt>
          <dd className="font-mono font-semibold text-slate-700">{r.n_dias_preenchidos}</dd>
        </div>
        {r.metodo === "regressao" && r.parametros?.equacao && (
          <div className="mt-3">
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Equação</dt>
            <dd className="rounded bg-slate-100 p-2 font-mono text-xs leading-relaxed text-slate-700 break-all">
              {r.parametros.equacao}
            </dd>
          </div>
        )}
        {r.metodo === "idw" && r.parametros?.distancias_km && (
          <div className="mt-3">
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Distâncias (expoente p={r.parametros.expoente})
            </dt>
            {Object.entries(r.parametros.distancias_km).map(([cod, dist]) => (
              <dd key={cod} className="font-mono text-xs text-slate-600">
                → {cod}: {(dist as number).toFixed(2)} km
              </dd>
            ))}
          </div>
        )}
      </dl>
    </div>
  );
}

function CardIdwAusente() {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-lg text-amber-700">IDW</h3>
        <span className="flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs text-amber-700">
          <AlertCircle size={12} /> Não executado
        </span>
      </div>
      <p className="mt-4 text-sm text-amber-700">
        O método IDW requer coordenadas geográficas (latitude e longitude) de cada estação
        para calcular as distâncias haversine.
      </p>
      <p className="mt-2 text-sm text-amber-600">
        Para ativá-lo, preencha <strong>lat/lon</strong> em{" "}
        <code className="rounded bg-amber-100 px-1">config.yaml</code> ou na página{" "}
        <a href="/selecao" className="underline">Seleção</a> e reexecute o pipeline.
      </p>
    </div>
  );
}

export function ComparacaoMetodos({ resultados }: ComparacaoMetodosProps) {
  if (resultados.length === 0) {
    return <p className="text-sm text-slate-400">Sem dados de preenchimento.</p>;
  }

  const temIdw = resultados.some((r) => r.metodo === "idw");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {resultados.map((r) => (
        <CardMetodo key={r.metodo} r={r} />
      ))}
      {!temIdw && <CardIdwAusente />}
    </div>
  );
}
