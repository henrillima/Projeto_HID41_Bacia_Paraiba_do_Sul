"use client";

import { useMemo, useState } from "react";
import { Search, Target, Check } from "lucide-react";
import Link from "next/link";

import { useCandidatasFluvio, useConfigFluvio } from "@/hooks/useCandidatasFluvio";
import { KPICard } from "@/components/KPICard";
import { fmtArea } from "@/lib/utils";

export default function SelecaoFluvioPage() {
  const { data: candidatas, loading } = useCandidatasFluvio();
  const { data: config, saving, marcarOutlet, error } = useConfigFluvio();

  const [filtro, setFiltro] = useState("");
  const [minAnos, setMinAnos] = useState(0);

  const outletAtual = config.find((c) => c.is_outlet)?.codigo;

  const filtradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return candidatas.filter((c) => {
      if (c.anos_dados != null && c.anos_dados < minAnos) return false;
      if (!f) return true;
      return (
        c.codigo.toLowerCase().includes(f) ||
        (c.nome ?? "").toLowerCase().includes(f) ||
        (c.bacia_nome ?? "").toLowerCase().includes(f)
      );
    });
  }, [candidatas, filtro, minAnos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Target className="h-6 w-6 text-blue-700" />
          Seleção da estação exutória
        </h1>
        <p className="mt-1 text-slate-500">
          Candidatas fluviométricas ranqueadas pelo pipeline (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            python download_fluvio.py discover
          </code>
          ) com base em anos de dados, falhas e proximidade aos pluviômetros do projeto.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard titulo="Candidatas registradas" valor={String(candidatas.length)} />
        <KPICard
          titulo="Exutório atual"
          valor={outletAtual ?? "—"}
          destaque={!!outletAtual}
        />
        <KPICard
          titulo="Após escolher"
          valor="rodar pipeline_fluvio.py"
          subtitulo="para baixar e processar a série"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nome ou bacia…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-72 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Mín. anos
          </span>
          <input
            type="number"
            value={minAnos}
            onChange={(e) => setMinAnos(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabela de candidatas */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Bacia</th>
              <th className="px-3 py-2 text-right">Área (km²)</th>
              <th className="px-3 py-2 text-right">Anos</th>
              <th className="px-3 py-2 text-right">Dist (km)</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-center">Operando</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-slate-400">
                  Carregando candidatas…
                </td>
              </tr>
            )}
            {!loading && filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-slate-400">
                  Nenhuma candidata registrada. Rode <code>python download_fluvio.py discover</code>{" "}
                  no pipeline.
                </td>
              </tr>
            )}
            {filtradas.map((c) => {
              const ativo = c.codigo === outletAtual;
              return (
                <tr
                  key={c.codigo}
                  className={`border-b last:border-b-0 hover:bg-slate-50 ${
                    ativo ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{c.codigo}</td>
                  <td className="px-3 py-2 text-slate-700">{c.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{c.bacia_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {fmtArea(c.area_drenagem_km2)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {c.anos_dados != null ? c.anos_dados.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {c.dist_min_km != null ? c.dist_min_km.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">
                    {c.score != null ? c.score.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.operando ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600" />
                    ) : (
                      <span className="text-slate-300">·</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {ativo ? (
                      <span className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                        EXUTÓRIO
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          marcarOutlet(c.codigo, {
                            nome: c.nome ?? c.codigo,
                            lat: c.lat,
                            lon: c.lon,
                            area_drenagem_km2: c.area_drenagem_km2,
                          })
                        }
                        disabled={saving}
                        className="rounded-lg border border-blue-200 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Marcar como exutório
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Após escolher o exutório, rode no pipeline:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5">python pipeline_fluvio.py</code>{" "}
        para baixar séries de vazão/cotas, medições de descarga e ajustar a curva-chave. Os
        resultados aparecem em{" "}
        <Link href="/fluviometria" className="text-blue-700 hover:underline">
          /fluviometria
        </Link>
        .
      </p>
    </div>
  );
}
