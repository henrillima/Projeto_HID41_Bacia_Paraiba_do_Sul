"use client";

import { useMemo } from "react";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { lttbDownsample } from "@/lib/utils";

export interface AuxiliarInfo {
  nome: string;
  valor: number | null;
}

export interface PontoPreenchimento {
  label: string;
  valor: number | null;
  preenchido: boolean;
  auxiliares?: Record<string, AuxiliarInfo>;
}

interface Props {
  dados: PontoPreenchimento[];
  media?: number;
  maxPoints?: number;
}

// Tooltip customizado
function TooltipPreenchimento({ active, payload }: { active?: boolean; payload?: { payload: PontoPreenchimento }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-xl border bg-white p-3 shadow-xl text-xs min-w-[160px]">
      <p className="mb-2 font-semibold text-slate-600">{d.label}</p>

      {/* Referência */}
      <div className={`flex items-center gap-1.5 ${d.preenchido ? "text-orange-600" : "text-blue-700"}`}>
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ background: d.preenchido ? "#FB8C00" : "#1565C0" }}
        />
        <span className="font-semibold">
          {d.valor != null ? `${d.valor.toFixed(1)} mm` : "—"}
        </span>
        <span className="text-[10px] font-normal text-slate-400">
          {d.preenchido ? "(preenchido)" : "(observado)"}
        </span>
      </div>

      {/* Auxiliares — só mostrar nos dias preenchidos */}
      {d.preenchido && d.auxiliares && Object.entries(d.auxiliares).length > 0 && (
        <>
          <div className="my-2 border-t border-slate-100" />
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Estações auxiliares no dia
          </p>
          {Object.entries(d.auxiliares).map(([cod, aux]) => (
            <div key={cod} className="flex items-center justify-between gap-3 text-slate-600">
              <span className="truncate text-slate-500">{aux.nome}</span>
              <span className="font-mono font-semibold">
                {aux.valor != null ? `${aux.valor.toFixed(1)} mm` : "sem dado"}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Dot customizado: grande e destacado para preenchidos, invisível para os demais
function DotPreenchimento(props: {
  cx?: number; cy?: number; key?: string | number;
  payload?: PontoPreenchimento;
}) {
  const { cx, cy, payload, key } = props;
  if (!payload?.preenchido || cx == null || cy == null) return <g key={key} />;
  return (
    <g key={key}>
      {/* halo externo */}
      <circle cx={cx} cy={cy} r={9} fill="#FB8C00" opacity={0.2} />
      {/* círculo principal */}
      <circle cx={cx} cy={cy} r={6} fill="#FB8C00" stroke="white" strokeWidth={2} />
    </g>
  );
}

export function SeriePreenchimento({ dados, media, maxPoints = 2000 }: Props) {
  const chartData = useMemo(() => {
    if (!dados.length) return [];

    // Índices dos pontos preenchidos (para preservar após LTTB)
    const filledSet = new Set(dados.filter(d => d.preenchido).map(d => d.label));

    const numeric = dados.map((d, i) => ({
      x: i,
      y: d.valor ?? 0,
      label: d.label,
      preenchido: d.preenchido,
      auxiliares: d.auxiliares,
    }));

    const sampled = numeric.length > maxPoints
      ? lttbDownsample(numeric, maxPoints)
      : numeric;

    // Garante que pontos preenchidos nunca sejam descartados pelo LTTB
    const sampledLabels = new Set(sampled.map(s => s.label));
    const missed = numeric.filter(n => filledSet.has(n.label) && !sampledLabels.has(n.label));

    return [...sampled, ...missed]
      .sort((a, b) => a.x - b.x)
      .map(d => ({
        label: d.label,
        valor: d.y,
        preenchido: d.preenchido,
        auxiliares: d.auxiliares,
      }));
  }, [dados, maxPoints]);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          unit=" mm"
          width={56}
        />
        <Tooltip content={(p) => <TooltipPreenchimento active={p.active} payload={p.payload as { payload: PontoPreenchimento }[]} />} />
        {media != null && (
          <ReferenceLine
            y={media}
            stroke="#64748b"
            strokeDasharray="4 2"
            label={{ value: `Média: ${media.toFixed(1)} mm`, fontSize: 10, fill: "#64748b" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="valor"
          stroke="#1565C0"
          strokeWidth={1.5}
          dot={DotPreenchimento as never}
          activeDot={{ r: 5, fill: "#1565C0" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
