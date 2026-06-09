-- =============================================================================
-- HID-41 / Projeto 2 — Fase 1: Fluviometria + Curva-Chave
-- Migration 005
-- Pré-requisito: API REST HidroWebService configurada (pipeline/.env).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Estações fluviométricas (espelha `estacoes` mas inclui área de drenagem)
-- ---------------------------------------------------------------------------
create table if not exists estacoes_fluvio (
  codigo               text primary key,
  nome                 text not null,
  lat                  numeric(9,6),
  lon                  numeric(9,6),
  altitude             numeric,
  area_drenagem_km2    numeric(11,2),     -- crítico para HU SCS na Fase 3
  is_outlet            boolean default false,
  bacia_nome           text,
  codigo_bacia         text,
  sub_bacia_pref       text,
  operadora            text,
  operando             boolean,
  anos_dados           numeric(5,1),
  n_dias_total         integer,
  n_dias_com_vazao     integer,
  pct_falhas_vazao     numeric(6,2),
  data_inicio          date,
  data_fim             date,
  criado_em            timestamptz default now(),
  atualizado_em        timestamptz default now()
);

comment on table estacoes_fluvio is
  'Estações fluviométricas da ANA (HidroWebService) — exutório e candidatas.';
comment on column estacoes_fluvio.is_outlet is
  'True somente para a estação escolhida como exutório da bacia de estudo.';

-- ---------------------------------------------------------------------------
-- Série diária consolidada (vazão + cota)
-- ---------------------------------------------------------------------------
create table if not exists fluviometria_diaria (
  estacao_codigo  text     not null references estacoes_fluvio(codigo) on delete cascade,
  data            date     not null,
  vazao_m3s       numeric(12,3),    -- m³/s
  cota_cm         numeric(8,1),     -- cm
  consistencia    smallint,         -- 1 = bruto, 2 = consistido (ANA)
  status_vazao    smallint,         -- 0 ok, 1 suspeito, 2 ruim
  status_cota     smallint,
  preenchido      boolean default false,    -- true se vazão derivada de cota via curva-chave
  metodo          text,             -- 'observado' | 'curva_chave'
  primary key (estacao_codigo, data)
);

create index if not exists idx_fluvio_diaria_estacao_data
  on fluviometria_diaria (estacao_codigo, data);
create index if not exists idx_fluvio_diaria_data
  on fluviometria_diaria (data);

comment on column fluviometria_diaria.preenchido is
  'True quando a vazão foi estimada a partir da cota via curva-chave (Fase 1).';

-- ---------------------------------------------------------------------------
-- Série mensal de vazão
-- ---------------------------------------------------------------------------
create table if not exists fluviometria_mensal (
  estacao_codigo  text     not null references estacoes_fluvio(codigo) on delete cascade,
  ano             integer  not null,
  mes             integer  not null check (mes between 1 and 12),
  vazao_media     numeric(12,3),
  vazao_min       numeric(12,3),
  vazao_max       numeric(12,3),
  valido          boolean,
  pct_falhas      numeric(6,2),
  primary key (estacao_codigo, ano, mes)
);

-- ---------------------------------------------------------------------------
-- Série anual de vazão
-- ---------------------------------------------------------------------------
create table if not exists fluviometria_anual (
  estacao_codigo  text     not null references estacoes_fluvio(codigo) on delete cascade,
  ano             integer  not null,
  vazao_media     numeric(12,3),
  vazao_min       numeric(12,3),
  vazao_max       numeric(12,3),
  valido          boolean,
  pct_falhas      numeric(6,2),
  primary key (estacao_codigo, ano)
);

-- ---------------------------------------------------------------------------
-- Medições pontuais (cota × vazão) — base para ajuste da curva-chave
-- ---------------------------------------------------------------------------
create table if not exists curva_chave_medicoes (
  id                 bigserial primary key,
  estacao_codigo     text       not null references estacoes_fluvio(codigo) on delete cascade,
  data_medicao       timestamptz not null,
  cota_m             numeric(8,3),
  vazao_m3s          numeric(12,3),
  area_molhada_m2    numeric(12,3),
  vel_media_ms       numeric(8,3),
  largura_m          numeric(8,2),
  profundidade_m     numeric(8,2),
  consistencia       smallint
);

create index if not exists idx_medicoes_estacao
  on curva_chave_medicoes (estacao_codigo, data_medicao);

