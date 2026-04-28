import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EstatisticasDescritivas, HistogramaData } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMm(v: number | null | undefined, decimais = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(decimais)} mm`;
}

export function fmtPct(v: number | null | undefined, decimais = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(decimais)}%`;
}

export function fmtData(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export function fmtAnoMes(ano: number, mes: number): string {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

/** Computes descriptive statistics from an array of values (nulls counted as failures). */
export function computeStats(values: (number | null)[]): EstatisticasDescritivas {
  const valid = values.filter((v): v is number => v != null);
  const n = valid.length;
  const nFalhas = values.length - n;
  const total = values.length;

  if (n === 0) {
    return {
      media: 0, mediana: 0, desvio_padrao: 0, min: 0, max: 0,
      p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0,
      n_observacoes: 0, n_falhas: nFalhas,
      pct_falhas: total > 0 ? nFalhas / total : 0,
      coef_variacao: null, assimetria: null, curtose: null,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const mean = valid.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? valid.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);

  const pct = (p: number) => {
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  // Fisher-Pearson corrected skewness
  let assimetria: number | null = null;
  if (n >= 3 && std > 0) {
    const m3 = valid.reduce((s, v) => s + ((v - mean) / std) ** 3, 0);
    assimetria = (n / ((n - 1) * (n - 2))) * m3;
  }

  // Excess kurtosis (corrected, unbiased)
  let curtose: number | null = null;
  if (n >= 4 && std > 0) {
    const m4 = valid.reduce((s, v) => s + ((v - mean) / std) ** 4, 0);
    curtose =
      ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4 -
      (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  }

  return {
    media: mean,
    mediana: pct(50),
    desvio_padrao: std,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: pct(25),
    p50: pct(50),
    p75: pct(75),
    p90: pct(90),
    p95: pct(95),
    p99: pct(99),
    n_observacoes: n,
    n_falhas: nFalhas,
    pct_falhas: total > 0 ? nFalhas / total : 0,
    coef_variacao: mean !== 0 ? std / mean : null,
    assimetria,
    curtose,
  };
}

/** Bins an array of values into a histogram with descriptive statistics. */
export function computeHistogram(values: (number | null)[], nBins = 20): HistogramaData {
  const est = computeStats(values);
  const valid = values.filter((v): v is number => v != null);

  if (valid.length === 0) return { bins: [], counts: [], bin_centers: [], estatisticas: est };

  const lo = est.min;
  const hi = est.max;

  if (lo === hi) {
    return { bins: [lo, hi + 1], counts: [valid.length], bin_centers: [lo], estatisticas: est };
  }

  const w = (hi - lo) / nBins;
  const bins = Array.from({ length: nBins + 1 }, (_, i) => lo + i * w);
  const bin_centers = Array.from({ length: nBins }, (_, i) => lo + (i + 0.5) * w);
  const counts = new Array<number>(nBins).fill(0);

  for (const v of valid) {
    let idx = Math.floor((v - lo) / w);
    if (idx >= nBins) idx = nBins - 1;
    counts[idx]++;
  }

  return { bins, counts, bin_centers, estatisticas: est };
}

/** Downsampling LTTB — reduz uma série para ~maxPoints preservando forma visual. */
export function lttbDownsample<T extends { x: number; y: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  const sampled: T[] = [data[0]];
  const bucketSize = (data.length - 2) / (maxPoints - 2);

  let a = 0;
  for (let i = 0; i < maxPoints - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    // Média do próximo bucket
    let avgX = 0, avgY = 0;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= rangeEnd - rangeStart;
    avgY /= rangeEnd - rangeStart;

    // Bucket atual
    const currStart = Math.floor(i * bucketSize) + 1;
    const currEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);

    let maxArea = -1;
    let maxIdx = currStart;
    for (let j = currStart; j < currEnd; j++) {
      const area = Math.abs(
        (data[a].x - avgX) * (data[j].y - data[a].y) -
        (data[a].x - data[j].x) * (avgY - data[a].y)
      );
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }
    sampled.push(data[maxIdx]);
    a = maxIdx;
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}
