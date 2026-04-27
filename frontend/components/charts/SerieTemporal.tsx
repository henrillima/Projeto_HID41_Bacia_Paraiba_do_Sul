"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { lttbDownsample } from "@/lib/utils";

interface Ponto {
  label: string;
  valor: number | null;
  preenchido?: boolean;
}

interface SerieTemporalProps {
  dados: Ponto[];
  cor?: string;
  corPreenchido?: string;
  yLabel?: string;
  media?: number;
  maxPoints?: number;
}

export function SerieTemporal({
  dados,
  cor = "#1565C0",
  corPreenchido = "#FB8C00",
  yLabel = "mm",
  media,
  maxPoints = 1500,
}: SerieTemporalProps) {
  // Downsampling para manter performance no Recharts
  const dadosNum = dados
    .map((d, i) => ({ x: i, y: d.valor ?? 0, label: d.label, preenchido: d.preenchido ?? false }))
    .filter((d) => d.y != null);

  const sampled =
    dadosNum.length > maxPoints
      ? lttbDownsample(dadosNum, maxPoints)
      : dadosNum;

  const chartData = sampled.map((d) => ({
    label: d.label,
    valor: d.y,
    preenchido: d.preenchido,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
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
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, _name: string, props: { payload?: { preenchido?: boolean } }) => [
            `${v.toFixed(1)} ${yLabel}`,
            props.payload?.preenchido ? "Preenchido" : "Observado",
          ]}
        />
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
          stroke={cor}
          dot={(props) => {
            if (!props?.payload?.preenchido) return <g key={props.key} />;
            return (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={2.5}
                fill={corPreenchido}
                stroke="none"
              />
            );
          }}
          strokeWidth={1.5}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Brush dataKey="label" height={24} stroke="#cbd5e1" travellerWidth={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
