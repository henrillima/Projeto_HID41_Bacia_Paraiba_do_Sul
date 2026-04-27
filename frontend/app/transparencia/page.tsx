"use client";

import { useEstacoes } from "@/hooks/useEstacoes";
import { usePreenchimento } from "@/hooks/usePreenchimento";
import { useEstacoesSemDados } from "@/hooks/useEstacoesSemDados";
import { useEstacoesCandidatas } from "@/hooks/useEstacoesCandidatas";
import { ComparacaoMetodos } from "@/components/charts/ComparacaoMetodos";

function Secao({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00205B] text-xs font-bold text-white">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <div className="my-2 rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
      {children}
    </div>
  );
}

export default function TransparenciaPage() {
  const { data: estacoes, loading: ldE } = useEstacoes();
  const { data: semDados, loading: ldSD } = useEstacoesSemDados();
  const { data: candidatas } = useEstacoesCandidatas();

  const ref = estacoes.find((e) => e.is_referencia);
  const { data: resultados, vencedor, loading: ldP } = usePreenchimento(ref?.codigo ?? "");

  const loading = ldE || ldP;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Transparência Metodológica</h1>
        <p className="mt-1 text-slate-500">
          Documentação completa de cada etapa do processamento — da coleta dos dados brutos
          até as séries finais publicadas no dashboard.
        </p>
      </div>

      {/* 1. Coleta dos dados */}
      <Secao numero="1" titulo="Coleta dos dados brutos">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Fonte</p>
            <p className="mt-1 font-medium text-slate-700">ANA Hidroweb</p>
            <p className="text-xs text-slate-500">Séries históricas diárias de precipitação pluviométrica</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Inventário baixado</p>
            <p className="mt-1 font-medium text-slate-700">
              {ldSD ? "—" : candidatas.length + semDados.length} estações
            </p>
            <p className="text-xs text-slate-500">Estado de São Paulo · Tipo pluviométrica</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Com dados</p>
            <p className="mt-1 font-medium text-slate-700">{candidatas.length} estações</p>
            <p className="text-xs text-slate-500">
              {ldSD ? "—" : semDados.length} sem dados disponíveis na fonte
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Formato dos arquivos</p>
          <p className="mt-1">
            Cada estação é entregue em um arquivo ZIP contendo um CSV com encoding
            latin-1 e separador ponto-e-vírgula. Cada linha representa um mês, com
            as colunas <code className="rounded bg-slate-100 px-1">Chuva01</code>–
            <code className="rounded bg-slate-100 px-1">Chuva31</code> para os valores
            diários. Dias inexistentes (ex.: 30 e 31 de fevereiro) resultam em colunas
            automaticamente descartadas pelo parser.
          </p>
          <p className="mt-2">
            Quando um mesmo mês aparece com nível de consistência 1 (bruto) e 2 (consistido),
            mantém-se apenas o nível 2. Valores negativos são convertidos para ausência de dado.
          </p>
        </div>
      </Secao>

      {/* 2. Construção das séries */}
      <Secao numero="2" titulo="Construção das séries temporais">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-700">Série diária</p>
            <p className="mt-1 text-slate-600">
              Série bruta extraída diretamente dos CSVs. Um ponto por dia,
              valor em mm. Dias sem registro ficam como ausência (NaN).
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Série mensal</p>
            <p className="mt-1 text-slate-600">
              Soma dos valores diários por mês. Um mês é marcado como
              <strong> inválido</strong> se mais de 5% dos seus dias tiverem
              ausência de dado — e é excluído das análises estatísticas.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Série anual</p>
            <p className="mt-1 text-slate-600">
              Soma dos 12 meses válidos. Um ano é marcado como inválido se
              qualquer um dos 12 meses for inválido pelo critério acima.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Precipitação máxima diária anual:</strong> para cada ano, o maior valor
          observado na série diária (independente de falhas mensais). Inclui a data de
          ocorrência do evento.
        </div>
      </Secao>

      {/* 3. Preenchimento de falhas */}
      <Secao numero="3" titulo="Preenchimento de falhas">
        <p className="mb-4 text-sm text-slate-600">
          Aplica-se a <strong>todas</strong> as estações selecionadas. Para cada estação,
          as demais servem de auxiliares. Dois métodos são treinados e validados
          independentemente; o de menor RMSE no holdout é aplicado à série final.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="font-semibold text-slate-700">1 — Regressão Linear Múltipla</p>
            <p className="mt-2 text-sm text-slate-600">
              Equação linear ajustada pelo <strong>período comum</strong> (dias em que
              a estação e todas as auxiliares têm dado simultâneo). Treinada em 90% do
              período comum (semente = 42), validada em 10% (holdout).
            </p>
            <Formula>
              {"P_ref(t) = a₁·P₁(t) + a₂·P₂(t) + … + aₙ·Pₙ(t) + b"}
            </Formula>
            <p className="text-xs text-slate-400">
              Aplica-se apenas quando todas as auxiliares têm dado no dia t.
              Valores negativos são clampados a zero.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="font-semibold text-slate-700">2 — IDW (Inverse Distance Weighting)</p>
            <p className="mt-2 text-sm text-slate-600">
              Interpolação ponderada pelo inverso do quadrado da distância haversine.
              Aceita preenchimento parcial: usa qualquer auxiliar com dado disponível no dia.
            </p>
            <Formula>
              {"P_ref(t) = Σᵢ [Pᵢ(t)/dᵢ²] / Σᵢ [1/dᵢ²]"}
            </Formula>
            <p className="text-xs text-slate-400">
              Validado no <strong>mesmo</strong> holdout da regressão para comparação justa.
              d = distância haversine em km entre a estação e cada auxiliar.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Critério de seleção:</strong> o método com menor RMSE no holdout de
          validação (10% do período comum, amostragem aleatória com semente fixa = 42)
          é declarado vencedor e aplicado à série final publicada no dashboard.
          Os dias preenchidos são marcados em laranja nas séries temporais diárias.
        </div>
      </Secao>

      {/* 4. Resultados por estação */}
      <Secao numero="4" titulo="Resultados por estação">
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ) : estacoes.length === 0 ? (
          <p className="text-sm text-slate-400">
            Pipeline ainda não executado. Selecione as estações em{" "}
            <a href="/selecao" className="text-blue-500 underline">/selecao</a>{" "}
            e execute <code className="rounded bg-slate-100 px-1">python pipeline.py</code>.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold text-slate-500">
                  <th className="py-2 text-left">Código</th>
                  <th className="py-2 text-left">Nome</th>
                  <th className="py-2 text-center">Período</th>
                  <th className="py-2 text-center">Falhas orig.</th>
                  <th className="py-2 text-center">Falhas pós</th>
                  <th className="py-2 text-center">Referência</th>
                </tr>
              </thead>
              <tbody>
                {estacoes.map((e) => (
                  <tr key={e.codigo} className="border-b hover:bg-slate-50">
                    <td className="py-2 font-mono text-slate-700">{e.codigo}</td>
                    <td className="py-2 text-slate-600">{e.nome}</td>
                    <td className="py-2 text-center text-slate-500">
                      {e.data_inicio?.slice(0, 4)}–{e.data_fim?.slice(0, 4)}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                        (e.pct_falhas_original ?? 0) < 5 ? "bg-green-100 text-green-700" :
                        (e.pct_falhas_original ?? 0) < 15 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {(e.pct_falhas_original ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-mono text-emerald-700">
                        {(e.pct_falhas_pos_preenchimento ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      {e.is_referencia && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          REF
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {/* 5. Comparação dos métodos (estação de referência) */}
      <Secao numero="5" titulo="Comparação dos métodos — estação de referência">
        {!ref ? (
          <p className="text-sm text-slate-400">Aguardando execução do pipeline.</p>
        ) : (
          <>
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-semibold text-blue-800">Estação de referência: {ref.nome}</p>
              <p className="text-blue-700">
                Código <span className="font-mono">{ref.codigo}</span> ·{" "}
                {ref.data_inicio?.slice(0, 4)}–{ref.data_fim?.slice(0, 4)} ·
                Falhas originais: <strong>{ref.pct_falhas_original?.toFixed(1)}%</strong>{" → "}
                após preenchimento: <strong>{ref.pct_falhas_pos_preenchimento?.toFixed(1)}%</strong>
              </p>
            </div>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : (
              <ComparacaoMetodos resultados={resultados} />
            )}
            {vencedor && !loading && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-emerald-800">Método vencedor aplicado à série final</p>
                <p className="mt-1">
                  <strong>
                    {vencedor.metodo === "regressao" ? "Regressão linear múltipla" : "IDW"}
                  </strong>{" "}
                  foi selecionado com RMSE de <strong>{vencedor.rmse_holdout.toFixed(4)} mm</strong>{" "}
                  no holdout, frente a{" "}
                  {vencedor.metodo === "regressao"
                    ? resultados.find((r) => r.metodo === "idw")?.rmse_holdout.toFixed(4)
                    : resultados.find((r) => r.metodo === "regressao")?.rmse_holdout.toFixed(4)}{" "}
                  mm do método alternativo.
                  Os <strong>{vencedor.n_dias_preenchidos} dias preenchidos</strong> aparecem
                  em laranja na série temporal diária da estação de referência.
                </p>
                {vencedor.metodo === "regressao" && vencedor.r2 != null && (
                  <p className="mt-1">
                    R² no conjunto de treino: <strong>{vencedor.r2.toFixed(4)}</strong>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Secao>

      {/* 6. Nota sobre estações sem dados */}
      {!ldSD && semDados.length > 0 && (
        <Secao numero="6" titulo="Estações sem dados disponíveis">
          <p className="text-sm text-slate-600">
            Das {candidatas.length + semDados.length} estações no inventário baixado,{" "}
            <strong>{semDados.length}</strong> retornaram arquivos ZIP vazios — existem
            no cadastro da ANA mas não possuem série histórica disponível para download.
            Essas estações não foram descartadas por decisão do grupo; a ausência é da fonte original.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {semDados.map((e) => (
              <span
                key={e.codigo}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500"
              >
                {e.codigo}
              </span>
            ))}
          </div>
        </Secao>
      )}
    </div>
  );
}
