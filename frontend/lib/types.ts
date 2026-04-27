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
