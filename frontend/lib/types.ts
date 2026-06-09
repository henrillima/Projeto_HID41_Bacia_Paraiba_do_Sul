export interface Estacao {
  codigo: string;
  nome: string;
  lat: number;
  lon: number;
  altitude: number | null;
  is_referencia: boolean;
  anos_dados: number;
  n_dias_total: number | null;
  n_dias_com_dado: number | null;
  pct_falhas_original: number;
  pct_falhas_pos_preenchimento: number;
  data_inicio: string;
  data_fim: string;
}

export interface PrecipitacaoDiaria {
  estacao_codigo: string;
  data: string;
  valor: number | null;
  preenchido: boolean;
  metodo: string | null;
  consistencia: number | null;
}

export interface PrecipitacaoMensal {
  estacao_codigo: string;
  ano: number;
  mes: number;
  valor: number | null;
  valido: boolean;
  pct_falhas: number;
}

export interface PrecipitacaoAnual {
  estacao_codigo: string;
  ano: number;
  valor: number | null;
  valido: boolean;
  pct_falhas: number;
}

export interface MaxDiariaAnual {
  estacao_codigo: string;
  ano: number;
  valor: number;
  data_ocorrencia: string;
}

export interface EstatisticasDescritivas {
  media: number;
  mediana: number;
  desvio_padrao: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  n_observacoes: number;
  n_falhas: number;
  pct_falhas: number;
  coef_variacao: number | null;
  assimetria: number | null;
  curtose: number | null;
}

export interface HistogramaData {
  bins: number[];
  counts: number[];
  bin_centers: number[];
  estatisticas: EstatisticasDescritivas;
}

export interface Histograma {
  estacao_codigo: string;
  tipo: "diaria" | "mensal" | "anual" | "max_diaria_anual";
  dados: HistogramaData;
}

export interface PreenchimentoResultado {
  id: number;
  estacao_referencia: string;
  metodo: "regressao" | "idw";
  parametros: {
    equacao?: string;
    coeficientes?: Record<string, number>;
    intercepto?: number;
    r2_treino?: number;
    distancias_km?: Record<string, number>;
    expoente?: number;
  };
  n_dias_preenchidos: number;
  rmse_holdout: number;
  r2: number | null;
  is_vencedor: boolean;
}

export interface ResumoEstacao extends Estacao {
  anos_validos: number | null;
  media_anual_mm: number | null;
}

// Tipos de série para navegação
export type TipoSerie = "diaria" | "mensal" | "anual" | "max_diaria_anual";

export const TIPO_SERIE_LABELS: Record<TipoSerie, string> = {
  diaria: "Diária",
  mensal: "Mensal",
  anual: "Anual",
  max_diaria_anual: "Máx. Diária Anual",
};

export const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export interface EstacaoCandidata {
  codigo: string;
  inicio: number | null;
  fim: number | null;
  anos_bons: number;
  pct_falhas: number;
}

export interface ConfigEstacao {
  codigo: string;
  nome: string;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  is_referencia: boolean;
  selecionado_em?: string;
}

export interface PreenchimentoDiario {
  estacao_codigo: string;
  data: string;
  valor_regressao: number | null;
  valor_idw: number | null;
}

export interface EstacaoSemDados {
  codigo: string;
  nome_arquivo: string;
  motivo: string;
  registrado_em: string;
}

// ===========================================================================
// Projeto 2 / Fase 1 — Fluviometria + Curva-chave
// ===========================================================================

export interface EstacaoFluvio {
  codigo: string;
  nome: string;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  area_drenagem_km2: number | null;
  is_outlet: boolean;
  bacia_nome: string | null;
  codigo_bacia: string | null;
  sub_bacia_pref: string | null;
  operadora: string | null;
  operando: boolean | null;
  anos_dados: number | null;
  n_dias_total: number | null;
  n_dias_com_vazao: number | null;
  pct_falhas_vazao: number | null;
  data_inicio: string | null;
  data_fim: string | null;
}

export interface FluvioDiaria {
  estacao_codigo: string;
  data: string;             // ISO date
  vazao_m3s: number | null;
  cota_cm: number | null;
  consistencia: number | null;
  status_vazao: number | null;
  status_cota: number | null;
  preenchido: boolean;
  metodo: string | null;    // "observado" | "curva_chave"
}

