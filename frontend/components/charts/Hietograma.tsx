"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HidrogramaPonto, HietogramaPonto } from "@/lib/types";

interface HietogramaProps {
  hietograma: HietogramaPonto[];
  hidrograma: HidrogramaPonto[];
}

/**
 * Painel duplo: barras de chuva no topo (invertidas) + linhas do
 * hidrograma na base. Eixos Y duplos.
 */
export function Hietograma({ hietograma, hidrograma }: HietogramaProps) {
  // Une por data — assumimos mesma resolução diária.
  const byDate = new Map<string, { data: string; p_mm: number; q_total: number; q_base: number }>();
  hidrograma.forEach((h) => {
    byDate.set(h.data, {
      data: h.data,
      p_mm: 0,
      q_total: h.q_total,
      q_base: h.q_base,
    });
  });
  hietograma.forEach((h) => {
    const slot = byDate.get(h.data);
    if (slot) slot.p_mm = h.p_mm;
    else byDate.set(h.data, { data: h.data, p_mm: h.p_mm, q_total: 0, q_base: 0 });
  });
  const data = Array.from(byDate.values()).sort((a, b) => (a.data < b.data ? -1 : 1));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="data"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="chuva"
          orientation="right"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          reversed
          label={{ value: "Chuva (mm)", angle: 90, position: "insideRight", fontSize: 11, fill: "#64748b" }}
          width={72}
        />
        <YAxis
          yAxisId="vazao"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Q (m³/s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          width={72}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => {
            if (name === "p_mm") return [`${v.toFixed(1)} mm`, "Chuva"];
            if (name === "q_total") return [`${v.toFixed(2)} m³/s`, "Q total"];
            if (name === "q_base") return [`${v.toFixed(2)} m³/s`, "Q base"];
            return [v, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="chuva"
          dataKey="p_mm"
          name="Chuva"
          fill="#60A5FA"
          isAnimationActive={false}
        />
        <Line
          yAxisId="vazao"
          type="monotone"
          dataKey="q_total"
          name="Q total"
          stroke="#0D47A1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="vazao"
          type="monotone"
          dataKey="q_base"
          name="Q base"
          stroke="#10B981"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
