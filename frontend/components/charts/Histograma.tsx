"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistogramaData } from "@/lib/types";

interface HistogramaProps {
  dados: HistogramaData;
  cor?: string;
}

export function Histograma({ dados, cor = "#1565C0" }: HistogramaProps) {
  if (!dados.bin_centers?.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Dados insuficientes
      </div>
    );
  }

  const chartData = dados.bin_centers.map((center, i) => ({
    center: center.toFixed(1),
    frequencia: dados.counts[i],
  }));

  const { media, mediana } = dados.estatisticas ?? {};

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="center"
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          label={{ value: "mm", position: "insideRight", offset: 4, fontSize: 10, fill: "#94a3b8" }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Freq.", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [v, "Frequência"]}
          labelFormatter={(l) => `Classe: ~${l} mm`}
        />
        <Bar dataKey="frequencia" fill={cor} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
        {media != null && (
          <ReferenceLine x={media.toFixed(1)} stroke="#1565C0" strokeDasharray="4 2"
            label={{ value: "Média", fontSize: 9, fill: "#1565C0" }} />
        )}
        {mediana != null && (
          <ReferenceLine x={mediana.toFixed(1)} stroke="#D81B60" strokeDasharray="4 2"
            label={{ value: "Mediana", fontSize: 9, fill: "#D81B60" }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
