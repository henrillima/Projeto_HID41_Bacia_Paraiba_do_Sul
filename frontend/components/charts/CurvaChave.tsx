"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvaChaveAjuste, MedicaoDescarga } from "@/lib/types";

interface CurvaChaveProps {
  ajuste: CurvaChaveAjuste | null;
  medicoes: MedicaoDescarga[];
  yLog?: boolean;
}

/**
 * Gráfico de curva-chave: dispersão dos pontos medidos (cota × vazão)
 * + curva ajustada Q = a · (h − h₀)^b sobreposta.
 *
 * Estilo visual em sintonia com os demais charts do projeto (azul ITA).
 */
export function CurvaChave({ ajuste, medicoes, yLog = false }: CurvaChaveProps) {
  // Pontos medidos
  const scatterData = medicoes
    .filter((m) => m.cota_m != null && m.vazao_m3s != null)
    .map((m) => ({
      cota_m: m.cota_m as number,
      vazao_m3s: m.vazao_m3s as number,
    }));

  // Curva ajustada — 80 pontos entre h_min e h_max
  let curveData: { cota_m: number; vazao_ajustada: number }[] = [];
  if (ajuste && ajuste.parametros) {
    const { a, b, h0, h_min, h_max } = ajuste.parametros;
    const hLo = h_min ?? (scatterData[0]?.cota_m ?? h0 + 0.01);
    const hHi = h_max ?? (scatterData[scatterData.length - 1]?.cota_m ?? hLo + 1);
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const h = hLo + (hHi - hLo) * (i / n);
      if (h <= h0) continue;
      const q = a * Math.pow(h - h0, b);
      curveData.push({ cota_m: h, vazao_ajustada: q });
    }
  }

  // Une os dois data sets em uma estrutura compatível com Recharts.
  const data = [
    ...scatterData.map((p) => ({ ...p, tipo: "obs" as const })),
    ...curveData.map((p) => ({ ...p, tipo: "curva" as const })),
  ];

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 12, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="cota_m"
            label={{ value: "Cota (m)", position: "insideBottom", offset: -6, fontSize: 11, fill: "#64748b" }}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            type="number"
            dataKey="vazao_m3s"
            scale={yLog ? "log" : "auto"}
            domain={yLog ? [0.1, "auto"] : ["auto", "auto"]}
            allowDataOverflow={yLog}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            label={{ value: "Q (m³/s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
            width={64}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number, name: string) => {
              if (name === "vazao_m3s") return [`${v.toFixed(2)} m³/s`, "Medida"];
              if (name === "vazao_ajustada") return [`${v.toFixed(2)} m³/s`, "Curva"];
              return [v, name];
            }}
            labelFormatter={(h) => `Cota ${Number(h).toFixed(2)} m`}
          />
          {ajuste?.parametros.h0 != null && (
            <ReferenceLine
              x={ajuste.parametros.h0}
              stroke="#94a3b8"
              strokeDasharray="2 4"
              label={{
                value: `h₀ = ${ajuste.parametros.h0.toFixed(2)} m`,
                position: "top",
                fontSize: 10,
                fill: "#64748b",
              }}
            />
          )}
          <Scatter
            name="vazao_m3s"
            dataKey="vazao_m3s"
            fill="#1565C0"
            stroke="#0D47A1"
            strokeWidth={0.5}
            shape="circle"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="vazao_ajustada"
            stroke="#FB8C00"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {ajuste && (
        <p className="text-xs text-slate-500">
          <span className="font-mono">
            Q = {ajuste.parametros.a.toFixed(4)} · (h − {ajuste.parametros.h0.toFixed(2)})
            <sup>{ajuste.parametros.b.toFixed(3)}</sup>
          </span>{" "}
          · R² = {ajuste.r2?.toFixed(4) ?? "—"} · RMSE = {ajuste.rmse?.toFixed(2) ?? "—"} m³/s · n =
          {" "}{ajuste.n_pontos ?? "—"} pontos
        </p>
      )}
    </div>
  );
}
