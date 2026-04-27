-- =============================================================================
-- HID-41: Migration 002 — Registro de estações sem dados
-- Executar no SQL Editor do Supabase após a 001_initial.sql.
-- =============================================================================

create table if not exists estacoes_sem_dados (
  codigo         text primary key,
  nome_arquivo   text not null,
  motivo         text not null default 'ZIP sem arquivos internos — estação sem dados disponíveis na ANA',
  registrado_em  timestamptz default now()
);

comment on table estacoes_sem_dados is
  'Estações cujos ZIPs baixados da ANA estavam vazios. '
  'Documentadas para transparência metodológica — a ausência de dados é da fonte, não do processamento.';

alter table estacoes_sem_dados enable row level security;

create policy "leitura_publica_sem_dados"
  on estacoes_sem_dados for select using (true);