-- ---------------------------------------------------------------------------
-- Ajuste(s) da curva-chave por estação (potência Q = a·(h − h₀)^b)
-- ---------------------------------------------------------------------------
create table if not exists curva_chave_ajuste (
  estacao_codigo     text       not null references estacoes_fluvio(codigo) on delete cascade,
  versao             integer    not null,
  forma              text       not null check (forma in ('potencia', 'segmentada', 'ana_oficial')),
  parametros         jsonb      not null,
  -- Para 'potencia': { "a": <num>, "b": <num>, "h0": <num>,
  --                    "h_min": <num>, "h_max": <num> }
  -- Para 'ana_oficial': armazena o registro bruto vindo de
  --   /HidroSerieCurvaDescarga/v1, preservando colunas originais.
  r2                 numeric(6,4),
  rmse               numeric(12,3),
  mae                numeric(12,3),
  ks_pvalue          numeric(6,4),
  n_pontos           integer,
  intervalo_validade jsonb,        -- { "data_inicio": "...", "data_fim": "..." }
  vigente            boolean default true,
  criado_em          timestamptz default now(),
  primary key (estacao_codigo, versao)
);

comment on column curva_chave_ajuste.parametros is
  'Parâmetros da curva. JSONB para flexibilidade entre formas (potência simples vs segmentada).';

-- ---------------------------------------------------------------------------
-- Candidatas a exutório (ranking gerado por download_fluvio.py --discover)
-- ---------------------------------------------------------------------------
create table if not exists estacoes_candidatas_fluvio (
  codigo              text primary key,
  nome                text,
  lat                 numeric(9,6),
  lon                 numeric(9,6),
  area_drenagem_km2   numeric(11,2),
  anos_dados          numeric(5,1),
  data_inicio         date,
  data_fim            date,
  operando            boolean,
  operadora           text,
  bacia_nome          text,
  sub_bacia_pref      text,
  dist_min_km         numeric(8,2),
  dist_centroide_km   numeric(8,2),
  score_anos          numeric(6,4),
  score_falhas        numeric(6,4),
  score_proximidade   numeric(6,4),
  score               numeric(6,4),
  registrado_em       timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Configuração da estação exutória (UI-editable)
-- ---------------------------------------------------------------------------
create table if not exists config_estacoes_fluvio (
  codigo              text primary key,
  nome                text,
  lat                 numeric(9,6),
  lon                 numeric(9,6),
  area_drenagem_km2   numeric(11,2),
  is_outlet           boolean default false,
  selecionado_em      timestamptz default now(),
  atualizado_em       timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — leitura pública (front não precisa de auth)
-- ---------------------------------------------------------------------------
alter table estacoes_fluvio             enable row level security;
alter table fluviometria_diaria         enable row level security;
alter table fluviometria_mensal         enable row level security;
alter table fluviometria_anual          enable row level security;
alter table curva_chave_medicoes        enable row level security;
alter table curva_chave_ajuste          enable row level security;
alter table estacoes_candidatas_fluvio  enable row level security;
alter table config_estacoes_fluvio      enable row level security;

create policy "leitura_publica_estacoes_fluvio"
  on estacoes_fluvio for select using (true);
create policy "leitura_publica_fluvio_diaria"
  on fluviometria_diaria for select using (true);
create policy "leitura_publica_fluvio_mensal"
  on fluviometria_mensal for select using (true);
create policy "leitura_publica_fluvio_anual"
  on fluviometria_anual for select using (true);
create policy "leitura_publica_medicoes"
  on curva_chave_medicoes for select using (true);
create policy "leitura_publica_curva_ajuste"
  on curva_chave_ajuste for select using (true);
create policy "leitura_publica_candidatas_fluvio"
  on estacoes_candidatas_fluvio for select using (true);

-- config_estacoes_fluvio: leitura + escrita pública (espelha config_estacoes)
create policy "leitura_publica_config_fluvio"
  on config_estacoes_fluvio for select using (true);
create policy "insert_publico_config_fluvio"
  on config_estacoes_fluvio for insert with check (true);
create policy "update_publico_config_fluvio"
  on config_estacoes_fluvio for update using (true) with check (true);
create policy "delete_publico_config_fluvio"
  on config_estacoes_fluvio for delete using (true);

-- ---------------------------------------------------------------------------
-- Views convenientes para o frontend
-- ---------------------------------------------------------------------------

-- Resumo do exutório
create or replace view resumo_exutorio as
select
  ef.codigo,
  ef.nome,
  ef.lat,
  ef.lon,
  ef.altitude,
  ef.area_drenagem_km2,
  ef.anos_dados,
  ef.pct_falhas_vazao,
  ef.data_inicio,
  ef.data_fim,
  (select avg(fa.vazao_media) from fluviometria_anual fa
     where fa.estacao_codigo = ef.codigo and fa.valido) as vazao_media_anual,
  (select count(*) from fluviometria_anual fa
     where fa.estacao_codigo = ef.codigo and fa.valido) as anos_validos
from estacoes_fluvio ef
where ef.is_outlet = true;

-- Curva-chave vigente por estação
create or replace view curva_chave_vigente as
select distinct on (estacao_codigo)
  estacao_codigo,
  versao,
  forma,
  parametros,
  r2,
  rmse,
  n_pontos,
  intervalo_validade
from curva_chave_ajuste
where vigente = true
order by estacao_codigo, criado_em desc;
