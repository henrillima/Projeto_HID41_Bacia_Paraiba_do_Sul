create table if not exists preenchimento_diario (
  id          bigint generated always as identity primary key,
  estacao_codigo text not null references estacoes(codigo) on delete cascade,
  data        date not null,
  valor_regressao double precision,
  valor_idw   double precision,
  unique(estacao_codigo, data)
);

create index if not exists idx_preenchimento_diario_est_data
  on preenchimento_diario(estacao_codigo, data);

alter table preenchimento_diario enable row level security;
create policy "public read" on preenchimento_diario for select using (true);
