import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
