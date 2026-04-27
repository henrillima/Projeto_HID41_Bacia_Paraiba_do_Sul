-- =============================================================================
-- HID-41: Análise Pluviométrica — Bacia do Paraíba do Sul
-- Migration 001: Schema inicial
-- Executar no SQL Editor do Supabase antes de rodar o pipeline Python.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Estações pluviométricas
-- ---------------------------------------------------------------------------
create table if not exists estacoes (
  codigo                       text primary key,
  nome                         text not null,
  lat                          numeric(9,6) not null,
  lon                          numeric(9,6) not null,
  altitude                     numeric,
  is_referencia                boolean default false,
  anos_dados                   integer,
  n_dias_total                 integer,
  n_dias_com_dado              integer,
  pct_falhas_original          numeric(6,2),
  pct_falhas_pos_preenchimento numeric(6,2),
  data_inicio                  date,
  data_fim                     date,
  criado_em                    timestamptz default now(),
  atualizado_em                timestamptz default now()
);

comment on table estacoes is
  'Estações pluviométricas da ANA (Hidroweb) selecionadas para a bacia do Paraíba do Sul.';
comment on column estacoes.is_referencia is
  'True somente para a estação escolhida como referência no preenchimento de falhas.';

-- ---------------------------------------------------------------------------
-- Série diária — fonte da verdade
-- ---------------------------------------------------------------------------
create table if not exists precipitacao_diaria (
  estacao_codigo text        not null references estacoes(codigo) on delete cascade,
  data           date        not null,
  valor          numeric(8,1),        -- mm; NULL = dia sem registro
  preenchido     boolean     default false,
  metodo         text,                -- 'regressao' | 'idw' | null
  consistencia   smallint,            -- 1 = bruto, 2 = consistido (ANA)
  primary key (estacao_codigo, data)
);

create index if not exists idx_diaria_estacao_data
  on precipitacao_diaria (estacao_codigo, data);
create index if not exists idx_diaria_data
  on precipitacao_diaria (data);

comment on column precipitacao_diaria.preenchido is
  'True quando o valor foi gerado por um dos métodos de preenchimento de falhas.';
comment on column precipitacao_diaria.metodo is
  'Método usado no preenchimento: regressao ou idw. NULL quando dado original.';

-- ---------------------------------------------------------------------------
-- Série mensal
-- ---------------------------------------------------------------------------
create table if not exists precipitacao_mensal (
  estacao_codigo text    not null references estacoes(codigo) on delete cascade,
  ano            integer not null,
  mes            integer not null check (mes between 1 and 12),
  valor          numeric(8,1),
  valido         boolean,             -- false se pct_falhas > limite configurado
  pct_falhas     numeric(6,2),
  primary key (estacao_codigo, ano, mes)
);

create index if not exists idx_mensal_estacao
  on precipitacao_mensal (estacao_codigo, ano);

-- ---------------------------------------------------------------------------
-- Série anual
-- ---------------------------------------------------------------------------
create table if not exists precipitacao_anual (
  estacao_codigo text    not null references estacoes(codigo) on delete cascade,
  ano            integer not null,
  valor          numeric(9,1),
  valido         boolean,
  pct_falhas     numeric(6,2),
  primary key (estacao_codigo, ano)
);

-- ---------------------------------------------------------------------------
-- Precipitação máxima diária anual
-- ---------------------------------------------------------------------------
create table if not exists max_diaria_anual (
  estacao_codigo  text    not null references estacoes(codigo) on delete cascade,
  ano             integer not null,
  valor           numeric(8,1),
  data_ocorrencia date,
  primary key (estacao_codigo, ano)
);

-- ---------------------------------------------------------------------------
-- Histogramas (JSONB para flexibilidade de bins e estatísticas)
-- ---------------------------------------------------------------------------
create table if not exists histogramas (
  estacao_codigo text not null references estacoes(codigo) on delete cascade,
  tipo           text not null check (tipo in ('diaria', 'mensal', 'anual', 'max_diaria_anual')),
  dados          jsonb not null,
  -- dados shape:
  -- { "bins": [...], "counts": [...], "bin_centers": [...],
  --   "estatisticas": { "media": x, "mediana": x, "desvio_padrao": x,
  --                     "min": x, "max": x, "p25": x, ... "pct_falhas": x } }
  primary key (estacao_codigo, tipo)
);

-- ---------------------------------------------------------------------------
-- Resultados dos métodos de preenchimento de falhas
-- ---------------------------------------------------------------------------
create table if not exists preenchimento_resultado (
  id                   serial primary key,
  estacao_referencia   text    not null references estacoes(codigo) on delete cascade,
  metodo               text    not null check (metodo in ('regressao', 'idw')),
  parametros           jsonb   not null,
  -- Para regressao: { "equacao": "P_ref = a*P1 + b*P2 + c", "coeficientes": {...},
  --                   "intercepto": x, "r2_treino": x }
  -- Para idw:       { "distancias_km": {...}, "expoente": 2 }
  n_dias_preenchidos   integer,
  rmse_holdout         numeric(8,4),
  r2                   numeric(6,4),   -- somente para regressao
  is_vencedor          boolean default false,
  criado_em            timestamptz default now()
);

comment on column preenchimento_resultado.is_vencedor is
  'True para o método com menor RMSE no holdout — aplicado à série final.';

-- ---------------------------------------------------------------------------
-- Row Level Security — leitura pública (front não precisa de auth)
-- ---------------------------------------------------------------------------
alter table estacoes               enable row level security;
alter table precipitacao_diaria    enable row level security;
alter table precipitacao_mensal    enable row level security;
alter table precipitacao_anual     enable row level security;
alter table max_diaria_anual       enable row level security;
alter table histogramas            enable row level security;
alter table preenchimento_resultado enable row level security;

-- Uma policy por tabela (nome único por tabela no Postgres)
create policy "leitura_publica_estacoes"
  on estacoes for select using (true);
create policy "leitura_publica_diaria"
  on precipitacao_diaria for select using (true);
create policy "leitura_publica_mensal"
  on precipitacao_mensal for select using (true);
create policy "leitura_publica_anual"
  on precipitacao_anual for select using (true);
create policy "leitura_publica_max"
  on max_diaria_anual for select using (true);
create policy "leitura_publica_hist"
  on histogramas for select using (true);
create policy "leitura_publica_preench"
  on preenchimento_resultado for select using (true);

-- ---------------------------------------------------------------------------
-- Views para o frontend
-- ---------------------------------------------------------------------------

-- Resumo por estação (KPIs rápidos)
create or replace view resumo_estacoes as
select
  e.codigo,
  e.nome,
  e.lat,
  e.lon,
  e.altitude,
  e.is_referencia,
  e.anos_dados,
  e.pct_falhas_original,
  e.pct_falhas_pos_preenchimento,
  e.data_inicio,
  e.data_fim,
  (select count(*) from precipitacao_anual pa where pa.estacao_codigo = e.codigo and pa.valido = true) as anos_validos,
  (select avg(pa.valor) from precipitacao_anual pa where pa.estacao_codigo = e.codigo and pa.valido = true) as media_anual_mm
from estacoes e;

-- Série mensal completa com nome da estação (para gráficos comparativos)
create or replace view serie_mensal_completa as
select
  pm.estacao_codigo,
  e.nome  as estacao_nome,
  pm.ano,
  pm.mes,
  pm.valor,
  pm.valido,
  pm.pct_falhas,
  make_date(pm.ano, pm.mes, 1) as data_ref
from precipitacao_mensal pm
join estacoes e on e.codigo = pm.estacao_codigo
order by pm.estacao_codigo, pm.ano, pm.mes;
