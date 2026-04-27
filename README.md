# HID-41 — Análise Pluviométrica: Bacia do Paraíba do Sul

> **Trabalho da disciplina HID-41: Hidrologia e Drenagem**  
> ITA — Instituto Tecnológico de Aeronáutica · 2025  
> Professora: Danielle de Almeida Bressiani

**Grupo:** Henri Leonardo dos Santos Lima · Pedro Feitosa Gutemberg · Gustavo Vidal Feitosa

---

## O que é este projeto

Análise completa de séries históricas de precipitação de estações pluviométricas
da ANA localizadas na bacia de cabeceira do **Paraíba do Sul (URGHI 2 — SP)**,
publicada como aplicação web interativa.

**Funcionalidades:**
- Visualização de séries temporais diária, mensal, anual e de máxima diária anual
- Histogramas de frequência com estatísticas descritivas completas
- Comparação dos métodos de preenchimento de falhas: **regressão múltipla** vs **IDW**
- Mapa interativo com as estações pluviométricas
- Interface acadêmica pública — sem necessidade de login

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Pipeline de dados | Python 3.11 + Pandas + scikit-learn |
| Banco de dados | Supabase (PostgreSQL) |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · Recharts |
| Mapa | react-leaflet + OpenStreetMap |
| Deploy | Vercel (frontend) · Supabase (banco) |

---

## Estrutura do repositório

```
projeto-paraiba-sul/
├── pipeline/               # ETL Python — roda localmente uma vez
│   ├── data/raw/           # ZIPs da ANA (não commitados)
│   ├── src/                # Módulos de parsing, estatísticas, carga
│   ├── pipeline.py         # Orquestrador principal
│   ├── discover.py         # Avalia qualidade de todas as estações
│   └── README.md           # Instruções detalhadas do pipeline
├── frontend/               # Aplicação Next.js
│   ├── app/                # Páginas (App Router)
│   ├── components/         # Componentes reutilizáveis + charts
│   ├── hooks/              # Hooks de acesso ao Supabase
│   └── lib/                # Tipos TypeScript + cliente Supabase
├── supabase/
│   └── migrations/001_initial.sql
├── docs/
│   ├── ARCHITECTURE.md     # Diagrama de fluxo + decisões técnicas
│   └── METHODOLOGY.md      # Equações e critérios hidrológicos
└── README.md               # Este arquivo
```

---

## Como rodar localmente

### Pipeline Python

```bash
cd pipeline
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env                            # preencha com credenciais Supabase

# 1. Baixe ZIPs do Hidroweb → coloque em data/raw/
# 2. Avalie as estações disponíveis
python discover.py

# 3. Preencha config.yaml com os 3 códigos escolhidos
# 4. Rode o pipeline completo
python pipeline.py
```

Ver [pipeline/README.md](pipeline/README.md) para instruções detalhadas.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local    # preencha com ANON key do Supabase
npm run dev
```

Acesse `http://localhost:3000`.

---

## Deploy

1. **Supabase:** criar projeto, executar `supabase/migrations/001_initial.sql`, rodar pipeline
2. **Vercel:** importar repositório, definir Root Directory como `frontend`,
   adicionar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Metodologia resumida

- Dados: ANA Hidroweb — séries diárias de precipitação pluviométrica (CSV latin-1, `;`)
- Prioridade de consistência: nível 2 (consistido) > nível 1 (bruto)
- Meses com > 5% de falhas → inválidos nas agregações
- Preenchimento: regressão linear múltipla e IDW, com holdout de 10% (seed=42)
- Método vencedor: menor RMSE no holdout

Ver [docs/METHODOLOGY.md](docs/METHODOLOGY.md) para equações completas.

---

## Dados

Precipitação pluviométrica — ANA Hidroweb  
Mapa base — OpenStreetMap contributors  
Bacia: Paraíba do Sul · URGHI 2 · Estado de São Paulo