export interface FluvioMensal {
  estacao_codigo: string;
  ano: number;
  mes: number;
  vazao_media: number | null;
  vazao_min: number | null;
  vazao_max: number | null;
  valido: boolean;
  pct_falhas: number | null;
}

export interface FluvioAnual {
  estacao_codigo: string;
  ano: number;
  vazao_media: number | null;
  vazao_min: number | null;
  vazao_max: number | null;
  valido: boolean;
  pct_falhas: number | null;
}

export interface MedicaoDescarga {
  id: number;
  estacao_codigo: string;
  data_medicao: string;     // ISO timestamp
  cota_m: number | null;
  vazao_m3s: number | null;
  area_molhada_m2: number | null;
  vel_media_ms: number | null;
  largura_m: number | null;
  profundidade_m: number | null;
  consistencia: number | null;
}

export interface CurvaChaveParametros {
  a: number;
  b: number;
  h0: number;
  h_min?: number;
  h_max?: number;
  pontos?: Array<{ cota_m: number; vazao_m3s: number; vazao_ajustada: number }>;
}

export interface CurvaChaveAjuste {
  estacao_codigo: string;
  versao: number;
  forma: "potencia" | "segmentada" | "ana_oficial";
  parametros: CurvaChaveParametros;
  r2: number | null;
  rmse: number | null;
  mae: number | null;
  ks_pvalue: number | null;
  n_pontos: number | null;
  intervalo_validade: { data_inicio?: string; data_fim?: string } | null;
  vigente: boolean;
  criado_em: string;
}

export interface EstacaoCandidataFluvio {
  codigo: string;
  nome: string | null;
  lat: number | null;
  lon: number | null;
  area_drenagem_km2: number | null;
  anos_dados: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  operando: boolean | null;
  operadora: string | null;
  bacia_nome: string | null;
  sub_bacia_pref: string | null;
  dist_min_km: number | null;
  dist_centroide_km: number | null;
  score_anos: number | null;
  score_falhas: number | null;
  score_proximidade: number | null;
  score: number | null;
}

export interface ConfigEstacaoFluvio {
  codigo: string;
  nome: string | null;
  lat: number | null;
  lon: number | null;
  area_drenagem_km2: number | null;
  is_outlet: boolean;
  selecionado_em?: string;
}

// ---------------------------------------------------------------------------
// Pluviômetros do Projeto 2 (chuva-vazão da bacia do exutório fluvio)
// ---------------------------------------------------------------------------

export interface EstacaoCandidataPluvioP2 {
  codigo: string;
  nome: string | null;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  anos_dados: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  operando: boolean | null;
  operadora: string | null;
  bacia_nome: string | null;
  sub_bacia_pref: string | null;
  dist_exutorio_km: number | null;
  dist_centroide_bacia_km: number | null;
  score_anos: number | null;
  score_falhas: number | null;
  score_proximidade: number | null;
  score: number | null;
}

export interface ConfigPluviometroP2 {
  codigo: string;
  nome: string | null;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  ativo: boolean;
  is_referencia: boolean;
  selecionado_em?: string;
}

// ===========================================================================
// Projeto 2 / Fase 2 — Regime de vazões
// ===========================================================================

export interface CurvaPermanenciaPonto {
  estacao_codigo: string;
  percentil: number;        // 0..100
  vazao_m3s: number | null;
}

export interface QuantisPermanencia {
  estacao_codigo: string;
  q1:  number | null;
  q5:  number | null;
  q10: number | null;
  q25: number | null;
  q50: number | null;
  q75: number | null;
  q90: number | null;
  q95: number | null;
  q99: number | null;
  declividade_log: number | null;
  razao_q10_q90:   number | null;
}

export interface EckhardtSerie {
  estacao_codigo: string;
  data: string;
  q_total: number | null;
  q_base: number | null;
  q_direto: number | null;
  bfi_diario: number | null;
}

export interface EckhardtParams {
  estacao_codigo: string;
  alpha: number | null;
  k_dias: number | null;
  bfi_max: number | null;
  bfi_global: number | null;
  metodo_estimacao: string | null;
  n_janelas_recessao: number | null;
  k_min: number | null;
  k_max: number | null;
}

