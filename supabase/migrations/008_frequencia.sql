-- =============================================================================
-- HID-41 / Projeto 2 — Fase 4: Frequência de Cheias, IDF e Chuva de Projeto
-- Migration 008
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Série de vazões máximas anuais
-- ---------------------------------------------------------------------------
create table if not exists max_anual_vazao (
  estacao_codigo text not null references estacoes_fluvio(codigo) on delete cascade,
  ano            integer not null,
  q_max_m3s      numeric(12,3),
  data_ocorrencia date,
  primary key (estacao_codigo, ano)
);

-- ---------------------------------------------------------------------------
-- Ajustes de distribuições candidatas
-- ---------------------------------------------------------------------------
create table if not exists frequencia_ajuste (
  estacao_codigo text not null references estacoes_fluvio(codigo) on delete cascade,
  distribuicao   text not null check (distribuicao in ('gumbel','gev','lognormal','p3','lp3')),
  parametros     jsonb not null,
  aic            numeric(12,3),
  bic            numeric(12,3),
  log_lik        numeric(12,3),
  ks_stat        numeric(8,4),
  ks_pvalue      numeric(6,4),
  n_amostras     integer,
  recomendado    boolean default false,
  primary key (estacao_codigo, distribuicao)
);

-- ---------------------------------------------------------------------------
-- Quantis (Q vs TR) para a distribuição recomendada
-- ---------------------------------------------------------------------------
create table if not exists frequencia_quantis (
  estacao_codigo text not null references estacoes_fluvio(codigo) on delete cascade,
  distribuicao   text not null,
  tr             integer not null,
  q_tr_m3s       numeric(12,3),
  ic_lo          numeric(12,3),
  ic_hi          numeric(12,3),
  primary key (estacao_codigo, distribuicao, tr)
);

-- ---------------------------------------------------------------------------
-- IDF — equação regional
-- ---------------------------------------------------------------------------
create table if not exists idf_parametros (
  regiao         text primary key,
  equacao        text default 'pfafstetter',
  parametros     jsonb not null,        -- { a, b, c, d }
  fonte          text,
  registrado_em  timestamptz default now()
);

create table if not exists idf_curva (
  regiao         text not null references idf_parametros(regiao) on delete cascade,
  tr             integer not null,
  duracao_min    numeric(8,1) not null,
  intensidade_mm_h numeric(10,3),
  primary key (regiao, tr, duracao_min)
);

-- ---------------------------------------------------------------------------
-- Chuva de projeto (blocos alternados) por TR e padrão temporal
-- ---------------------------------------------------------------------------
create table if not exists chuva_projeto (
  id                 bigserial primary key,
  regiao             text references idf_parametros(regiao) on delete set null,
  tr                 integer not null,
  duracao_total_min  numeric(10,1),
  n_blocos           integer,
  dt_min             numeric(8,2),
  padrao             text default 'intermediario',
  hietograma         jsonb,         -- [{t_min, p_mm, i_mm_h}, ...]
  gerado_em          timestamptz default now()
);

create index if not exists idx_chuva_projeto_tr
  on chuva_projeto (regiao, tr);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table max_anual_vazao    enable row level security;
alter table frequencia_ajuste  enable row level security;
alter table frequencia_quantis enable row level security;
alter table idf_parametros     enable row level security;
alter table idf_curva          enable row level security;
alter table chuva_projeto      enable row level security;

create policy "leitura_publica_max_q" on max_anual_vazao    for select using (true);
create policy "leitura_publica_freq_ajuste" on frequencia_ajuste  for select using (true);
create policy "leitura_publica_freq_quant"  on frequencia_quantis for select using (true);
create policy "leitura_publica_idf_par"     on idf_parametros     for select using (true);
create policy "leitura_publica_idf_curva"   on idf_curva          for select using (true);
create policy "leitura_publica_chuva_proj"  on chuva_projeto      for select using (true);
