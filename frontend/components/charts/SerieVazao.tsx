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
import { lttbDownsample } from "@/lib/utils";

interface Ponto {
  label: string;
  valor: number | null;
  preenchido?: boolean;
}

interface SerieVazaoProps {
  dados: Ponto[];
  cor?: string;
  corPreenchido?: string;
  yLabel?: string;
  media?: number;
  maxPoints?: number;
  /** Eixo Y em escala log10. Recomendado para curva de permanência futura. */
  yLog?: boolean;
}

/**
 * Variante de `SerieTemporal` parametrizada para fluviometria.
 * - Mesmo padrão visual (LTTB + dots de preenchimento) usado nas séries pluvio.
 * - Unidade m³/s; eixo Y opcionalmente log.
 * - Preenchido = vazão derivada de cota via curva-chave.
 */
export function SerieVazao({
  dados,
  cor = "#0D47A1",
  corPreenchido = "#FB8C00",
  yLabel = "m³/s",
  media,
  maxPoints = 1500,
  yLog = false,
}: SerieVazaoProps) {
  const dadosNum = dados
    .map((d, i) => ({
      x: i,
      y: d.valor ?? 0,
      label: d.label,
      preenchido: d.preenchido ?? false,
    }))
    .filter((d) => d.y != null && (yLog ? d.y > 0 : true));

  const sampled =
    dadosNum.length > maxPoints ? lttbDownsample(dadosNum, maxPoints) : dadosNum;

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
          scale={yLog ? "log" : "auto"}
          domain={yLog ? [0.1, "dataMax"] : ["auto", "auto"]}
          allowDataOverflow={yLog}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, _name: string, props: { payload?: { preenchido?: boolean } }) => [
            `${v.toFixed(2)} ${yLabel}`,
            props.payload?.preenchido ? "Via curva-chave" : "Observado",
          ]}
        />
        {media != null && (
          <ReferenceLine
            y={media}
            stroke="#64748b"
            strokeDasharray="4 2"
            label={{
              value: `Média: ${media.toFixed(2)} m³/s`,
              fontSize: 10,
              fill: "#64748b",
            }}
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
      </LineChart>
    </ResponsiveContainer>
  );
}
