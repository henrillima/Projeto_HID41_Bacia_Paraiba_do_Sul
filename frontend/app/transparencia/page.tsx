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

interface DefBoxProps {
  termo: string;
  sigla?: string;
  formula?: string;
  cor?: "blue" | "violet" | "emerald" | "amber" | "slate";
  children: React.ReactNode;
}

const COR_MAP = {
  blue:    { card: "border-blue-200 bg-blue-50",     titulo: "text-blue-800",   sigla: "bg-blue-200 text-blue-700"   },
  violet:  { card: "border-violet-200 bg-violet-50", titulo: "text-violet-800", sigla: "bg-violet-200 text-violet-700" },
  emerald: { card: "border-emerald-200 bg-emerald-50",titulo: "text-emerald-800",sigla: "bg-emerald-200 text-emerald-700"},
  amber:   { card: "border-amber-200 bg-amber-50",   titulo: "text-amber-800",  sigla: "bg-amber-200 text-amber-700"  },
  slate:   { card: "border-slate-200 bg-slate-50",   titulo: "text-slate-800",  sigla: "bg-slate-200 text-slate-600"  },
};

function DefBox({ termo, sigla, formula, cor = "slate", children }: DefBoxProps) {
  const c = COR_MAP[cor];
  return (
    <div className={`rounded-xl border p-4 ${c.card}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`font-bold text-sm ${c.titulo}`}>{termo}</p>
        {sigla && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${c.sigla}`}>
            {sigla}
          </span>
        )}
      </div>
      {formula && (
        <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 font-mono text-xs text-slate-700">
          {formula}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{children}</p>
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
        <h1 className="text-2xl font-bold text-slate-800">Metodologia</h1>
        <p className="mt-1 text-slate-500">
          Documentação de cada etapa do processamento — da coleta dos dados brutos
          até as séries finais — com glossário dos principais termos técnicos.
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

      {/* 5. Comparação dos métodos */}
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

      {/* 6. Fluviometria & Curva-Chave (Projeto 2 / Fase 1) */}
      <Secao numero="6" titulo="Fluviometria & curva-chave">
        <p className="text-sm text-slate-600">
          Para a análise quantitativa do regime de vazões e dos eventos extremos
          (Projeto 2), incorporamos os dados da estação fluviométrica do exutório da bacia.
          A ingestão é feita pela nova{" "}
          <strong>API REST HidroWebService</strong> da ANA — token Bearer, TTL 60 min,
          documentação completa em <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">docs/ANA_REST_API.md</code>.
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-700">Endpoints usados</p>
            <ul className="mt-1 list-disc pl-4 text-blue-800/90">
              <li>/HidroInventarioEstacoes (descoberta)</li>
              <li>/HidroSerieVazao (m³/s)</li>
              <li>/HidroSerieCotas (cm)</li>
              <li>/HidroSerieResumoDescarga (medições)</li>
              <li>/HidroSerieCurvaDescarga (ANA oficial)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">Curva-chave (potência)</p>
            <p className="mt-1 font-mono text-xs text-emerald-900">Q = a·(h − h₀)<sup>b</sup></p>
            <p className="mt-1 text-emerald-800/90">
              Ajuste por LS não-linear (<code>scipy.optimize.curve_fit</code>) com h₀ estimado por
              grid-search; resíduos validados por Kolmogorov-Smirnov.
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">Seleção do exutório</p>
            <p className="mt-1 text-amber-900/90">
              Ranking por score composto{" "}
              <span className="font-mono text-xs">
                0.5·anos + 0.3·(1−falhas) + 0.2·proximidade
              </span>
              ; top-5 apresentadas em <a href="/selecao-fluvio" className="underline">/selecao-fluvio</a>.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          A migração para a API REST também passa a alimentar as séries pluviométricas
          (<code className="rounded bg-slate-100 px-1 py-0.5">python pipeline.py --via rest</code>),
          eliminando a necessidade de ZIPs baixados manualmente.
        </p>
      </Secao>

      {/* 7. Regime de vazões — Fase 2 */}
      <Secao numero="7" titulo="Regime de vazões — permanência, Eckhardt e Q7,10">
        <p className="text-sm text-slate-600">
          Caracterização do regime fluvial da bacia segundo as três análises padrão
          de hidrologia quantitativa (referência: HID41_Projeto2_Metodologia, etapas 1,
          2 e 6; Collischonn & Dornelles cap. 15).
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-700">Curva de permanência</p>
            <p className="mt-1 font-mono text-xs text-blue-900">P(%) = m/(n+1) · 100</p>
            <p className="mt-1 text-blue-800/90">
              Ordenação decrescente + plotagem de Weibull, com Q5 a Q99 interpolados.
              Q90 é a vazão de outorga; Q50 a mediana; Q10 vazões altas frequentes.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Filtro de Eckhardt (2005)
            </p>
            <p className="mt-1 font-mono text-xs text-emerald-900">
              b<sub>i</sub> = ((1−BFI<sub>max</sub>)·α·b<sub>i−1</sub> +
              (1−α)·BFI<sub>max</sub>·y<sub>i</sub>) / (1−α·BFI<sub>max</sub>)
            </p>
            <p className="mt-1 text-emerald-800/90">
              BFI<sub>max</sub> = 0.80 (aquífero poroso, padrão para PdS cabeceira); α
              estimado por regressão log-linear na mediana das recessões.
            </p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-semibold uppercase text-violet-700">
              Q7,10 — vazão mínima ecológica
            </p>
            <p className="mt-1 text-violet-900/90">
              Média móvel de 7 dias → mínimo anual (out → set) → Log-Pearson III por
              método dos momentos em log(Q). Q7,10 = quantil de não-excedência 10%
              (TR = 10 anos para mínimos).
            </p>
          </div>
        </div>
      </Secao>

      {/* 8. Eventos e Hidrogramas Unitários — Fase 3 */}
      <Secao numero="8" titulo="Eventos chuva-vazão e hidrogramas unitários">
        <p className="text-sm text-slate-600">
          Identificação de eventos isolados e construção dos hidrogramas
          unitários observado e SCS (referência: HID41_Projeto2_Metodologia,
          etapas 3, 4 e 5; Collischonn & Dornelles cap. 18).
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-700">Isolamento</p>
            <p className="mt-1 text-blue-800/90">
              <code>scipy.signal.find_peaks</code> com proeminência mínima
              relativa a Q95 e distância entre picos ≥ 5 dias; recuo até o
              último mínimo local; término por base-time SCS{" "}
              <span className="font-mono">D = 0,827·A<sup>0,2</sup></span> dias.
              Base separada por reta linear entre extremos.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">HU observado</p>
            <p className="mt-1 font-mono text-xs text-emerald-900">
              u<sub>i</sub> = Q<sub>direto,i</sub> / h<sub>mm</sub>
            </p>
            <p className="mt-1 text-emerald-800/90">
              Lâmina <span className="font-mono">h = V / A</span> em mm sobre a
              bacia (V em m³, A em km²; 1 mm·km² = 1.000 m³). HU médio = média
              das ordenadas alinhadas pelo pico.
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">HU SCS triangular</p>
            <p className="mt-1 font-mono text-xs text-amber-900">
              tp = 0,6·tc · Tp = tp + d/2 · Qp = 0,208·A/Tp · tb = 2,67·Tp
            </p>
            <p className="mt-1 text-amber-800/90">
              tc por Kirpich (bacias pequenas) ou Watt&Chow (até ≈ 5.840 km²).
              Comparação obs × SCS via Nash-Sutcliffe, erro relativo no pico e
              erro no tempo de pico.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Parâmetros físicos da bacia (A, L, Δh, CN) ficam em{" "}
          <code className="rounded bg-slate-100 px-1">config.yaml → bacia</code>.
          Fase 3 é pulada se A_km² estiver vazio.
        </p>
      </Secao>

      {/* 9. Eventos extremos — Fase 4 */}
      <Secao numero="9" titulo="Eventos extremos — frequência, IDF e chuva de projeto">
        <p className="text-sm text-slate-600">
          Análise de frequência das vazões máximas anuais, curvas IDF regionais
          e chuva de projeto pelo método dos blocos alternados (referência:
          HID41_Projeto2_Metodologia, etapas 8, 9 e 10).
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-semibold uppercase text-violet-700">
              Frequência de cheias
            </p>
            <p className="mt-1 text-violet-900/90">
              Ajuste de 5 distribuições candidatas (Gumbel, GEV, LogNormal,
              Pearson III, Log-Pearson III); seleção por <strong>AIC</strong>
              com KS p-value como filtro de aderência. Quantis Q(TR) com IC 90%
              via bootstrap paramétrico (1.000 reamostras).
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">IDF regional</p>
            <p className="mt-1 font-mono text-xs text-amber-900">
              i = a · TR^b / (t<sub>d</sub> + c)^d
            </p>
            <p className="mt-1 text-amber-800/90">
              Equação pré-publicada (Pfafstetter / DNOS para SJC adotado como
              default; configurável em <code>config.yaml → idf.parametros</code>).
              Plotada para TR ∈ &#123;2, 5, 10, 25, 50, 100, 500, 1000&#125;.
            </p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold uppercase text-red-700">
              Chuva de projeto (blocos alternados)
            </p>
            <p className="mt-1 text-red-900/90">
              Para TR = 10 e TR = 100 anos: discretização Δt; intensidade pela
              IDF em cada t<sub>k</sub>; ΔP<sub>k</sub> = P<sub>k</sub> −
              P<sub>k−1</sub>; reorganização com maior bloco no centro (padrão
              intermediário). Padrões adiantado e atrasado disponíveis para
              sensibilidade.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Acoplamento opcional Fase 3 ↔ Fase 4: convoluir a chuva de projeto
          com o HU SCS gera o <em>hidrograma de projeto</em>, que pode ser
          comparado com Q(TR) da análise de frequência para validar coerência
          entre os dois caminhos.
        </p>
      </Secao>

      {/* 10. Nota sobre estações sem dados */}
      {!ldSD && semDados.length > 0 && (
        <Secao numero="10" titulo="Estações sem dados disponíveis">
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

      {/* Glossário */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00205B] text-xs font-bold text-white">
            G
          </span>
          Glossário de termos técnicos
        </h2>
        <p className="mb-5 text-xs text-slate-400">
          Definições dos conceitos utilizados ao longo do pipeline e do dashboard.
        </p>

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Métricas estatísticas</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DefBox
              termo="Erro Quadrático Médio"
              sigla="RMSE"
              formula="RMSE = √[ (1/N) · Σ (P̂ᵢ − Pᵢ)² ]"
              cor="blue"
            >
              Mede o desvio médio entre os valores estimados (P̂) e os observados (P), em mm.
              É a principal métrica de comparação entre os métodos de preenchimento —
              quanto menor o RMSE, mais próximas são as estimativas dos valores reais.
              Penaliza erros grandes de forma desproporcional (elevados ao quadrado).
            </DefBox>

            <DefBox
              termo="Coeficiente de Determinação"
              sigla="R²"
              formula="R² = 1 − SS_res / SS_tot"
              cor="blue"
            >
              Indica a fração da variância da variável resposta explicada pelo modelo de
              regressão. Varia de 0 a 1: R² = 1 significa ajuste perfeito; R² = 0 significa
              que o modelo não explica nada além da média.{" "}
              <strong>Não se aplica ao IDW</strong>, pois este não é um modelo paramétrico —
              não ajusta coeficientes e não "explica" variância.
            </DefBox>

            <DefBox
              termo="Coeficiente de Variação"
              sigla="CV"
              formula="CV = σ / μ"
              cor="blue"
            >
              Razão entre o desvio padrão (σ) e a média (μ), adimensional.
              Mede a dispersão relativa da série. Um CV alto indica alta variabilidade
              em relação à média — esperado em séries de precipitação diária, onde
              há grande contraste entre dias secos e eventos intensos.
            </DefBox>

            <DefBox
              termo="Assimetria"
              sigla="g₁"
              formula="g₁ = [n/((n−1)(n−2))] · Σ[(xᵢ−μ)/σ]³"
              cor="violet"
            >
              Mede o grau de simetria da distribuição. g₁ {'>'} 0 indica cauda longa
              para a direita (valores extremos altos) — típico de precipitação diária,
              onde a maioria dos dias tem pouca ou nenhuma chuva e poucos dias concentram
              volumes elevados.
            </DefBox>

            <DefBox
              termo="Curtose em excesso"
              sigla="g₂"
              formula="g₂ = curtose − 3"
              cor="violet"
            >
              Mede o "peso das caudas" da distribuição em relação à normal (g₂ = 0).
              g₂ {'>'} 0 (leptocúrtica): caudas pesadas, pico agudo — eventos extremos mais
              frequentes do que a normal prevê. g₂ {'<'} 0 (platicúrtica): caudas leves.
              Séries de precipitação geralmente apresentam g₂ positivo.
            </DefBox>

            <DefBox
              termo="Percentis (P25, P75, P90…)"
              cor="violet"
            >
              O percentil Pₓ é o valor abaixo do qual estão x% das observações.
              P25 e P75 delimitam o intervalo interquartil (50% central dos dados).
              P90 e P95 caracterizam eventos mais raros; P99 equivale ao limiar do 1%
              mais extremo — útil para identificar eventos de precipitação intensa.
            </DefBox>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Métodos de preenchimento</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DefBox
              termo="Holdout (validação)"
              cor="emerald"
            >
              Subconjunto dos dados reservado exclusivamente para testar o modelo —
              nunca usado durante o treinamento. Aqui corresponde a 10% do{" "}
              <em>período comum</em>, sorteados aleatoriamente com semente 42
              (reproduzível). Usar o mesmo holdout para ambos os métodos garante que
              a comparação pelo RMSE seja justa.
            </DefBox>

            <DefBox
              termo="Período comum"
              cor="emerald"
            >
              Conjunto de dias em que <strong>todas</strong> as estações (referência +
              auxiliares) possuem dado registrado simultaneamente. É a base de dados
              usada para treinar a regressão e calibrar o IDW. Quanto mais longo o
              período comum, mais representativo e confiável é o treinamento.
            </DefBox>

            <DefBox
              termo="OLS — Mínimos Quadrados Ordinários"
              sigla="OLS"
              formula="β̂ = (XᵀX)⁻¹ Xᵀ y"
              cor="emerald"
            >
              Método de ajuste da regressão linear que minimiza a soma dos quadrados
              dos resíduos. Produz os coeficientes β que tornam as estimativas
              P̂_ref mais próximas possíveis de P_ref no conjunto de treino.
              É o estimador não-viesado de mínima variância (teorema de Gauss-Markov).
            </DefBox>

            <DefBox
              termo="IDW — Ponderação pelo Inverso da Distância"
              sigla="IDW"
              formula="P_ref(t) = Σ[Pᵢ/dᵢᵖ] / Σ[1/dᵢᵖ]"
              cor="emerald"
            >
              Método de interpolação espacial que estima um valor em um ponto
              ponderando as observações vizinhas pelo inverso de sua distância
              elevada ao expoente p (aqui p = 2). Estações mais próximas recebem
              peso proporcionalmente maior. Não exige período comum completo:
              funciona com qualquer auxiliar disponível no dia.
            </DefBox>

            <DefBox
              termo="Expoente IDW (p = 2)"
              cor="emerald"
            >
              Controla a velocidade de decaimento do peso com a distância.
              Com p = 2, dobrar a distância reduz o peso a ¼. Valores maiores
              concentram a influência nas estações mais próximas; valores menores
              tornam os pesos mais uniformes independentemente da distância.
              p = 2 é o valor clássico na literatura para interpolação de precipitação.
            </DefBox>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Conceitos geográficos e de dados</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DefBox
              termo="Distância haversine"
              formula="d = 2R · arcsin(√[sin²(Δlat/2) + cos(lat₁)·cos(lat₂)·sin²(Δlon/2)])"
              cor="amber"
            >
              Distância geodésica entre dois pontos na superfície da Terra calculada
              a partir de suas coordenadas (lat/lon). Considera a curvatura terrestre,
              ao contrário da distância euclidiana plana. Para as distâncias do projeto
              (~40–45 km), a diferença em relação à distância plana é inferior a 0,1%.
              R = 6.371 km (raio médio da Terra).
            </DefBox>

            <DefBox
              termo="Nível de consistência"
              cor="amber"
            >
              Grau de revisão dos dados pela ANA.{" "}
              <strong>Nível 1 (bruto):</strong> dados coletados diretamente do
              pluviômetro, sem revisão — podem conter erros de transcrição.{" "}
              <strong>Nível 2 (consistido):</strong> dados revisados, com correção de
              erros grosseiros e marcação explícita de ausências. Quando ambos estão
              disponíveis para o mesmo mês, o nível 2 tem prioridade.
            </DefBox>

            <DefBox
              termo="NaN / Falha"
              sigla="NaN"
              cor="amber"
            >
              <em>Not a Number</em> — representação computacional de um valor ausente
              ou inválido. Na série diária, um dia com NaN indica que não há registro
              de precipitação para aquela data (pluviômetro inoperante, dado descartado
              na consistência ou estação ainda não instalada). Falhas afetam a validade
              mensal e anual conforme o limiar de 5%.
            </DefBox>

            <DefBox
              termo="LTTB — Downsampling"
              sigla="LTTB"
              cor="slate"
            >
              <em>Largest Triangle Three Buckets</em> — algoritmo que reduz uma série
              de N pontos a M pontos preservando o formato visual. Para cada segmento,
              seleciona o ponto que maximiza a área do triângulo com os pontos adjacentes
              já escolhidos. Usado nos gráficos da série diária (~34.000 pontos por
              estação) para manter a performance do navegador sem distorcer a aparência
              da série.
            </DefBox>

            <DefBox
              termo="Upsert"
              cor="slate"
            >
              Operação de banco de dados que combina INSERT e UPDATE:{" "}
              insere o registro se não existir; atualiza se já existir (baseado
              em uma chave única). Todas as cargas do pipeline usam upsert,
              tornando a re-execução idempotente — rodar o pipeline duas vezes
              produz o mesmo resultado sem duplicar dados.
            </DefBox>

            <DefBox
              termo="Série idempotente"
              cor="slate"
            >
              Propriedade de uma operação que pode ser aplicada múltiplas vezes
              sem alterar o resultado além da primeira aplicação. O pipeline limpa
              os dados anteriores antes de cada carga (DELETE CASCADE seguido de
              upsert), garantindo que re-execuções corrijam dados sem acumular
              registros duplicados ou inconsistentes.
            </DefBox>
          </div>
        </div>

        {/* Termos fluviométricos — Projeto 2 / Fase 1 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            Fluviometria e curva-chave
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DefBox termo="Cota" sigla="h" cor="emerald">
              Altura da lâmina d'água em uma seção de rio em relação a um zero
              local da estação fluviométrica (régua linimétrica). Reportada em
              centímetros pela ANA. A cota é medida diretamente; a vazão é
              derivada da cota via curva-chave.
            </DefBox>

            <DefBox termo="Vazão" sigla="Q" cor="emerald">
              Volume de água que atravessa uma seção do rio por unidade de tempo,
              em m³/s. Obtida por medições diretas (molinete, ADCP) ou
              indiretamente pela curva-chave aplicada à cota.
            </DefBox>

            <DefBox
              termo="Curva-chave"
              sigla="Q(h)"
              formula="Q = a · (h − h₀)^b"
              cor="emerald"
            >
              Relação biunívoca entre cota e vazão em uma seção. Ajustada por
              regressão não-linear sobre pares (h, Q) medidos em campo. Forma de
              potência captura a hidráulica de canais aluviais até a cota de
              transbordamento; acima disso pode-se precisar segmentar a curva.
            </DefBox>

            <DefBox termo="Cota zero da escala" sigla="h₀" cor="emerald">
              Altura da lâmina d'água a partir da qual a vazão na seção é
              detectável (Q ≥ 0). É um parâmetro físico do ajuste — pode ser
              negativa se o zero da régua estiver acima do leito. Aqui é
              estimada por grid-search minimizando o SSR do ajuste log-linear.
            </DefBox>

            <DefBox termo="Estação exutória" cor="emerald">
              Estação fluviométrica posicionada no ponto mais a jusante da bacia
              de estudo — onde toda a água superficial da bacia converge antes
              de sair. Define a área de drenagem efetiva da análise. Neste
              estudo, o exutório é a estação{" "}
              <span className="font-mono">58142200 (BUQUIRINHA II)</span>, no
              Rio Buquira (afluente do Paraíba do Sul), área ≈ 410 km².
            </DefBox>

            <DefBox termo="Medições de descarga líquida" cor="emerald">
              Medições pontuais de vazão em campo (molinete, ADCP), com data,
              cota correspondente, área molhada, velocidade média, largura e
              profundidade da seção. São a matéria-prima para ajustar a curva-chave.
              Vêm do endpoint <code>/HidroSerieResumoDescarga/v1</code>.
            </DefBox>

            <DefBox termo="Bearer token (OAuth)" cor="amber">
              Mecanismo de autenticação da nova API REST da ANA: um login
              (CPF + senha) retorna um <em>tokenautenticacao</em> com validade
              de 60 minutos, que deve acompanhar cada chamada subsequente no
              header <code>Authorization: Bearer …</code>. O cliente Python
              cacheia o token em <code>pipeline/.cache/</code> e renova
              automaticamente em 401.
            </DefBox>

            <DefBox
              termo="Kolmogorov-Smirnov"
              sigla="KS"
              formula="D = sup |F̂(x) − F₀(x)|"
              cor="blue"
            >
              Teste não-paramétrico que compara a distribuição empírica dos
              resíduos (normalizados) com uma distribuição teórica de referência.
              Reportamos o <em>p-value</em> do KS para validar a normalidade dos
              resíduos da curva-chave — se p {'<'} 0,05, a forma simples por
              potência pode ser inadequada e devemos considerar segmentação.
            </DefBox>

            <DefBox
              termo="Sub-bacia / Macrorregião hidrográfica"
              cor="amber"
            >
              A ANA divide o território em 9 macrorregiões hidrográficas
              (códigos 1–9). A bacia do Paraíba do Sul pertence à macrorregião{" "}
              <strong>5 (Atlântico, Trecho Leste)</strong>; suas estações
              fluviométricas usam prefixo <span className="font-mono">58</span>{" "}
              no código de 8 dígitos. Os pluviômetros do projeto têm prefixos
              <span className="font-mono">22/23</span> (sub-bacias menores na
              mesma macro).
            </DefBox>
          </div>
        </div>
      </section>
    </div>
  );
}
