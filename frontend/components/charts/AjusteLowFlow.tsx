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
import type { Q710Ajuste, Q7Minimo } from "@/lib/types";

interface AjusteLowFlowProps {
  minimos: Q7Minimo[];
  ajuste: Q710Ajuste | null;
}

/**
 * Papel de probabilidade para mínimos:
 *   X = TR (anos, escala log) ; Y = Q7 (m³/s)
 * Pontos empíricos por Weibull (mínimos: ordenação crescente, P = m/(n+1))
 * + curva LP3 ajustada + linha vertical em TR=10 destacando Q7,10.
 */
export function AjusteLowFlow({ minimos, ajuste }: AjusteLowFlowProps) {
  const dados = minimos
    .filter((m) => m.q7_m3s != null)
    .map((m) => m.q7_m3s as number)
    .sort((a, b) => a - b);
  const n = dados.length;

  // Posição de plotagem para mínimos: ordenação crescente, P = m/(n+1)
  const empirico = dados.map((q, i) => {
    const m = i + 1;
    const p_nao_excedencia = m / (n + 1);  // 0..1
    const tr = 1 / p_nao_excedencia;
    return { tr, q };
  });

  // Curva LP3 ajustada (de TR ≈ 1.05 a TR = 100 anos)
  let curva: { tr: number; q_ajustado: number }[] = [];
  if (ajuste && ajuste.parametros) {
    const { mu_log, sigma_log, skew_log } = ajuste.parametros;
    if (mu_log != null && sigma_log != null) {
      // 80 pontos em log-spacing 1.05 .. 100
      const N = 80;
      for (let i = 0; i <= N; i++) {
        const tr = 1.05 * Math.pow(100 / 1.05, i / N);
        const p = 1 / tr;
        // Inversa da Pearson III ≈ aproximação via normal padrão + correção (Wilson-Hilferty
        // simplificada). Aqui usamos a forma de "fator de frequência" para LP3:
        //    z = Φ⁻¹(p)
        //    K_T = (2/skew) * [ (1 + skew*z/6 - skew²/36)^3 - 1 ]
        //    y = mu_log + K_T * sigma_log
        const z = invNormal(p);
        const g = skew_log ?? 0;
        let kt: number;
        if (Math.abs(g) < 1e-6) kt = z;
        else {
          const base = 1 + (g * z) / 6 - (g * g) / 36;
          kt = (2 / g) * (Math.pow(base, 3) - 1);
        }
        const y = mu_log + kt * sigma_log;
        curva.push({ tr, q_ajustado: Math.exp(y) });
      }
    }
  }

  const data = [
    ...empirico.map((p) => ({ tr: p.tr, q: p.q, tipo: "obs" as const })),
    ...curva.map((p) => ({ tr: p.tr, q_ajustado: p.q_ajustado, tipo: "fit" as const })),
  ];

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="tr"
          scale="log"
          domain={[1, 100]}
          ticks={[1, 2, 5, 10, 25, 50, 100]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          label={{
            value: "Período de retorno TR (anos, log)",
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
          label={{ value: "Q7 (m³/s)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => {
            if (name === "q") return [`${v.toFixed(3)} m³/s`, "Q7 obs."];
            if (name === "q_ajustado") return [`${v.toFixed(3)} m³/s`, "LP3 ajustada"];
            return [v, name];
          }}
          labelFormatter={(tr) => `TR = ${Number(tr).toFixed(1)} anos`}
        />
        {ajuste?.q7_10_m3s != null && (
          <ReferenceLine
            x={10}
            stroke="#dc2626"
            strokeDasharray="3 3"
            label={{
              value: `Q7,10 = ${ajuste.q7_10_m3s.toFixed(3)} m³/s`,
              fontSize: 10,
              fill: "#dc2626",
            }}
          />
        )}
        <Scatter
          name="q"
          dataKey="q"
          fill="#1565C0"
          stroke="#0D47A1"
          strokeWidth={0.5}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="q_ajustado"
          stroke="#FB8C00"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Inversa da normal padrão — aproximação de Beasley-Springer-Moro
function invNormal(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  // Boa precisão suficiente para visualização
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
             138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
             66.8013118877197, -13.2806815528857];
  const c = [-7.78489400243029e-3, -0.322396458041136, -2.40075827716184,
             -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [7.78469570904146e-3, 0.32246712907004, 2.445134137143,
             3.75440866190742];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}
