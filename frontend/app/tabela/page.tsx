"use client";

import { useState, useMemo, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useEstacoes } from "@/hooks/useEstacoes";
import { useSerieDiariaCompleta } from "@/hooks/useSerieDiariaCompleta";
import { usePreenchimentoDiario } from "@/hooks/usePreenchimentoDiario";

const ROWS_PER_PAGE = 100;

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

export default function TabelaPage() {
  const { data: estacoes, loading: ldE } = useEstacoes();
  const [codigoSel, setCodigoSel] = useState<string>("");

  // When estacoes load, pre-select the reference station
  const codigo = codigoSel || estacoes.find((e) => e.is_referencia)?.codigo || estacoes[0]?.codigo || "";

  const { data: diaria, loading: ldD } = useSerieDiariaCompleta(codigo);
  const { data: preench, loading: ldP } = usePreenchimentoDiario(codigo);

  const loading = ldE || ldD || ldP;

  // Build lookup: date → preenchimento_diario row
  const preenchMap = useMemo(() => {
    const m = new Map<string, { reg: number | null; idw: number | null }>();
    for (const p of preench) {
      m.set(p.data.slice(0, 10), { reg: p.valor_regressao, idw: p.valor_idw });
    }
    return m;
  }, [preench]);

  // Build merged rows
  const rows = useMemo(() => {
    return diaria.map((d) => {
      const date = d.data.slice(0, 10);
      if (d.preenchido) {
        const p = preenchMap.get(date);
        return { date, original: null, regressao: p?.reg ?? null, idw: p?.idw ?? null, falha: true };
      }
      return { date, original: d.valor, regressao: null, idw: null, falha: false };
    });
  }, [diaria, preenchMap]);

  // Pagination
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const estacaoSel = estacoes.find((e) => e.codigo === codigo);
  const temIdw = preench.some((p) => p.valor_idw != null);

  // XLSX export
  const handleExport = useCallback(async () => {
    const { utils, writeFile } = await import("xlsx");
    const wsData = [
      ["Data", "Original (mm)", "Regressão (mm)", "IDW (mm)"],
      ...rows.map((r) => [
        r.date,
        r.original ?? "",
        r.regressao ?? "",
        r.idw ?? "",
      ]),
    ];
    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, estacaoSel?.nome ?? codigo);
    writeFile(wb, `serie_${codigo}.xlsx`);
  }, [rows, codigo, estacaoSel]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Série Temporal Completa</h1>
        <p className="mt-1 text-slate-500">
          Dados originais e valores corrigidos por cada método de preenchimento.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Estação</label>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={codigo}
          onChange={(e) => { setCodigoSel(e.target.value); setPage(0); }}
          disabled={ldE}
        >
          {estacoes.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nome} ({e.codigo}){e.is_referencia ? " — referência" : ""}
            </option>
          ))}
        </select>

        <button
          onClick={handleExport}
          disabled={loading || rows.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={14} />
          Exportar XLSX
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-white border border-slate-200" />
          Dia observado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-amber-100 border border-amber-300" />
          Dia com falha (preenchido)
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-slate-400">
            Carregando série completa…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-slate-400">
            Sem dados para esta estação. Execute o pipeline primeiro.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-right font-semibold">Original (mm)</th>
                    <th className="px-4 py-3 text-right font-semibold">Regressão (mm)</th>
                    <th className="px-4 py-3 text-right font-semibold">IDW (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((r) => (
                    <tr
                      key={r.date}
                      className={r.falha ? "bg-amber-50" : "hover:bg-slate-50"}
                    >
                      <td className="px-4 py-2 font-mono text-slate-600">{r.date}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {r.falha ? (
                          <span className="text-amber-500 italic text-xs">falha</span>
                        ) : (
                          fmt(r.original)
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${r.falha ? "text-blue-700 font-semibold" : "text-slate-300"}`}>
                        {r.falha ? fmt(r.regressao) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${r.falha ? (temIdw ? "text-emerald-700 font-semibold" : "text-slate-400") : "text-slate-300"}`}>
                        {r.falha ? (temIdw ? fmt(r.idw) : <span className="text-xs italic">n/d</span>) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <span>
                {rows.length.toLocaleString("pt-BR")} registros ·{" "}
                {diaria.filter((d) => d.preenchido).length} falhas preenchidas
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
