# Arquitetura do Sistema

## Diagrama de fluxo

```
┌─────────────────────┐
│  ANA Hidroweb       │
│  (hidroweb.ana.gov) │
│  ZIPs por estação   │
└────────┬────────────┘
         │ download manual
         ▼
┌─────────────────────────────────────────────┐
│  pipeline/data/raw/*.zip                    │
│  (arquivos locais — não commitados)         │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Pipeline Python (local)                    │
│  ├── discover.py    (avaliação de qualidade)│
│  ├── parser.py      (leitura dos ZIPs)      │
│  ├── series_builder (mensal/anual/max)      │
│  ├── gap_filling    (regressão + IDW)       │
│  ├── stats.py       (histogramas + descrit.)│
│  └── supabase_loader (upload em batches)   │
└────────┬────────────────────────────────────┘
         │ upsert (service_role key)
         ▼
┌─────────────────────────────────────────────┐
│  Supabase (PostgreSQL gerenciado)           │
│  ├── estacoes                               │
│  ├── precipitacao_diaria                    │
│  ├── precipitacao_mensal                    │
│  ├── precipitacao_anual                     │
│  ├── max_diaria_anual                       │
│  ├── histogramas  (JSONB)                   │
│  └── preenchimento_resultado                │
│                                             │
│  Views: resumo_estacoes, serie_mensal_...   │
│  RLS: leitura pública (sem autenticação)    │
└────────┬────────────────────────────────────┘
         │ anon key (somente leitura)
         ▼
┌─────────────────────────────────────────────┐
│  Frontend Next.js 14 (Vercel)               │
│  ├── /           Dashboard + KPIs + Mapa    │
│  ├── /estacoes   Tabela comparativa         │
│  ├── /series/[codigo]                       │
│  │   └── Tabs: Diária/Mensal/Anual/Max      │
│  │       Série temporal + Histograma + Stats│
│  └── /preenchimento                         │
│      └── Regressão vs IDW, equação, RMSE    │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Usuário (professora / avaliação)           │
│  Acessa via URL pública (Vercel)            │
└─────────────────────────────────────────────┘
```

## Decisões técnicas

### Por que Supabase?
- PostgreSQL gerenciado sem custo para projetos acadêmicos
- Row Level Security nativa (leitura pública sem expor service key)
- Client JavaScript pequeno, sem GraphQL overhead
- JSONB para histogramas evita uma tabela extra por bin

### Por que Next.js 14 App Router?
- SSR para SEO irrelevante aqui, mas App Router é padrão moderno
- Todos os componentes com dados são `"use client"` (queries direto ao Supabase)
- Facilita deploy no Vercel com zero configuração

### Por que react-leaflet + OpenStreetMap?
- Gratuito, sem chave de API
- Leaflet é a biblioteca de mapas mais robusta para React
- SSR desabilitado via `dynamic()` do Next.js (Leaflet exige `window`)

### Por que LTTB downsampling?
- A série diária pode ter 20.000+ pontos
- Recharts renderiza todos os pontos no DOM — causa lag perceptível
- LTTB (Largest Triangle Three Buckets) preserva a forma visual
  reduzindo para ~1500 pontos sem perda visual significativa

### Segurança
- `service_role key` apenas no pipeline local (nunca no frontend)
- `anon key` no frontend é segura pois RLS bloqueia escrita
- `.env` e `data/raw/` no `.gitignore`
