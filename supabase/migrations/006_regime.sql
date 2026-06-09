-- =============================================================================
-- HID-41 / Projeto 2 — Fase 2: Regime de Vazões
-- Migration 006
-- Cobre: Curva de Permanência (Q90/Q50/Q10), Eckhardt baseflow, Q7,10.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Curva de permanência (resolução de 0.5% → ~201 pontos por estação)
-- ---------------------------------------------------------------------------
create table if not exists curva_permanencia (
  estacao_codigo  text       not null references estacoes_fluvio(codigo) on delete cascade,
  percentil       numeric(5,2) not null,        -- 0..100
  vazao_m3s       numeric(12,3),
  primary key (estacao_codigo, percentil)
);

comment on table curva_permanencia is
  'Curva de permanência (Weibull) com passo 0,5%. Q_x = vazao_m3s onde percentil = x.';

-- ---------------------------------------------------------------------------
-- Quantis de referência (wide row, consumo direto pelo front)
-- ---------------------------------------------------------------------------
create table if not exists quantis_permanencia (
  estacao_codigo  text primary key references estacoes_fluvio(codigo) on delete cascade,
  q1   numeric(12,3),
  q5   numeric(12,3),
  q10  numeric(12,3),
  q25  numeric(12,3),
  q50  numeric(12,3),
  q75  numeric(12,3),
  q90  numeric(12,3),
  q95  numeric(12,3),
  q99  numeric(12,3),
  declividade_log numeric(10,5),
  razao_q10_q90   numeric(10,3)
);

-- ---------------------------------------------------------------------------
-- Filtro de Eckhardt — série diária separada
-- ---------------------------------------------------------------------------
create table if not exists eckhardt_serie (
  estacao_codigo text not null references estacoes_fluvio(codigo) on delete cascade,
  data           date not null,
  q_total        numeric(12,3),
  q_base         numeric(12,3),
  q_direto       numeric(12,3),
  bfi_diario     numeric(6,4),
  primary key (estacao_codigo, data)
);

create index if not exists idx_eckhardt_serie_estacao
  on eckhardt_serie (estacao_codigo, data);

-- ---------------------------------------------------------------------------
-- Parâmetros do filtro de Eckhardt por estação
-- ---------------------------------------------------------------------------
create table if not exists eckhardt_params (
  estacao_codigo     text primary key references estacoes_fluvio(codigo) on delete cascade,
  alpha              numeric(8,6),     -- exp(-Δt/k)
  k_dias             numeric(8,2),     -- constante de recessão
  bfi_max            numeric(5,4),     -- 0.80 (poroso), 0.50 (fraturado), 0.25 (efêmero)
  bfi_global         numeric(5,4),     -- Σ b / Σ y observado
  metodo_estimacao   text,             -- "regressao_log_recessoes" | "default"
  n_janelas_recessao integer,
  k_min              numeric(8,2),
  k_max              numeric(8,2)
);

-- ---------------------------------------------------------------------------
-- Mínimos anuais Q7 (média móvel de 7 dias)
-- ---------------------------------------------------------------------------
create table if not exists q7_minimos_anuais (
  estacao_codigo   text not null references estacoes_fluvio(codigo) on delete cascade,
  ano_hidrologico  integer not null,
  q7_m3s           numeric(12,3),
  data_ocorrencia  date,
  primary key (estacao_codigo, ano_hidrologico)
);

-- ---------------------------------------------------------------------------
-- Ajuste Log-Pearson III para Q7,10
-- ---------------------------------------------------------------------------
create table if not exists q7_10_ajuste (
  estacao_codigo text primary key references estacoes_fluvio(codigo) on delete cascade,
  distribuicao   text,                 -- "log_pearson3"
  parametros     jsonb,                -- { mu_log, sigma_log, skew_log }
  q7_10_m3s      numeric(12,3),
  ks_pvalue      numeric(6,4),
  n_anos         integer,
  tr_anos        numeric(6,1)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table curva_permanencia    enable row level security;
alter table quantis_permanencia  enable row level security;
alter table eckhardt_serie       enable row level security;
alter table eckhardt_params      enable row level security;
alter table q7_minimos_anuais    enable row level security;
alter table q7_10_ajuste         enable row level security;

create policy "leitura_publica_perm"
  on curva_permanencia for select using (true);
create policy "leitura_publica_quantis"
  on quantis_permanencia for select using (true);
create policy "leitura_publica_eckhardt_serie"
  on eckhardt_serie for select using (true);
create policy "leitura_publica_eckhardt_params"
  on eckhardt_params for select using (true);
create policy "leitura_publica_q7_min"
  on q7_minimos_anuais for select using (true);
create policy "leitura_publica_q7_10"
  on q7_10_ajuste for select using (true);
