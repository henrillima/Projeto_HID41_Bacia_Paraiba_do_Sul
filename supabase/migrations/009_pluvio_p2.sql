-- =============================================================================
-- HID-41 / Projeto 2 — Pluviômetros próximos da bacia (chuva-vazão)
-- Migration 009
--
-- Contexto: os 3 pluviômetros do Projeto 1 (Pindamonhangaba/Estrada do
-- Cunha/São Luís do Paraitinga) estão 51–90 km da bacia do Buquira (exutório
-- 58142200). Para a Fase 3 (eventos chuva-vazão, HU observado, φ-index),
-- é necessário usar pluviômetros DENTRO/PERTO da bacia, sem alterar as
-- páginas/tabelas do Projeto 1.
--
-- Estratégia: isolamento via coluna `projeto` em `estacoes` + tabelas de
-- ranking/seleção paralelas. Séries continuam em `precipitacao_diaria`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Marcar todas as estações existentes como Projeto 1
-- ---------------------------------------------------------------------------
alter table estacoes
  add column if not exists projeto varchar(2) not null default 'P1';

comment on column estacoes.projeto is
  'P1 = pluviômetros do Projeto 1 (visíveis em /estacoes, /dashboard). '
  'P2 = pluviômetros do Projeto 2 (chuva-vazão, isolados do BI do P1).';

create index if not exists idx_estacoes_projeto on estacoes (projeto);

-- ---------------------------------------------------------------------------
-- 2) Recriar `resumo_estacoes` filtrando só P1 (preserva BI do Projeto 1)
-- ---------------------------------------------------------------------------
drop view if exists resumo_estacoes;
create view resumo_estacoes as
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
  (select count(*) from precipitacao_anual pa
     where pa.estacao_codigo = e.codigo and pa.valido = true) as anos_validos,
  (select avg(pa.valor) from precipitacao_anual pa
     where pa.estacao_codigo = e.codigo and pa.valido = true) as media_anual_mm
from estacoes e
where e.projeto = 'P1';

-- ---------------------------------------------------------------------------
-- 3) Candidatas a pluviômetro do Projeto 2
--     (gerado por `python download_pluvio_p2.py --discover`)
-- ---------------------------------------------------------------------------
create table if not exists estacoes_candidatas_pluvio_p2 (
  codigo                   text primary key,
  nome                     text,
  lat                      numeric(9,6),
  lon                      numeric(9,6),
  altitude                 numeric,
  anos_dados               numeric(5,1),
  data_inicio              date,
  data_fim                 date,
  operando                 boolean,
  operadora                text,
  bacia_nome               text,
  sub_bacia_pref           text,
  dist_exutorio_km         numeric(8,2),     -- distância ao exutório fluvio
  dist_centroide_bacia_km  numeric(8,2),     -- distância ao centroide da bacia
  score_anos               numeric(6,4),
  score_falhas             numeric(6,4),
  score_proximidade        numeric(6,4),
  score                    numeric(6,4),
  registrado_em            timestamptz default now()
);

comment on table estacoes_candidatas_pluvio_p2 is
  'Ranking de pluviômetros candidatos a representar a chuva da bacia do '
  'Projeto 2. Gerado pelo CLI download_pluvio_p2.py --discover.';

-- ---------------------------------------------------------------------------
-- 4) Configuração dos pluviômetros ativos do Projeto 2 (UI-editável)
-- ---------------------------------------------------------------------------
create table if not exists config_pluviometros_p2 (
  codigo          text primary key,
  nome            text,
  lat             numeric(9,6),
  lon             numeric(9,6),
  altitude        numeric,
  ativo           boolean default true,
  is_referencia   boolean default false,
  selecionado_em  timestamptz default now(),
  atualizado_em   timestamptz default now()
);

comment on table config_pluviometros_p2 is
  'Pluviômetros marcados como ativos para a média de chuva da bacia '
  'na Fase 3 do Projeto 2 (eventos chuva-vazão).';

-- ---------------------------------------------------------------------------
-- 5) Row Level Security — leitura pública + escrita pública em config
-- ---------------------------------------------------------------------------
alter table estacoes_candidatas_pluvio_p2  enable row level security;
alter table config_pluviometros_p2         enable row level security;

create policy "leitura_publica_candidatas_pluvio_p2"
  on estacoes_candidatas_pluvio_p2 for select using (true);

create policy "leitura_publica_config_pluvio_p2"
  on config_pluviometros_p2 for select using (true);
create policy "insert_publico_config_pluvio_p2"
  on config_pluviometros_p2 for insert with check (true);
create policy "update_publico_config_pluvio_p2"
  on config_pluviometros_p2 for update using (true) with check (true);
create policy "delete_publico_config_pluvio_p2"
  on config_pluviometros_p2 for delete using (true);
