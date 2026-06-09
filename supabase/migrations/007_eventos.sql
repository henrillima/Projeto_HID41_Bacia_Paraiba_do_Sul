-- =============================================================================
-- HID-41 / Projeto 2 — Fase 3: Eventos & Hidrogramas Unitários
-- Migration 007
-- Idempotente: pode ser re-aplicada sem erros (CREATE … IF NOT EXISTS +
-- DROP POLICY IF EXISTS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Eventos chuva-vazão isolados (cada linha = um evento)
-- ---------------------------------------------------------------------------
create table if not exists eventos_chuva_vazao (
  id                 bigserial primary key,
  estacao_codigo     text       not null references estacoes_fluvio(codigo) on delete cascade,
  t_inicio           date       not null,
  t_pico             date       not null,
  t_fim              date       not null,
  duracao_dias       integer,
  p_total_mm         numeric(10,2),
  p_efetiva_mm       numeric(10,2),
  q_pico_m3s         numeric(12,3),
  q_base_inicio_m3s  numeric(12,3),
  q_base_fim_m3s     numeric(12,3),
  volume_direto_m3   numeric(15,2),
  lamina_mm          numeric(10,2),
  phi_index_mm_dia   numeric(8,3),
  hietograma         jsonb,                 -- [{data, p_mm}, ...]
  hidrograma         jsonb                  -- [{data, q_total, q_base, q_direto}, ...]
);

create index if not exists idx_eventos_estacao_data
  on eventos_chuva_vazao (estacao_codigo, t_pico);

comment on table eventos_chuva_vazao is
  'Eventos chuva-vazão isolados (Fase 3) — base para HU observado.';

-- ---------------------------------------------------------------------------
-- HU observado (por evento + médio).
-- Usa id surrogate como PK; a unicidade lógica (estacao, evento_id) inclui o
-- caso evento_id NULL (HU médio) via índice único com COALESCE.
-- ---------------------------------------------------------------------------
create table if not exists hidrograma_unitario_observado (
  id                 bigserial primary key,
  estacao_codigo     text   not null references estacoes_fluvio(codigo) on delete cascade,
  evento_id          bigint references eventos_chuva_vazao(id) on delete cascade,
  dt_dias            integer default 1,
  ordenadas_m3s_per_mm jsonb,
  lamina_mm          numeric(10,3),
  q_pico_uh          numeric(12,4),
  t_pico_idx         integer,
  base_time_dias     integer,
  area_km2           numeric(11,2),
  n_eventos          integer,         -- preenchido só no HU médio
  desvio_ordenadas   jsonb,           -- preenchido só no HU médio
  criado_em          timestamptz default now()
);

create unique index if not exists ux_huo_obs_estacao_evento
  on hidrograma_unitario_observado (estacao_codigo, coalesce(evento_id, -1));

-- ---------------------------------------------------------------------------
-- HU SCS (sintético triangular) — uma linha por estação
-- ---------------------------------------------------------------------------
create table if not exists hidrograma_unitario_scs (
  estacao_codigo     text primary key references estacoes_fluvio(codigo) on delete cascade,
  area_km2           numeric(11,2),
  tc_min             numeric(10,2),
  tc_metodo          text,                  -- "kirpich" | "watt_chow"
  duracao_efetiva_min numeric(10,2),
  dt_min             numeric(10,2),
  tp_h               numeric(8,3),     -- tp = 0.6 · tc  (h)
  t_pico_h           numeric(8,3),     -- Tp = tp + d/2  (h) — tempo até o pico
  tb_h               numeric(8,3),     -- 2.67 · Tp  (h)
  qp_m3s_per_mm      numeric(12,4),
  ordenadas_m3s_per_mm jsonb,
  tempos_h           jsonb,
  parametros         jsonb,                 -- L_km, delta_h_m, S, CN, etc.
  criado_em          timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Comparação HU observado × SCS — id surrogate + unique index com COALESCE
-- ---------------------------------------------------------------------------
create table if not exists comparacao_uh (
  id                 bigserial primary key,
  estacao_codigo     text   not null references estacoes_fluvio(codigo) on delete cascade,
  evento_id          bigint references eventos_chuva_vazao(id) on delete cascade,
  escopo             text   not null check (escopo in ('evento', 'medio')),
  nse                numeric(8,4),
  erro_pico_pct      numeric(8,2),
  erro_tpico_h       numeric(8,2),
  qp_obs             numeric(12,4),
  qp_scs             numeric(12,4)
);

create unique index if not exists ux_comparacao_uh_natural
  on comparacao_uh (estacao_codigo, coalesce(evento_id, -1), escopo);

-- ---------------------------------------------------------------------------
-- RLS — drop antes de re-criar permite re-rodar a migration sem erro
-- ---------------------------------------------------------------------------
alter table eventos_chuva_vazao            enable row level security;
alter table hidrograma_unitario_observado  enable row level security;
alter table hidrograma_unitario_scs        enable row level security;
alter table comparacao_uh                  enable row level security;

drop policy if exists "leitura_publica_eventos"       on eventos_chuva_vazao;
drop policy if exists "leitura_publica_huo_obs"       on hidrograma_unitario_observado;
drop policy if exists "leitura_publica_huo_scs"       on hidrograma_unitario_scs;
drop policy if exists "leitura_publica_comparacao_uh" on comparacao_uh;

create policy "leitura_publica_eventos"
  on eventos_chuva_vazao for select using (true);
create policy "leitura_publica_huo_obs"
  on hidrograma_unitario_observado for select using (true);
create policy "leitura_publica_huo_scs"
  on hidrograma_unitario_scs for select using (true);
create policy "leitura_publica_comparacao_uh"
  on comparacao_uh for select using (true);
