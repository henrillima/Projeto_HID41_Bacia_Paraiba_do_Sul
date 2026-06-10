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
            <p className="text-xs font-semibold uppercase text-slate-400">Fonte primária</p>
            <p className="mt-1 font-medium text-slate-700">ANA HidroWebService REST</p>
            <p className="text-xs text-slate-500">
              Bearer token JWT, TTL 60 min, rate limit 2 RPS, retry automático.
              Caminho legado (ZIPs do SNIRH) mantido como fallback.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Pluviômetros do Projeto 1</p>
            <p className="mt-1 font-medium text-slate-700">3 estações fixas</p>
            <p className="text-xs text-slate-500">
              Pindamonhangaba (2245048, referência), Estrada do Cunha (2245055)
              e São Luís do Paraitinga (2345065).
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-400">Inventário diagnóstico</p>
            <p className="mt-1 font-medium text-slate-700">
              {ldSD ? "—" : candidatas.length + semDados.length} estações de SP
            </p>
            <p className="text-xs text-slate-500">
              {ldSD ? "—" : semDados.length} sem dados na fonte (registradas para auditoria).
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Endpoints e consistência</p>
          <p className="mt-1">
            Séries são obtidas via <code className="rounded bg-slate-100 px-1">HidroSerieChuva/v1</code>,
            <code className="rounded bg-slate-100 px-1 ml-1">HidroSerieVazao/v1</code>,
            <code className="rounded bg-slate-100 px-1 ml-1">HidroSerieCotas/v1</code> e
            <code className="rounded bg-slate-100 px-1 ml-1">HidroSerieResumoDescarga/v1</code>.
            Cada dia retorna com <code className="rounded bg-slate-100 px-1">Nivel_Consistencia</code>
            ∈ {`{1 (bruto), 2 (consistido)}`}.
          </p>
          <p className="mt-2">
            Quando o mesmo dia aparece com ambos os níveis, mantém-se apenas o
            nível 2 (revisado pela ANA). Valores negativos são convertidos para
            ausência de dado (NaN).
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
          O exutório oficial do Projeto 2 é a estação fluviométrica
          {" "}<strong>58142200 — Buquirinha II</strong> (operadora SGB-CPRM),
          no Rio Buquira, afluente do Paraíba do Sul. A estação é fixada em
          {" "}<code className="rounded bg-slate-100 px-1 text-xs">pipeline/config.yaml → fluviometria.exutorio_codigo</code>
          {" "}e processada via API REST HidroWebService da ANA.
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-700">Janela analisada</p>
            <p className="mt-1 font-mono text-xs text-blue-900">1979-01-01 → 2023-03-31</p>
            <p className="mt-1 text-blue-800/90">
              44,2 anos efetivos, 0,33% de falhas em vazão. Trecho 1970–1978 foi
              truncado por conter platô artificial (cotas constantes) que
              produzia eventos com coef. de escoamento &gt; 1.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Curva-chave ajustada
            </p>
            <p className="mt-1 font-mono text-xs text-emerald-900">
              Q = 3,0235·(h − 0,05)<sup>2,036</sup>
            </p>
            <p className="mt-1 text-emerald-800/90">
              R² = 0,943; RMSE = 1,35 m³/s; ajustada sobre 354 medições ANA na
              faixa h ∈ [0,98; 3,48] m. Procedimento: grid-search de h₀ +
              refino não-linear via <code>scipy.optimize.curve_fit</code>.
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">
              Endpoints REST
            </p>
            <ul className="mt-1 list-disc pl-4 text-amber-900/90">
              <li>HidroSerieVazao (m³/s)</li>
              <li>HidroSerieCotas (cm)</li>
              <li>HidroSerieResumoDescarga (medições)</li>
              <li>HidroSerieCurvaDescarga (curva oficial ANA)</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          A curva ajustada preenche dias com cota observada mas vazão ausente
          (559 dias na janela analisada). Cotas fora de [h_min, h_max] não são
          extrapoladas. A inspeção das estações em uso está disponível em{" "}
          <a href="/selecao-fluvio" className="underline">/selecao-fluvio</a>.
        </p>
      </Secao>

      {/* 6.5 (novo) — Parâmetros físicos da bacia */}
      <Secao numero="6.5" titulo="Parâmetros físicos da bacia (CABra 318)">
        <p className="text-sm text-slate-600">
          Os parâmetros físicos da sub-bacia do Buquira até o exutório foram
          extraídos do <strong>dataset CABra</strong> (Catchment Attributes for
          Brazil, Almeida et al. 2021), catchment 318, complementados por
          medição própria do talvegue principal sobre a rede de drenagem do
          CABra recortada à bacia, executada no QGIS.
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Área de drenagem</p>
            <p className="mt-1 font-mono text-base text-slate-800">410,08 km²</p>
            <p className="mt-1 text-xs text-slate-500">CABra; ANA reporta 407 km²</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Talvegue principal L</p>
            <p className="mt-1 font-mono text-base text-slate-800">42,1 km</p>
            <p className="mt-1 text-xs text-slate-500">Medido sobre CABra_drainage no QGIS</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Desnível Δh</p>
            <p className="mt-1 font-mono text-base text-slate-800">1 163 m</p>
            <p className="mt-1 text-xs text-slate-500">elev_max (1726) − elev_gauge (563)</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Declividade do canal</p>
            <p className="mt-1 font-mono text-base text-slate-800">S = 2,76 %</p>
            <p className="mt-1 text-xs text-slate-500">S = Δh / L (≠ catch_slope do terreno)</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Tempo de concentração</p>
            <p className="mt-1 font-mono text-base text-slate-800">tc = 282,9 min</p>
            <p className="mt-1 text-xs text-slate-500">
              Kirpich (4,7 h). W&Chow daria 10,2 h — sensibilidade documentada
              no relatório.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Curve Number AMC-II</p>
            <p className="mt-1 font-mono text-base text-slate-800">CN = 60</p>
            <p className="mt-1 text-xs text-slate-500">
              NRCS TR-55 sobre uso/solo CABra (70% floresta, grupo B). Faixa
              defensável: 56–62.
            </p>
          </div>
        </div>
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
          unitários observado e SCS triangular. Referência: Collischonn &
          Dornelles (2013), cap. 18; HID41 — Projeto 2 etapas 3, 4 e 5.
        </p>

        {/* Bloco P2 — NOVO */}
        <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-violet-700">
            Pluviômetros do Projeto 2 (chuva sobre a bacia)
          </p>
          <p className="mt-1 text-violet-900/90">
            Os pluviômetros do Projeto 1 (Pindamonhangaba, Estrada do Cunha e
            SLP) estão a 51–90 km do exutório, no fundo do vale do Paraíba, e
            não representam a chuva real sobre a bacia serrana do Buquira.
            Para a Fase 3 foi criado um <strong>conjunto P2 independente</strong>{" "}
            de pluviômetros mais próximos:
          </p>
          <ul className="mt-2 list-disc pl-5 text-violet-900/90">
            <li><strong>2245054 — Monteiro Lobato</strong> (cabeceiras N, 22,6 km, CPRM)</li>
            <li><strong>2345071 — Santa Branca</strong> (jusante leste, 27,2 km, CPRM)</li>
            <li><strong>2345106 — UHE Santa Branca Barramento</strong> (jusante leste, 27,9 km, LIGHT)</li>
          </ul>
          <p className="mt-2 text-xs text-violet-800/80">
            Chuva da bacia = média aritmética simples das séries diárias dos
            três pluviômetros ativos (campos <code>config_pluviometros_p2</code>
            no banco). O Projeto 1 é isolado tecnicamente por uma coluna{" "}
            <code>projeto = 'P1'</code> em <code>estacoes</code>, com view{" "}
            <code>resumo_estacoes</code> filtrada — as páginas pluviométricas
            do BI permanecem intocadas.
          </p>
        </div>

        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-700">Isolamento de eventos</p>
            <p className="mt-1 text-blue-800/90">
              <code>scipy.signal.find_peaks</code> com proeminência mínima
              0,3·Q95 e distância entre picos ≥ 5 dias. Recuo até o último
              mínimo local; término por base-time SCS{" "}
              <span className="font-mono">D = 0,827·A<sup>0,2</sup></span> dias.
              Base separada por reta linear entre extremos.
            </p>
            <p className="mt-1 text-blue-800/90">
              <strong>Filtros adicionais:</strong> chuva acumulada ≥ 10 mm na
              janela <em>lookback</em> de max(⌈D⌉, 3) dias antes do pico;
              duração total em [D, D+2] dias. Resultado: <strong>457
              eventos válidos</strong> isolados.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">HU observado</p>
            <p className="mt-1 font-mono text-xs text-emerald-900">
              u<sub>i</sub> = Q<sub>direto,i</sub> / h
            </p>
            <p className="mt-1 text-emerald-800/90">
              Lâmina <span className="font-mono">h = V / A</span> em mm sobre
              a bacia (V em m³, A em km²; 1 mm·km² = 1 000 m³). HU médio =
              média ordenada-a-ordenada após alinhar individuais pelo pico.
              Desvio padrão por ordenada documenta a variabilidade entre
              eventos.
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">HU SCS triangular</p>
            <p className="mt-1 font-mono text-xs text-amber-900">
              tp = 0,6·tc · Tp = tp + d/2 · Qp = 0,208·A/Tp · tb = 2,67·Tp
            </p>
            <p className="mt-1 text-amber-800/90">
              <strong>Resultado:</strong> Tp = 3,62 h; Qp = 23,59 m³/s/mm;
              tb = 9,65 h (com tc Kirpich = 283 min). HU observado em malha
              diária (Δt = 1 d) e SCS em malha horária (Δt = 60 min) — a
              comparação direta não é estatisticamente válida; cada um é
              apresentado em painel próprio.
            </p>
          </div>
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Chuva efetiva</strong> via método do{" "}
          <span className="font-mono">φ-index</span>: bissecção de φ (mm/dia)
          tal que <span className="font-mono">Σ max(P<sub>i</sub> − φ, 0) = h</span>.
          Por construção, P<sub>efetiva</sub> ≡ h (lâmina escoada). Alternativa
          SCS-CN disponível para análises de sensibilidade do CN.
        </p>
      </Secao>

      {/* 9. Eventos extremos — Fase 4 */}
      <Secao numero="9" titulo="Eventos extremos — frequência, IDF e chuva de projeto">
        <p className="text-sm text-slate-600">
          Análise de frequência das vazões máximas anuais, curva IDF para São
          José dos Campos e chuva de projeto pelo método dos blocos
          alternados. Referência: Collischonn & Dornelles (2013); Naghettini &
          Pinto (2007).
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-semibold uppercase text-violet-700">
              Frequência de cheias
            </p>
            <p className="mt-1 text-violet-900/90">
              Sobre 44 anos da AMS (filtro de 330 dias por ano), ajustam-se 5
              distribuições candidatas: <strong>Gumbel, GEV, LogNormal,
              Pearson III e Log-Pearson III</strong>. Critério: menor AIC{" "}
              <em>entre as que passam no KS</em> (p ≥ 0,05). Todas passam;
              recomendada: <strong>GEV</strong> (AIC = 353,87; KS p = 0,88).
            </p>
            <p className="mt-1 text-violet-900/90">
              Q(TR) com IC 90% por <strong>bootstrap não-paramétrico</strong>
              (1 000 reamostras com reposição da AMS observada; re-ajuste da
              distribuição em cada amostra).
              <span className="text-violet-800/80">
                {" "}Q<sub>TR=100</sub> = 75,3 m³/s (IC: 64–94).
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase text-amber-700">IDF de São José dos Campos</p>
            <p className="mt-1 font-mono text-xs text-amber-900">
              i = 5710 · TR<sup>0,1263</sup> / (t<sub>d</sub> + 38,21)<sup>1,0766</sup>
            </p>
            <p className="mt-1 text-amber-800/90">
              Fonte: <strong>Ferreira & Waltz (2001)</strong>, XIV Simpósio
              Brasileiro de Recursos Hídricos. Validada contra a Tabela 6 do
              paper em 5 pontos (desvio &lt; 1%).
            </p>
            <p className="mt-1 text-xs text-amber-800/70">
              Faixa declarada: TR ≤ 20 anos, t ≤ 360 min. TR = 100 é
              extrapolação documentada.
            </p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-semibold uppercase text-red-700">
              Chuva de projeto (blocos alternados)
            </p>
            <p className="mt-1 text-red-900/90">
              Discretização Δt = 10 min; t<sub>d</sub> = 360 min (36 blocos).
              Incrementos ΔP<sub>k</sub> = P<sub>k</sub> − P<sub>k−1</sub>
              reorganizados em padrão <em>intermediário</em> (maior bloco no
              centro, alternando antes/depois).
            </p>
            <p className="mt-1 font-mono text-xs text-red-900">
              TR=10: P<sub>tot</sub> = 72,7 mm<br/>
              TR=100: P<sub>tot</sub> = 97,3 mm
            </p>
          </div>
        </div>

        {/* Ressalva orográfica — NOVO */}
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-amber-800">
            Limitação reconhecida — efeito orográfico
          </p>
          <p className="mt-1 text-amber-900/90">
            A IDF de SJC é calibrada para postos pluviográficos no vale do
            Paraíba do Sul, em altitude ~580 m. A bacia do Buquira é serrana:
            cabeceiras nas vertentes da Serra da Mantiqueira a ~1 700 m
            (Δz = 1 163 m em 42 km de talvegue). Pela <strong>influência
            orográfica</strong>, intensidades reais nas cabeceiras são
            tipicamente <strong>10–30% maiores</strong> que as previstas pela
            IDF do vale (Bertoni & Tucci, 2007). A chuva de projeto TR = 100
            deve ser interpretada como <strong>limite inferior</strong> das
            intensidades reais nas cabeceiras; pendências metodológicas
            (transposição altimétrica ou IDF local dos pluvios P2 via
            desagregação) ficam para evolução futura do trabalho.
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Acoplamento opcional Fase 3 ↔ Fase 4: convoluir a chuva de projeto
          com o HU SCS gera o <em>hidrograma de projeto</em>, comparável com
          Q(TR) da análise de frequência. O acoplamento exige desagregar a
          chuva diária projetada em sub-passos compatíveis com o HU horário.
        </p>
      </Secao>

      {/* 9.5 (novo) — Validação cruzada vs Parte 1 do projeto */}
      <Secao numero="9.5" titulo="Validação cruzada vs Parte 1 do projeto (Excel)">
        <p className="text-sm text-slate-600">
          A planilha entregue na Parte 1 do projeto contém a Curva de
          Permanência e o Filtro de Eckhardt da estação 58142200 na janela{" "}
          <strong>1980-10-01 a 2010-09-30</strong> (30 anos hidrológicos).
          Refizemos os mesmos cálculos no pipeline restringindo a mesma janela
          e usando os mesmos parâmetros (α = 0,98; BFI_max = 0,80).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Métrica</th>
                <th className="px-3 py-2 text-right">Excel (Parte 1)</th>
                <th className="px-3 py-2 text-right">Pipeline</th>
                <th className="px-3 py-2 text-right">Desvio</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b"><td className="px-3 py-1.5">Q5%</td><td className="px-3 py-1.5 text-right font-mono">21,32</td><td className="px-3 py-1.5 text-right font-mono">21,26</td><td className="px-3 py-1.5 text-right text-emerald-600">−0,26%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Q10%</td><td className="px-3 py-1.5 text-right font-mono">16,37</td><td className="px-3 py-1.5 text-right font-mono">16,17</td><td className="px-3 py-1.5 text-right text-emerald-600">−1,27%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Q50%</td><td className="px-3 py-1.5 text-right font-mono">7,65</td><td className="px-3 py-1.5 text-right font-mono">7,59</td><td className="px-3 py-1.5 text-right text-emerald-600">−0,68%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Q90%</td><td className="px-3 py-1.5 text-right font-mono">4,45</td><td className="px-3 py-1.5 text-right font-mono">4,48</td><td className="px-3 py-1.5 text-right text-emerald-600">+0,56%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Q95%</td><td className="px-3 py-1.5 text-right font-mono">3,96</td><td className="px-3 py-1.5 text-right font-mono">4,02</td><td className="px-3 py-1.5 text-right text-emerald-600">+1,67%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Média</td><td className="px-3 py-1.5 text-right font-mono">9,34</td><td className="px-3 py-1.5 text-right font-mono">9,29</td><td className="px-3 py-1.5 text-right text-emerald-600">−0,52%</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-semibold">BFI Eckhardt</td><td className="px-3 py-1.5 text-right font-mono">0,7548</td><td className="px-3 py-1.5 text-right font-mono">0,7425</td><td className="px-3 py-1.5 text-right text-emerald-600">−1,23 p.p.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Todos os quantis com desvio &lt; 2% e BFI dentro de 1,3 p.p.: a
          implementação do pipeline reproduz fielmente os resultados da Parte
          1. Diferenças residuais provêm da inicialização do filtro recursivo
          e da inclusão de dias preenchidos por curva-chave (não presentes no
          Excel). Diferenças nas demais análises na janela completa do
          pipeline (1979–2023) vêm da extensão temporal, não do método.
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

      {/* Resultados-chave — NOVO */}
      <Secao numero="11" titulo="Resultados-chave (sumário executivo)">
        <p className="text-sm text-slate-600">
          Síntese numérica dos principais parâmetros e resultados obtidos para
          a estação <strong>58142200 — Buquirinha II</strong>, janela
          1979-01-01 a 2023-03-31 (44,2 anos). Estes valores estão prontos
          para o relatório final.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b">
                <td className="px-3 py-1.5 text-slate-500" rowSpan={6}>Bacia (CABra 318)</td>
                <td className="px-3 py-1.5">Área de drenagem A</td>
                <td className="px-3 py-1.5 text-right font-mono">410,08 km²</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Comprimento do talvegue L</td>
                <td className="px-3 py-1.5 text-right font-mono">42,1 km</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Desnível Δh</td>
                <td className="px-3 py-1.5 text-right font-mono">1 163 m</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Declividade do canal S</td>
                <td className="px-3 py-1.5 text-right font-mono">2,76 %</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">tc (Kirpich)</td>
                <td className="px-3 py-1.5 text-right font-mono">282,9 min (4,7 h)</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Curve Number AMC-II</td>
                <td className="px-3 py-1.5 text-right font-mono">60</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 text-slate-500" rowSpan={3}>Curva-chave</td>
                <td className="px-3 py-1.5">Equação ajustada</td>
                <td className="px-3 py-1.5 text-right font-mono">Q = 3,0235·(h−0,05)<sup>2,036</sup></td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">R² / RMSE</td>
                <td className="px-3 py-1.5 text-right font-mono">0,943 / 1,35 m³/s</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Medições usadas</td>
                <td className="px-3 py-1.5 text-right font-mono">354 pontos</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 text-slate-500" rowSpan={4}>Regime de vazões</td>
                <td className="px-3 py-1.5">Q90 (vazão de outorga)</td>
                <td className="px-3 py-1.5 text-right font-mono">3,99 m³/s</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Q50 (mediana)</td>
                <td className="px-3 py-1.5 text-right font-mono">6,99 m³/s</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">BFI Eckhardt (global)</td>
                <td className="px-3 py-1.5 text-right font-mono">0,767</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Q7,10 (LP3)</td>
                <td className="px-3 py-1.5 text-right font-mono">2,68 m³/s</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 text-slate-500" rowSpan={2}>Eventos & HU</td>
                <td className="px-3 py-1.5">Eventos chuva-vazão isolados</td>
                <td className="px-3 py-1.5 text-right font-mono">457</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">HU SCS (Tp / Qp / tb)</td>
                <td className="px-3 py-1.5 text-right font-mono">3,62 h / 23,59 m³/s/mm / 9,65 h</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 text-slate-500" rowSpan={4}>Frequência & chuva de projeto</td>
                <td className="px-3 py-1.5">Distribuição recomendada</td>
                <td className="px-3 py-1.5 text-right font-mono">GEV (AIC = 353,87)</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">Q TR=10 (IC 90%)</td>
                <td className="px-3 py-1.5 text-right font-mono">57,8 m³/s [52,3 – 63,7]</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5"><strong>Q TR=100 (IC 90%)</strong></td>
                <td className="px-3 py-1.5 text-right font-mono"><strong>75,3 m³/s [64,0 – 93,7]</strong></td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5">P projeto TR=10 / TR=100 (td=360 min)</td>
                <td className="px-3 py-1.5 text-right font-mono">72,7 mm / 97,3 mm</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Secao>

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
