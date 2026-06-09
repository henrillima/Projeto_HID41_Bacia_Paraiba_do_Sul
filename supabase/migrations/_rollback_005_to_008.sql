-- =============================================================================
-- ⚠️  ROLLBACK das migrations 005, 006, 007 e 008 (Projeto 2 — Fases 1–4)
-- =============================================================================
-- USE SOMENTE NO PROJETO SUPABASE ONDE FORAM APLICADAS POR ENGANO.
-- Este script remove TODAS as tabelas, views e policies criadas pelo Projeto 2.
-- As tabelas do Projeto 1 (`estacoes`, `precipitacao_*`, `histogramas`, etc.,
-- definidas em 001–004) NÃO são afetadas.
--
-- Como aplicar:
--   1. Abra o projeto Supabase ERRADO → SQL Editor.
--   2. Cole TODO este arquivo e execute.
--   3. Verifique em Table Editor que as tabelas listadas abaixo sumiram.
-- =============================================================================

-- DROP em ordem reversa de criação (CASCADE também remove índices, policies e
-- foreign keys dependentes, mas mantemos a ordem por clareza).

-- ---------- Migration 008 (Frequência de cheias, IDF, chuva de projeto) -----
drop table if exists chuva_projeto         cascade;
drop table if exists idf_curva             cascade;
drop table if exists idf_parametros        cascade;
drop table if exists frequencia_quantis    cascade;
drop table if exists frequencia_ajuste     cascade;
drop table if exists max_anual_vazao       cascade;

-- ---------- Migration 007 (Eventos & Hidrogramas Unitários) -----------------
drop table if exists comparacao_uh                  cascade;
drop table if exists hidrograma_unitario_scs        cascade;
drop table if exists hidrograma_unitario_observado  cascade;
drop table if exists eventos_chuva_vazao            cascade;

-- ---------- Migration 006 (Regime: permanência + Eckhardt + Q7,10) ----------
drop table if exists q7_10_ajuste         cascade;
drop table if exists q7_minimos_anuais    cascade;
drop table if exists eckhardt_params      cascade;
drop table if exists eckhardt_serie       cascade;
drop table if exists quantis_permanencia  cascade;
drop table if exists curva_permanencia    cascade;

-- ---------- Migration 005 (Fluviometria + Curva-chave) ----------------------
drop view  if exists curva_chave_vigente        cascade;
drop view  if exists resumo_exutorio            cascade;

drop table if exists config_estacoes_fluvio      cascade;
drop table if exists estacoes_candidatas_fluvio  cascade;
drop table if exists curva_chave_ajuste          cascade;
drop table if exists curva_chave_medicoes        cascade;
drop table if exists fluviometria_anual          cascade;
drop table if exists fluviometria_mensal         cascade;
drop table if exists fluviometria_diaria         cascade;
drop table if exists estacoes_fluvio             cascade;

-- =============================================================================
-- Verificação: a query abaixo deve retornar 0 linhas após o rollback.
-- =============================================================================
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'estacoes_fluvio', 'fluviometria_diaria', 'fluviometria_mensal',
--     'fluviometria_anual', 'curva_chave_medicoes', 'curva_chave_ajuste',
--     'estacoes_candidatas_fluvio', 'config_estacoes_fluvio',
--     'curva_permanencia', 'quantis_permanencia', 'eckhardt_serie',
--     'eckhardt_params', 'q7_minimos_anuais', 'q7_10_ajuste',
--     'eventos_chuva_vazao', 'hidrograma_unitario_observado',
--     'hidrograma_unitario_scs', 'comparacao_uh',
--     'max_anual_vazao', 'frequencia_ajuste', 'frequencia_quantis',
--     'idf_parametros', 'idf_curva', 'chuva_projeto'
--   );
