"use client";

import Link from "next/link";
import { Target, Check, X, Terminal, Info } from "lucide-react";

import { useEstacoesFluvio } from "@/hooks/useEstacoesFluvio";
import { KPICard } from "@/components/KPICard";
import { fmtArea } from "@/lib/utils";

/**
 * Página da estação exutória do projeto.
 *
 * Mostra apenas as estações fluviométricas EM USO (gravadas em
 * `estacoes_fluvio` pelo `pipeline_fluvio.py`). Sem ranqueamento ad-hoc.
 * Dados exibidos são todos extraídos do inventário ANA + estatísticas
 * calculadas pelo pipeline sobre a série real (não estimativas).
 */
export default function SelecaoFluvioPage() {
  const { data: estacoes, loading } = useEstacoesFluvio();

  const outlet = estacoes.find((e) => e.is_outlet);
  const outletAtual = outlet?.codigo ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Target className="h-6 w-6 text-blue-700" />
          Estação fluviométrica exutória
        </h1>
        <p className="mt-1 text-slate-500">
          Estação(ões) processada(s) pelo pipeline fluviométrico, com dados base
          do inventário ANA HidroWebService e estatísticas da série real.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard
          titulo="Exutório atual"
          valor={outletAtual}
          subtitulo={outlet?.nome ?? undefined}
          destaque={!!outlet}
        />
        <KPICard
          titulo="Área de drenagem"
          valor={
            outlet?.area_drenagem_km2 != null
              ? `${fmtArea(outlet.area_drenagem_km2)} km²`
              : "—"
          }
          subtitulo="bacia até o exutório"
        />
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Terminal className="h-3.5 w-3.5" />
            Pipeline
          </p>
          <code className="mt-2 block font-mono text-base font-semibold text-emerald-300">
            python pipeline_fluvio.py
          </code>
          <p className="mt-1 text-xs text-slate-400">
            baixa e processa a série do exutório fixado em config.yaml
          </p>
        </div>
      </div>

      {/* Tabela das estações */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Bacia</th>
              <th className="px-3 py-2">Operadora</th>
              <th className="px-3 py-2 text-right">Área (km²)</th>
              <th className="px-3 py-2 text-right">Altitude (m)</th>
              <th className="px-3 py-2 text-right">Anos</th>
              <th className="px-3 py-2 text-right">Falhas (%)</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2 text-center">Operando</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                  Carregando estações…
                </td>
              </tr>
            )}
            {!loading && estacoes.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma estação processada ainda. Rode{" "}
                  <code className="rounded bg-slate-100 px-1">
                    python pipeline_fluvio.py
                  </code>{" "}
                  no pipeline.
                </td>
              </tr>
            )}
            {estacoes.map((e) => (
              <tr
                key={e.codigo}
                className={`border-b last:border-b-0 hover:bg-slate-50 ${
                  e.is_outlet ? "bg-blue-50/60" : ""
                }`}
              >
                <td className="px-3 py-2.5 font-mono text-slate-700">
                  {e.codigo}
                  {e.is_outlet && (
                    <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Exutório
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{e.nome}</td>
                <td className="px-3 py-2.5 text-slate-500">{e.bacia_nome ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-500">{e.operadora ?? "—"}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {e.area_drenagem_km2 != null ? fmtArea(e.area_drenagem_km2) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {e.altitude != null ? e.altitude.toFixed(0) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {e.anos_dados != null ? Number(e.anos_dados).toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {e.pct_falhas_vazao != null
                    ? `${Number(e.pct_falhas_vazao).toFixed(1)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {e.data_inicio?.slice(0, 4) ?? "—"} – {e.data_fim?.slice(0, 4) ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {e.operando ? (
                    <Check className="mx-auto h-4 w-4 text-emerald-600" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-slate-300" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Info className="h-4 w-4 text-slate-500" />
          Como mudar o exutório
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
          <li>
            Editar{" "}
            <code className="rounded bg-white px-1 py-0.5">
              pipeline/config.yaml → fluviometria.exutorio_codigo
            </code>{" "}
            e rodar{" "}
            <code className="rounded bg-white px-1 py-0.5">python pipeline_fluvio.py</code>.
          </li>
          <li>
            Estações antigas são removidas automaticamente pela função{" "}
            <code className="rounded bg-white px-1 py-0.5">_purgar_outras_estacoes()</code>{" "}
            no início de cada run.
          </li>
          <li>
            Resultados aparecem em{" "}
            <Link href="/fluviometria" className="text-blue-700 hover:underline">
              /fluviometria
            </Link>
            ,{" "}
            <Link href="/regime" className="text-blue-700 hover:underline">
              /regime
            </Link>
            ,{" "}
            <Link href="/eventos" className="text-blue-700 hover:underline">
              /eventos
            </Link>{" "}
            e{" "}
            <Link href="/extremos" className="text-blue-700 hover:underline">
              /extremos
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
