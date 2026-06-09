"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EckhardtSerie } from "@/lib/types";
import { lttbDownsample } from "@/lib/utils";

interface HidrogramaSeparadoProps {
  serie: EckhardtSerie[];
  maxPoints?: number;
}

/**
 * Hidrograma separado pelo filtro de Eckhardt:
 *   - Q_base (verde, embaixo)
 *   - Q_direto (azul, empilhado em cima)
 *   - soma = Q_total
 */
export function HidrogramaSeparado({ serie, maxPoints = 1500 }: HidrogramaSeparadoProps) {
  const validas = serie.filter((s) => s.q_total != null);
  const sample =
    validas.length > maxPoints
      ? lttbDownsample(
          validas.map((s, i) => ({
            x: i,
            y: s.q_total as number,
            data: s.data,
            base: s.q_base ?? 0,
            direto: s.q_direto ?? 0,
          })),
          maxPoints,
        )
      : validas.map((s) => ({
          data: s.data,
          base: s.q_base ?? 0,
          direto: s.q_direto ?? 0,
        }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={sample} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="data"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          tickFormatter={(d: string) => d?.slice(0, 7) ?? ""}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          unit=" m³/s"
          width={72}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => `${v.toFixed(2)} m³/s`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="base"
          stackId="1"
          stroke="#059669"
          fill="#A7F3D0"
          name="Q_base"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="direto"
          stackId="1"
          stroke="#1D4ED8"
          fill="#BFDBFE"
          name="Q_direto"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
