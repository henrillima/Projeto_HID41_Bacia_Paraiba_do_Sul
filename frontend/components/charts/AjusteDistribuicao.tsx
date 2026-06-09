"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FrequenciaQuantil, MaxAnualVazao } from "@/lib/types";

interface AjusteDistribuicaoProps {
  maximos: MaxAnualVazao[];
  quantis: FrequenciaQuantil[];
}

/**
 * Papel de probabilidade (TR log × Q):
 *   - Pontos empíricos (posição de plotagem de Weibull)
 *   - Curva ajustada (quantis_tr) com banda IC.
 */
export function AjusteDistribuicao({ maximos, quantis }: AjusteDistribuicaoProps) {
  const validos = maximos
    .filter((m) => m.q_max_m3s != null)
    .map((m) => m.q_max_m3s as number)
    .sort((a, b) => b - a);
  const n = validos.length;

  // Weibull p = m/(n+1), ordenação decrescente → TR = 1/p
  const empirico = validos.map((q, i) => {
    const m = i + 1;
    const p = m / (n + 1);
    return { tr: 1 / p, q };
  });

  const curva = quantis
    .filter((q) => q.q_tr_m3s != null)
    .map((q) => ({
      tr: q.tr,
      q_ajustado: q.q_tr_m3s as number,
      ic_lo: q.ic_lo ?? null,
      ic_hi: q.ic_hi ?? null,
    }));

  const data = [
    ...empirico.map((p) => ({ tr: p.tr, q: p.q })),
    ...curva.map((p) => ({
      tr: p.tr,
      q_ajustado: p.q_ajustado,
      ic_lo: p.ic_lo,
      ic_hi: p.ic_hi,
    })),
  ];

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="tr"
          scale="log"
          domain={[1, 1100]}
          ticks={[1, 2, 5, 10, 25, 50, 100, 500, 1000]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{
            value: "TR (anos, log)",
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
          label={{
            value: "Q (m³/s)",
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
            if (name === "q") return [`${v.toFixed(1)} m³/s`, "Q observada"];
            if (name === "q_ajustado") return [`${v.toFixed(1)} m³/s`, "Q ajustada"];
            if (name === "ic_lo") return [`${v.toFixed(1)} m³/s`, "IC inf"];
            if (name === "ic_hi") return [`${v.toFixed(1)} m³/s`, "IC sup"];
            return [v, name];
          }}
          labelFormatter={(tr) => `TR = ${Number(tr).toFixed(1)} anos`}
        />
        <Scatter
          dataKey="q"
          fill="#1565C0"
          stroke="#0D47A1"
          strokeWidth={0.5}
          shape="circle"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="ic_hi"
          stroke="#FB8C00"
          strokeDasharray="4 2"
          strokeWidth={1}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="ic_lo"
          stroke="#FB8C00"
          strokeDasharray="4 2"
          strokeWidth={1}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="q_ajustado"
          stroke="#FB8C00"
          strokeWidth={2.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