export interface Q7Minimo {
  estacao_codigo: string;
  ano_hidrologico: number;
  q7_m3s: number | null;
  data_ocorrencia: string | null;
}

export interface Q710Ajuste {
  estacao_codigo: string;
  distribuicao: string;
  parametros: { mu_log?: number; sigma_log?: number; skew_log?: number };
  q7_10_m3s: number | null;
  ks_pvalue: number | null;
  n_anos: number | null;
  tr_anos: number | null;
}

// ===========================================================================
// Projeto 2 / Fase 3 — Eventos & Hidrogramas Unitários
// ===========================================================================

export interface HietogramaPonto {
  data: string;
  p_mm: number;
}

export interface HidrogramaPonto {
  data: string;
  q_total: number;
  q_base: number;
  q_direto: number;
}

export interface EventoChuvaVazao {
  id: number;
  estacao_codigo: string;
  t_inicio: string;
  t_pico: string;
  t_fim: string;
  duracao_dias: number;
  p_total_mm: number;
  p_efetiva_mm: number | null;
  q_pico_m3s: number;
  q_base_inicio_m3s: number;
  q_base_fim_m3s: number;
  volume_direto_m3: number;
  lamina_mm: number;
  phi_index_mm_dia: number | null;
  hietograma: HietogramaPonto[];
  hidrograma: HidrogramaPonto[];
}

export interface HidrogramaUnitarioObservado {
  estacao_codigo: string;
  evento_id: number | null;       // null = HU médio
  dt_dias: number;
  ordenadas_m3s_per_mm: number[];
  lamina_mm: number | null;
  q_pico_uh: number | null;
  t_pico_idx: number | null;
  base_time_dias: number | null;
  area_km2: number | null;
  n_eventos: number | null;        // só no médio
  desvio_ordenadas: number[] | null;
}

export interface HidrogramaUnitarioScs {
  estacao_codigo: string;
  area_km2: number | null;
  tc_min: number | null;
  tc_metodo: string | null;
  duracao_efetiva_min: number | null;
  dt_min: number | null;
  tp_h: number | null;
  t_pico_h: number | null;
  tb_h: number | null;
  qp_m3s_per_mm: number | null;
  ordenadas_m3s_per_mm: number[];
  tempos_h: number[];
  parametros: Record<string, number | string | null>;
}

export interface ComparacaoUH {
  estacao_codigo: string;
  evento_id: number | null;
  escopo: "evento" | "medio";
  nse: number | null;
  erro_pico_pct: number | null;
  erro_tpico_h: number | null;
  qp_obs: number | null;
  qp_scs: number | null;
}

// ===========================================================================
// Projeto 2 / Fase 4 — Frequência de cheias, IDF, chuva de projeto
// ===========================================================================

export interface MaxAnualVazao {
  estacao_codigo: string;
  ano: number;
  q_max_m3s: number | null;
  data_ocorrencia: string | null;
}

export type DistribuicaoNome = "gumbel" | "gev" | "lognormal" | "p3" | "lp3";

export interface FrequenciaAjuste {
  estacao_codigo: string;
  distribuicao: DistribuicaoNome;
  parametros: Record<string, number>;
  aic: number | null;
  bic: number | null;
  log_lik: number | null;
  ks_stat: number | null;
  ks_pvalue: number | null;
  n_amostras: number | null;
  recomendado: boolean;
}

export interface FrequenciaQuantil {
  estacao_codigo: string;
  distribuicao: DistribuicaoNome;
  tr: number;
  q_tr_m3s: number | null;
  ic_lo: number | null;
  ic_hi: number | null;
}

export interface IDFParametros {
  regiao: string;
  equacao: string;
  parametros: { a: number; b: number; c: number; d: number };
  fonte: string | null;
}

export interface IDFCurvaPonto {
  regiao: string;
  tr: number;
  duracao_min: number;
  intensidade_mm_h: number | null;
}

export interface ChuvaProjeto {
  id: number;
  regiao: string;
  tr: number;
  duracao_total_min: number;
  n_blocos: number;
  dt_min: number;
  padrao: string;
  hietograma: { t_min: number; p_mm: number; i_mm_h: number }[];
  gerado_em: string;
}
