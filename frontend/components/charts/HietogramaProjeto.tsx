"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChuvaProjeto } from "@/lib/types";

interface HietogramaProjetoProps {
  chuva: ChuvaProjeto;
}

export function HietogramaProjeto({ chuva }: HietogramaProjetoProps) {
  const data = chuva.hietograma.map((b) => ({
    t_min: b.t_min,
    p_mm: b.p_mm,
  }));

  const cor = chuva.tr >= 100 ? "#dc2626" : chuva.tr >= 50 ? "#db2777" : "#2563eb";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="t_min"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{ value: "t (min)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "P (mm)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: "#64748b",
          }}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [`${v.toFixed(1)} mm`, "P"]}
          labelFormatter={(t) => `t = ${Number(t).toFixed(0)} min`}
        />
        <Bar dataKey="p_mm" fill={cor} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
