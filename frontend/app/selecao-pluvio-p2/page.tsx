"use client";

import { useMemo, useState } from "react";
import { Search, CloudRain, Check, Terminal } from "lucide-react";
import Link from "next/link";

import { useCandidatasPluvioP2, useConfigPluvioP2 } from "@/hooks/useCandidatasPluvioP2";
import { KPICard } from "@/components/KPICard";

export default function SelecaoPluvioP2Page() {
  const { data: candidatas, loading } = useCandidatasPluvioP2();
  const { data: config, saving, ativar, desativar, error } = useConfigPluvioP2();

  const [filtro, setFiltro] = useState("");
  const [minAnos, setMinAnos] = useState(0);
  const [maxDist, setMaxDist] = useState<number | "">("");

  const ativos = useMemo(
    () => new Set(config.filter((c) => c.ativo).map((c) => c.codigo)),
    [config],
  );

  const filtradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return candidatas.filter((c) => {
      if (c.anos_dados != null && c.anos_dados < minAnos) return false;
      if (
        maxDist !== "" &&
        c.dist_exutorio_km != null &&
        c.dist_exutorio_km > Number(maxDist)
      )
        return false;
      if (!f) return true;
      return (
        c.codigo.toLowerCase().includes(f) ||
        (c.nome ?? "").toLowerCase().includes(f) ||
        (c.bacia_nome ?? "").toLowerCase().includes(f)
      );
    });
  }, [candidatas, filtro, minAnos, maxDist]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Projeto 2 · Fase 3 (chuva-vazão)
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <CloudRain className="h-6 w-6 text-blue-700" />
          Pluviômetros para a bacia do Projeto 2
        </h1>
        <p className="mt-1 text-slate-500">
          Estações pluviométricas próximas da bacia do exutório (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">58142200 — BUQUIRINHA II</code>
          ) ranqueadas por anos de dados e distância ao exutório. As ativas
          alimentam o cálculo da chuva média da bacia para isolamento de
          eventos chuva-vazão e hidrograma unitário observado.
        </p>
        <p className="mt-2 text-xs text-amber-700">
          ⚠ Os pluviômetros do Projeto 1 (Pindamonhangaba/Estrada do Cunha/SLP)
          estão 51–90 km da bacia — preservados em
          {" "}
          <Link href="/estacoes" className="underline hover:text-amber-800">
            /estacoes
          </Link>
          , não tocados por esta seleção.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard titulo="Candidatas registradas" valor={String(candidatas.length)} />
        <KPICard
          titulo="Ativos no Projeto 2"
          valor={String(ativos.size)}
          subtitulo="usados pela média de chuva da bacia"
          destaque={ativos.size > 0}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Terminal className="h-3.5 w-3.5" />
            Próximos passos
          </p>
          <code className="mt-2 block font-mono text-sm font-semibold text-emerald-300">
            python download_pluvio_p2.py baixar --do-config
          </code>
          <code className="mt-1 block font-mono text-sm font-semibold text-emerald-300">
            python pipeline_fluvio.py
          </code>
          <p className="mt-1 text-xs text-slate-400">
            baixa as séries e re-roda a Fase 3 com chuva representativa
          </p>
        </div>
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Máx. dist (km)
          </span>
          <input
            type="number"
            value={maxDist}
            placeholder="—"
            onChange={(e) => setMaxDist(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Bacia</th>
              <th className="px-3 py-2 text-right">Altitude (m)</th>
              <th className="px-3 py-2 text-right">Anos</th>
              <th className="px-3 py-2 text-right">Dist. exutório (km)</th>
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
                  Nenhuma candidata registrada. Rode{" "}
                  <code>python download_pluvio_p2.py discover</code> no pipeline.
                </td>
              </tr>
            )}
            {filtradas.map((c) => {
              const ativo = ativos.has(c.codigo);
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
                    {c.altitude != null ? c.altitude.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {c.anos_dados != null ? c.anos_dados.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {c.dist_exutorio_km != null ? c.dist_exutorio_km.toFixed(1) : "—"}
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
                      <button
                        onClick={() => desativar(c.codigo)}
                        disabled={saving}
                        className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        ATIVO · clique para desativar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          ativar(c.codigo, {
                            nome: c.nome ?? c.codigo,
                            lat: c.lat,
                            lon: c.lon,
                            altitude: c.altitude,
                          })
                        }
                        disabled={saving}
                        className="rounded-lg border border-blue-200 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Ativar para P2
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
        Após ativar 1–3 estações, rode no pipeline:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5">
          python download_pluvio_p2.py baixar --do-config
        </code>{" "}
        para baixar as séries pluviométricas via REST, e em seguida{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5">python pipeline_fluvio.py</code>{" "}
        para recomputar a Fase 3 (isolamento de eventos, HU observado, φ-index).
      </p>
    </div>
  );
}
