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
import type {
  HidrogramaUnitarioObservado,
  HidrogramaUnitarioScs,
} from "@/lib/types";

interface HidrogramaUnitarioProps {
  observado: HidrogramaUnitarioObservado | null;
  scs: HidrogramaUnitarioScs | null;
}

/**
 * Compara HU observado (em passos diários) vs HU SCS (sub-horários)
 * em uma mesma malha temporal (horas), interpolando o observado.
 */
export function HidrogramaUnitarioChart({ observado, scs }: HidrogramaUnitarioProps) {
  // Constrói pontos de cada série em tempo (horas)
  const obsPts: { t_h: number; u_obs: number | null; u_scs: number | null }[] = [];
  if (observado?.ordenadas_m3s_per_mm) {
    observado.ordenadas_m3s_per_mm.forEach((u, i) => {
      obsPts.push({ t_h: i * 24, u_obs: u, u_scs: null });
    });
  }

  // Calcula passo do SCS em horas
  const dt_scs_h = scs?.dt_min ? scs.dt_min / 60.0 : 1.0;
  if (scs?.ordenadas_m3s_per_mm) {
    scs.ordenadas_m3s_per_mm.forEach((u, i) => {
      obsPts.push({ t_h: i * dt_scs_h, u_obs: null, u_scs: u });
    });
  }

  obsPts.sort((a, b) => a.t_h - b.t_h);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={obsPts} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="t_h"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{ value: "Tempo (h)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "u (m³/s / mm)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: "#64748b",
          }}
          width={72}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => {
            if (name === "u_obs") return [`${v.toFixed(3)}`, "HU observado"];
            if (name === "u_scs") return [`${v.toFixed(3)}`, "HU SCS"];
            return [v, name];
          }}
          labelFormatter={(t) => `t = ${Number(t).toFixed(1)} h`}
        />
        <Line
          type="monotone"
          dataKey="u_obs"
          name="HU observado"
          stroke="#0D47A1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#0D47A1" }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="u_scs"
          name="HU SCS"
          stroke="#FB8C00"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
