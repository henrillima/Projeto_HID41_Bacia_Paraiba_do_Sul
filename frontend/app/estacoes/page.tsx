"use client";

import { useEstacoes } from "@/hooks/useEstacoes";
import { fmtMm, fmtPct } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { ResumoEstacao } from "@/lib/types";

type SortKey = keyof Pick<ResumoEstacao, "anos_dados" | "pct_falhas_original" | "media_anual_mm">;

export default function EstacoesPage() {
  const { data: estacoes, loading } = useEstacoes();
  const [sortKey, setSortKey] = useState<SortKey>("anos_dados");
  const [asc, setAsc] = useState(false);

  const sorted = [...estacoes].sort((a, b) => {
    const va = a[sortKey] ?? -Infinity;
    const vb = b[sortKey] ?? -Infinity;
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc(!asc);
    else { setSortKey(key); setAsc(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Estações pluviométricas escolhidas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clique em uma estação para ver as séries históricas e histogramas.
        </p>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Lat / Lon</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("anos_dados")}>
                  <span className="flex items-center justify-end gap-1">
                    Anos <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("media_anual_mm")}>
                  <span className="flex items-center justify-end gap-1">
                    Média anual <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("pct_falhas_original")}>
                  <span className="flex items-center justify-end gap-1">
                    Falhas <ArrowUpDown size={12} />
                  </span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.codigo} className="border-b last:border-0 hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.codigo}
                    {e.is_referencia && (
                      <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        REF
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.nome}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {e.lat.toFixed(3)}, {e.lon.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {e.data_inicio?.slice(0, 4)} – {e.data_fim?.slice(0, 4)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{e.anos_dados}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {fmtMm(e.media_anual_mm, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <span className={e.pct_falhas_original > 10 ? "text-orange-600" : "text-emerald-600"}>
                      {fmtPct(e.pct_falhas_original)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/series?estacao=${e.codigo}`}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Ver séries
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
