"use client";

import { useState, useMemo } from "react";
import { useEstacoesCandidatas } from "@/hooks/useEstacoesCandidatas";
import { useConfigEstacoes } from "@/hooks/useConfigEstacoes";
import type { ConfigEstacao, EstacaoCandidata } from "@/lib/types";

function QualidadeBadge({ pct }: { pct: number }) {
  const cor =
    pct < 2 ? "bg-emerald-100 text-emerald-700" :
    pct < 5 ? "bg-green-100 text-green-700" :
    pct < 15 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-mono ${cor}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function AnosBadge({ anos }: { anos: number }) {
  const cor =
    anos >= 60 ? "bg-blue-100 text-blue-700" :
    anos >= 30 ? "bg-sky-100 text-sky-700" :
    "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-mono font-bold ${cor}`}>
      {anos}
    </span>
  );
}

export default function SelecaoPage() {
  const { data: candidatas, loading: ldC } = useEstacoesCandidatas();
  const { data: configuradas, loading: ldCfg, saving, salvar } = useConfigEstacoes();

  // Filters
  const [minAnos, setMinAnos] = useState(20);
  const [maxFalhas, setMaxFalhas] = useState(15);
  const [busca, setBusca] = useState("");

  // Local selection state (mirror of configuradas, editable)
  const [selecao, setSelecao] = useState<Record<string, ConfigEstacao>>(() => {
    const map: Record<string, ConfigEstacao> = {};
    configuradas.forEach((e) => { map[e.codigo] = e; });
    return map;
  });

  // Sync from DB on load
  const [synced, setSynced] = useState(false);
  if (!ldCfg && !synced && configuradas.length > 0) {
    const map: Record<string, ConfigEstacao> = {};
    configuradas.forEach((e) => { map[e.codigo] = e; });
    setSelecao(map);
    setSynced(true);
  }

  const filtradas = useMemo(() =>
    candidatas.filter((c) =>
      c.anos_bons >= minAnos &&
      c.pct_falhas <= maxFalhas &&
      (busca === "" || c.codigo.includes(busca))
    ),
    [candidatas, minAnos, maxFalhas, busca]
  );

  const toggleEstacao = (c: EstacaoCandidata) => {
    setSelecao((prev) => {
      const next = { ...prev };
      if (next[c.codigo]) {
        delete next[c.codigo];
      } else {
        next[c.codigo] = {
          codigo: c.codigo,
          nome: "",
          lat: null,
          lon: null,
          altitude: null,
          is_referencia: false,
        };
      }
      return next;
    });
  };

  const setReferencia = (codigo: string) => {
    setSelecao((prev) => {
      const next: Record<string, ConfigEstacao> = {};
      Object.entries(prev).forEach(([k, v]) => {
        next[k] = { ...v, is_referencia: k === codigo };
      });
      return next;
    });
  };

  const updateField = (codigo: string, field: keyof ConfigEstacao, value: string | number | boolean | null) => {
    setSelecao((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], [field]: value },
    }));
  };

  const selecionadas = Object.values(selecao);
  const prontas = selecionadas.filter((e) => e.lat && e.lon && e.nome);
  const temReferencia = selecionadas.some((e) => e.is_referencia);

  const handleSalvar = async () => {
    if (!temReferencia && selecionadas.length > 0) {
      alert("Defina uma estação de referência antes de salvar.");
      return;
    }
    await salvar(selecionadas);
    alert(`${selecionadas.length} estações salvas com sucesso!`);
  };

  if (ldC) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Carregando estações candidatas...
      </div>
    );
  }

  if (candidatas.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-800">Inventário de candidatas não encontrado</p>
        <p className="mt-1 text-sm text-amber-700">
          Execute no terminal para popular o inventário:
        </p>
        <pre className="mt-2 rounded bg-slate-900 px-4 py-3 text-sm text-green-400">
          cd pipeline{"\n"}python discover.py --exportar-candidatas
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Seleção de Estações</h1>
        <p className="mt-1 text-slate-500">
          Escolha as estações para análise, informe as coordenadas e defina a estação de referência.
          Após salvar, execute <code className="rounded bg-slate-100 px-1 text-slate-700">python pipeline.py</code> no terminal.
        </p>
      </div>

      {/* Aviso para a professora */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl">⚠️</span>
          <div className="space-y-2 text-sm">
            <p className="font-bold text-amber-900">
              Nota para a professora — funcionalidade restrita na versão em produção
            </p>
            <p className="text-amber-800">
              Esta aba de seleção de estações <strong>ainda não está integrada na versão de deploy</strong>{" "}
              (acessível publicamente via Vercel). No estado atual, ela funciona apenas na versão local,
              pois parte do processo requer execução manual de scripts Python no terminal e inserção
              direta de coordenadas geográficas — informações que não constam nos arquivos ZIP
              disponibilizados pela ANA HidroWeb e que precisam ser obtidas separadamente no portal.
            </p>
            <p className="text-amber-800">
              Para viabilizar a automação completa desta etapa, entrei em contato com a ANA solicitando
              acesso à <strong>API do HidroWeb</strong>. Quando esse acesso for concedido, será possível
              buscar automaticamente os dados de qualquer estação — incluindo coordenadas e série histórica
              — diretamente desta interface, sem necessidade de intervenção manual ou execução local.
              A integração desta aba com a API já está planejada na arquitetura do sistema.
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-semibold text-amber-700 hover:underline">
                Ver e-mail enviado à ANA (clique para expandir)
              </summary>
              <div className="mt-3 rounded-lg border border-amber-200 bg-white px-4 py-3 text-xs text-slate-700 leading-relaxed">
                <p className="mb-2 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">E-mail enviado à ANA HidroWeb</p>
                <p><strong>Prezados,</strong></p>
                <br />
                <p>
                  Sou aluno de graduação em Engenharia Civil-Aeronáutica no Instituto Tecnológico de
                  Aeronáutica (ITA), em São José dos Campos/SP, e estou cursando a disciplina de
                  Hidrologia e Drenagem (HID-41).
                </p>
                <br />
                <p>
                  Como parte das atividades da disciplina, estou desenvolvendo um projeto de estudo
                  hidrológico da bacia hidrográfica do Paraíba do Sul (cabeceira), que envolve a análise
                  de séries históricas de precipitação de estações pluviométricas localizadas na bacia.
                  O trabalho contempla a organização das séries de precipitação total diária, mensal e
                  anual, a constituição da série de precipitação máxima diária anual, o preenchimento de
                  falhas por meio de regressão múltipla e ponderação pelo inverso da distância (IDW),
                  além da análise estatística e geração de histogramas de frequência.
                </p>
                <br />
                <p>
                  Para automatizar a aquisição e o processamento dos dados das estações pluviométricas
                  selecionadas, gostaria de solicitar acesso à API do HidroWeb. O uso da API permitirá
                  maior reprodutibilidade e rastreabilidade no processo de coleta dos dados, além de
                  viabilizar a integração direta com as rotinas de análise desenvolvidas em Python.
                </p>
                <br />
                <p>Seguem as informações solicitadas para o cadastro:</p>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li><strong>Nome:</strong> Henri Leonardo dos Santos Lima</li>
                  <li><strong>CPF:</strong> XXX.XXX.XXX-XX (Dado Censurado por Segurança)</li>
                  <li><strong>E-mail:</strong> henri.lima.8917@ga.ita.br</li>
                </ul>
                <br />
                <p>
                  Agradeço desde já a atenção e fico à disposição para fornecer quaisquer informações
                  adicionais que se façam necessárias.
                </p>
                <br />
                <p>
                  Atenciosamente,<br />
                  <strong>Henri Leonardo dos Santos Lima</strong><br />
                  Aluno de Engenharia Civil-Aeronáutica — ITA
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <label className="font-medium text-slate-600">Anos bons ≥</label>
          <input
            type="number" min={0} max={100} value={minAnos}
            onChange={(e) => setMinAnos(Number(e.target.value))}
            className="w-16 rounded border px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="font-medium text-slate-600">Falhas ≤</label>
          <input
            type="number" min={0} max={100} value={maxFalhas}
            onChange={(e) => setMaxFalhas(Number(e.target.value))}
            className="w-16 rounded border px-2 py-1 text-sm"
          />
          <span className="text-slate-400">%</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="font-medium text-slate-600">Código</label>
          <input
            type="text" placeholder="ex: 2245048" value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-32 rounded border px-2 py-1 text-sm"
          />
        </div>
        <div className="ml-auto text-sm text-slate-400">
          {filtradas.length} de {candidatas.length} estações · {selecionadas.length} selecionadas
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Tabela de candidatas */}
        <div className="lg:col-span-3">
          <div className="overflow-auto rounded-xl border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs font-semibold text-slate-500">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-center">Período</th>
                  <th className="px-3 py-2 text-center">Anos bons</th>
                  <th className="px-3 py-2 text-center">Falhas</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const sel = !!selecao[c.codigo];
                  return (
                    <tr
                      key={c.codigo}
                      onClick={() => toggleEstacao(c)}
                      className={`cursor-pointer border-b transition-colors hover:bg-blue-50 ${sel ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox" readOnly checked={sel}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-700">{c.codigo}</td>
                      <td className="px-3 py-2 text-center text-slate-500">
                        {c.inicio}–{c.fim}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <AnosBadge anos={c.anos_bons} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <QualidadeBadge pct={c.pct_falhas} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel de configuração das selecionadas */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Configurar selecionadas ({selecionadas.length})
            </h2>

            {selecionadas.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-400">
                Clique em uma linha da tabela para selecionar uma estação.
              </div>
            )}

            {selecionadas
              .sort((a, b) => a.codigo.localeCompare(b.codigo))
              .map((est) => {
                const candidata = candidatas.find((c) => c.codigo === est.codigo);
                return (
                  <div key={est.codigo} className={`rounded-xl border p-4 shadow-sm ${est.is_referencia ? "border-blue-300 bg-blue-50" : "bg-white"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-700">{est.codigo}</span>
                        {candidata && (
                          <span className="ml-2 text-xs text-slate-400">
                            {candidata.anos_bons} anos · {candidata.pct_falhas.toFixed(1)}% falhas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setReferencia(est.codigo)}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                            est.is_referencia
                              ? "bg-blue-600 text-white"
                              : "border text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          Referência
                        </button>
                        <button
                          onClick={() => toggleEstacao({ codigo: est.codigo } as EstacaoCandidata)}
                          className="text-slate-300 hover:text-red-400"
                          title="Remover"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500">Nome da estação</label>
                        <input
                          type="text" placeholder="Nome da estação"
                          value={est.nome}
                          onChange={(e) => updateField(est.codigo, "nome", e.target.value)}
                          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Latitude</label>
                        <input
                          type="number" step="0.0001" placeholder="-22.5890"
                          value={est.lat ?? ""}
                          onChange={(e) => updateField(est.codigo, "lat", e.target.value ? Number(e.target.value) : null)}
                          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Longitude</label>
                        <input
                          type="number" step="0.0001" placeholder="-45.2340"
                          value={est.lon ?? ""}
                          onChange={(e) => updateField(est.codigo, "lon", e.target.value ? Number(e.target.value) : null)}
                          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Altitude (m)</label>
                        <input
                          type="number" placeholder="580"
                          value={est.altitude ?? ""}
                          onChange={(e) => updateField(est.codigo, "altitude", e.target.value ? Number(e.target.value) : null)}
                          className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

            {selecionadas.length > 0 && (
              <>
                {!temReferencia && (
                  <p className="text-xs text-amber-600">
                    Defina uma estação de referência antes de salvar.
                  </p>
                )}
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  <p className="font-medium text-slate-600">
                    {prontas.length}/{selecionadas.length} estações prontas para processar
                  </p>
                  <p className="mt-1">
                    Coordenadas disponíveis na ficha da estação no portal da ANA.
                  </p>
                </div>
                <button
                  onClick={handleSalvar}
                  disabled={saving || !temReferencia}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : `Salvar seleção (${selecionadas.length} estações)`}
                </button>
                {prontas.length === selecionadas.length && temReferencia && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
                    <p className="font-semibold text-emerald-700">Após salvar, execute no terminal:</p>
                    <pre className="mt-1 font-mono text-emerald-600">cd pipeline{"\n"}python pipeline.py</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
