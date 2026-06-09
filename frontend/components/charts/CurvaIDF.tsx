"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IDFCurvaPonto } from "@/lib/types";

interface CurvaIDFProps {
  pontos: IDFCurvaPonto[];
}

const CORES: Record<number, string> = {
  2:    "#94a3b8",
  5:    "#60a5fa",
  10:   "#2563eb",
  25:   "#7c3aed",
  50:   "#db2777",
  100:  "#dc2626",
  500:  "#ea580c",
  1000: "#a16207",
};

export function CurvaIDF({ pontos }: CurvaIDFProps) {
  const trsUnicos = Array.from(new Set(pontos.map((p) => p.tr))).sort((a, b) => a - b);
  const duracoesUnicas = Array.from(new Set(pontos.map((p) => p.duracao_min))).sort(
    (a, b) => a - b,
  );

  // Forma os dados em wide: cada linha = uma duração; colunas = i por TR
  const data = duracoesUnicas.map((d) => {
    const row: { duracao_min: number; [key: string]: number | null } = { duracao_min: d };
    for (const tr of trsUnicos) {
      const ponto = pontos.find((p) => p.duracao_min === d && p.tr === tr);
      row[`tr_${tr}`] = ponto?.intensidade_mm_h ?? null;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="duracao_min"
          scale="log"
          domain={[5, 1500]}
          ticks={[5, 10, 30, 60, 120, 360, 720, 1440]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{
            value: "Duração (min, log)",
            position: "insideBottom",
            offset: -2,
            fontSize: 11,
            fill: "#64748b",
          }}
        />
        <YAxis
          type="number"
          scale="log"
          domain={[1, "auto"]}
          allowDataOverflow
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "i (mm/h, log)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: "#64748b",
          }}
          width={72}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => [`${v.toFixed(1)} mm/h`, `TR=${name.replace("tr_", "")}`]}
          labelFormatter={(d) => `Duração ${Number(d).toFixed(0)} min`}
        />
        {trsUnicos.map((tr) => (
          <Line
            key={tr}
            type="monotone"
            dataKey={`tr_${tr}`}
            name={String(tr)}
            stroke={CORES[tr] ?? "#0D47A1"}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
