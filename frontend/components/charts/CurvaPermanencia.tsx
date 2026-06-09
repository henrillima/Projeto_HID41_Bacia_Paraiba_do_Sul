"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvaPermanenciaPonto, QuantisPermanencia } from "@/lib/types";

interface CurvaPermanenciaProps {
  pontos: CurvaPermanenciaPonto[];
  quantis?: QuantisPermanencia | null;
  yLog?: boolean;
}

/** Curva de permanência (Weibull) com marcadores Q10/Q50/Q90. */
export function CurvaPermanencia({ pontos, quantis, yLog = true }: CurvaPermanenciaProps) {
  const data = pontos
    .filter((p) => p.vazao_m3s != null && (yLog ? (p.vazao_m3s as number) > 0 : true))
    .map((p) => ({
      percentil: p.percentil,
      vazao: p.vazao_m3s as number,
    }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="percentil"
          domain={[0, 100]}
          ticks={[0, 5, 10, 25, 50, 75, 90, 95, 100]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{
            value: "% do tempo Q ≥ valor (Weibull)",
            position: "insideBottom",
            offset: -2,
            fontSize: 11,
            fill: "#64748b",
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          scale={yLog ? "log" : "auto"}
          domain={yLog ? [0.1, "auto"] : ["auto", "auto"]}
          allowDataOverflow={yLog}
          label={{ value: "Q (m³/s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [`${v.toFixed(2)} m³/s`, "Q"]}
          labelFormatter={(p) => `P = ${Number(p).toFixed(1)}%`}
        />
        {quantis?.q10 != null && (
          <ReferenceLine
            x={10}
            stroke="#dc2626"
            strokeDasharray="3 3"
            label={{ value: `Q10 = ${quantis.q10.toFixed(1)}`, fontSize: 10, fill: "#dc2626" }}
          />
        )}
        {quantis?.q50 != null && (
          <ReferenceLine
            x={50}
            stroke="#1d4ed8"
            strokeDasharray="3 3"
            label={{ value: `Q50 = ${quantis.q50.toFixed(1)}`, fontSize: 10, fill: "#1d4ed8" }}
          />
        )}
        {quantis?.q90 != null && (
          <ReferenceLine
            x={90}
            stroke="#059669"
            strokeDasharray="3 3"
            label={{ value: `Q90 = ${quantis.q90.toFixed(1)}`, fontSize: 10, fill: "#059669" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="vazao"
          stroke="#0D47A1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
