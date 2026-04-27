"use client";

import { useEstacoes } from "@/hooks/useEstacoes";
import { usePreenchimento } from "@/hooks/usePreenchimento";
import { ComparacaoMetodos } from "@/components/charts/ComparacaoMetodos";
import { Info } from "lucide-react";

export default function PreenchimentoPage() {
  const { data: estacoes, loading: ldE } = useEstacoes();
  const ref = estacoes.find((e) => e.is_referencia);

  const { data: resultados, vencedor, loading: ldP } = usePreenchimento(ref?.codigo ?? "");

  const loading = ldE || ldP;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Preenchimento de Falhas</h1>
        <p className="mt-1 text-slate-500">
          Comparação entre regressão linear múltipla e IDW na estação de referência.
        </p>
      </div>

      {/* Estação de referência */}
      {ref && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm">
          <p className="font-semibold text-blue-800">Estação de referência</p>
          <p className="mt-0.5 text-blue-700">
            {ref.nome} <span className="font-mono text-blue-500">({ref.codigo})</span>
          </p>
          <p className="mt-1 text-blue-600">
            Falhas originais: <strong>{ref.pct_falhas_original?.toFixed(1)}%</strong>
            {" → "}
            após preenchimento: <strong>{ref.pct_falhas_pos_preenchimento?.toFixed(1)}%</strong>
          </p>
        </div>
      )}

      {/* Metodologia */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
          <Info size={16} className="text-blue-500" /> Metodologia
        </h2>
        <div className="mt-3 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-700">Regressão Linear Múltipla</p>
            <p className="mt-1">
              Equação linear ajustada pelo período comum das 3 estações.
              Treinada em 90% dos dados comuns (seed fixo), validada em 10% (holdout).
              Aplica a equação para dias onde a referência tem falha e as auxiliares têm dado.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">IDW (Inverse Distance Weighting)</p>
            <p className="mt-1">
              Interpolação ponderada pelo inverso da distância haversine ao quadrado.
              Aceita preenchimento parcial (ao menos uma auxiliar com dado no dia).
              Validado no mesmo holdout da regressão para comparação justa.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-mono text-slate-700">P_ref(t) = Σ [P_i(t) / d_i²] / Σ [1 / d_i²]</p>
          <p className="mt-1 text-xs text-slate-400">
            Onde d_i é a distância haversine (km) entre a referência e a estação auxiliar i.
            Apenas estações com dado no dia t entram na soma.
          </p>
        </div>
      </div>

      {/* Comparação */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-700">Comparação dos métodos</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <ComparacaoMetodos resultados={resultados} />
        )}
      </div>

      {/* Interpretação */}
      {vencedor && !loading && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-700">
          <p className="font-semibold text-emerald-800">Método aplicado à série final</p>
          <p className="mt-2">
            O método de{" "}
            <strong>
              {vencedor.metodo === "regressao" ? "regressão linear múltipla" : "IDW"}
            </strong>{" "}
            foi selecionado como vencedor por apresentar menor RMSE no conjunto de validação
            holdout ({vencedor.rmse_holdout.toFixed(4)} mm). Os {vencedor.n_dias_preenchidos} dias
            preenchidos por este método estão destacados em laranja nas séries temporais diárias.
          </p>
          {vencedor.metodo === "regressao" && vencedor.r2 != null && (
            <p className="mt-2">
              R² no conjunto de treino: <strong>{vencedor.r2.toFixed(4)}</strong> —
              indica boa capacidade explicativa da equação linear.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
