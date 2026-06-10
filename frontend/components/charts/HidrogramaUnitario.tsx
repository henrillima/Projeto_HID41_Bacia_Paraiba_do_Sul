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
import type {
  HidrogramaUnitarioObservado,
  HidrogramaUnitarioScs,
} from "@/lib/types";

interface HidrogramaUnitarioProps {
  observado: HidrogramaUnitarioObservado | null;
  scs: HidrogramaUnitarioScs | null;
}

/**
 * Hidrogramas Unitários — observado e SCS triangular.
 *
 * Os dois HUs têm escalas temporais muito diferentes na prática:
 *   - HU observado é diário (Δt = 1 d, base-time tipicamente 5–15 dias)
 *   - HU SCS triangular é horário (Δt = 1 h, base-time ~10 h para bacias
 *     com tc Kirpich ~5 h)
 *
 * Sobrepor as duas séries num mesmo eixo torna o SCS invisível (vira
 * pixel perto do zero). Por isso renderizamos em dois painéis lado a
 * lado, cada um na sua escala natural — com uma linha de referência
 * pontilhada no painel observado indicando onde o Tp do SCS cairia.
 */
export function HidrogramaUnitarioChart({ observado, scs }: HidrogramaUnitarioProps) {
  const obsPts =
    observado?.ordenadas_m3s_per_mm?.map((u, i) => ({
      t_d: i * (observado.dt_dias ?? 1),
      u_obs: Number(u),
    })) ?? [];

  const dt_scs_h = scs?.dt_min ? Number(scs.dt_min) / 60.0 : 1.0;
  const scsPts =
    scs?.ordenadas_m3s_per_mm?.map((u, i) => ({
      t_h: i * dt_scs_h,
      u_scs: Number(u),
    })) ?? [];

  const tpScsDias = scs?.t_pico_h != null ? Number(scs.t_pico_h) / 24.0 : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Escalas distintas — observado em <strong>dias</strong> (Δt da série),
        SCS em <strong>horas</strong> (Δt = {scs?.dt_min ?? "—"} min).
        Comparação direta entre os picos não é válida; reporte Tp lado-a-lado.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {/* ====================== PAINEL ESQUERDO ====================== */}
        <div className="rounded-lg border bg-white p-2">
          <p className="px-2 pt-1 text-sm font-semibold text-slate-700">
            HU observado médio — malha diária
            {observado?.n_eventos ? (
              <span className="ml-2 text-xs font-normal text-slate-400">
                (n = {observado.n_eventos} eventos)
              </span>
            ) : null}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={obsPts}
              margin={{ top: 12, right: 16, bottom: 6, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="t_d"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                label={{
                  value: "Tempo (dias)",
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
                  value: "u (m³/s/mm)",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "#64748b",
                }}
                width={68}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(3)}`, "HU obs."]}
                labelFormatter={(t) => `t = ${Number(t).toFixed(1)} d`}
              />
              {tpScsDias != null && (
                <ReferenceLine
                  x={tpScsDias}
                  stroke="#FB8C00"
                  strokeDasharray="4 3"
                  label={{
                    value: `Tp SCS ≈ ${Number(scs!.t_pico_h).toFixed(1)} h`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#FB8C00",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="u_obs"
                stroke="#0D47A1"
                strokeWidth={2}
                dot={{ r: 3, fill: "#0D47A1" }}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ====================== PAINEL DIREITO ====================== */}
        <div className="rounded-lg border bg-white p-2">
          <p className="px-2 pt-1 text-sm font-semibold text-slate-700">
            HU SCS triangular — malha horária
            {scs?.tc_min != null ? (
              <span className="ml-2 text-xs font-normal text-slate-400">
                (tc {scs.tc_metodo ?? ""} = {Number(scs.tc_min).toFixed(0)} min)
              </span>
            ) : null}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={scsPts}
              margin={{ top: 12, right: 16, bottom: 6, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="t_h"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                label={{
                  value: "Tempo (h)",
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
                  value: "u (m³/s/mm)",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "#64748b",
                }}
                width={68}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(3)}`, "HU SCS"]}
                labelFormatter={(t) => `t = ${Number(t).toFixed(1)} h`}
              />
              <Line
                type="monotone"
                dataKey="u_scs"
                stroke="#FB8C00"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
