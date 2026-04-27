import type { EstatisticasDescritivas } from "@/lib/types";
import { fmtMm, fmtPct } from "@/lib/utils";

interface TabelaEstatisticasProps {
  est: EstatisticasDescritivas;
  unidade?: string;
}

export function TabelaEstatisticas({ est, unidade = "mm" }: TabelaEstatisticasProps) {
  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : `${v.toFixed(2)} ${unidade}`;

  const rows: [string, string][] = [
    ["Média",          fmt(est.media)],
    ["Mediana",        fmt(est.mediana)],
    ["Desvio padrão",  fmt(est.desvio_padrao)],
    ["Mínimo",         fmt(est.min)],
    ["Máximo",         fmt(est.max)],
    ["P25",            fmt(est.p25)],
    ["P75",            fmt(est.p75)],
    ["P90",            fmt(est.p90)],
    ["P95",            fmt(est.p95)],
    ["P99",            fmt(est.p99)],
    ["Coef. variação", est.coef_variacao != null ? `${(est.coef_variacao * 100).toFixed(1)}%` : "—"],
    ["Assimetria",     est.assimetria != null ? est.assimetria.toFixed(4) : "—"],
    ["Curtose (exc.)", est.curtose != null ? est.curtose.toFixed(4) : "—"],
    ["Observações",    est.n_observacoes.toString()],
    ["Falhas",         `${est.n_falhas} (${fmtPct(est.pct_falhas)})`],
  ];

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0">
            <td className="py-1.5 pr-4 text-slate-500">{label}</td>
            <td className="py-1.5 text-right font-mono font-semibold text-slate-800">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
