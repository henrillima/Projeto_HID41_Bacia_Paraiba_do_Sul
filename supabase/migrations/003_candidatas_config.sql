-- =============================================================================
-- HID-41: Migration 003 — Inventário de candidatas + configuração via UI
-- Executar no SQL Editor do Supabase após 002_estacoes_sem_dados.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Inventário de todas as estações com métricas de qualidade
-- Populado por: python discover.py --exportar-candidatas
-- ---------------------------------------------------------------------------
create table if not exists estacoes_candidatas (
  codigo       text primary key,
  inicio       integer,
  fim          integer,
  anos_bons    integer,
  pct_falhas   numeric(6,2),
  exportado_em timestamptz default now()
);

comment on table estacoes_candidatas is
  'Inventário de todas as estações disponíveis com métricas de qualidade. '
  'Populado por discover.py --exportar-candidatas. Usado pelo painel /selecao.';

-- ---------------------------------------------------------------------------
-- Seleção do usuário via UI do dashboard
-- Lida pelo pipeline.py para determinar quais estações processar.
-- ---------------------------------------------------------------------------
create table if not exists config_estacoes (
  codigo        text primary key,
  nome          text not null default '',
  lat           numeric(9,6),
  lon           numeric(9,6),
  altitude      numeric,
  is_referencia boolean default false,
  selecionado_em timestamptz default now(),
  atualizado_em  timestamptz default now()
);

comment on table config_estacoes is
  'Estações selecionadas pelo usuário via UI para análise. '
  'O pipeline.py lê esta tabela para saber quais estações processar. '
  'Apenas estações com lat e lon preenchidos são processadas.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table estacoes_candidatas enable row level security;
alter table config_estacoes     enable row level security;

create policy "leitura_publica_candidatas"
  on estacoes_candidatas for select using (true);

create policy "leitura_publica_config"
  on config_estacoes for select using (true);

-- Permite escrita via anon key (projeto acadêmico — dados não sensíveis)
create policy "escrita_config"
  on config_estacoes for all using (true) with check (true);
