# Runbook de deploy do BI — Projeto HID-41

Passo a passo para colocar o dashboard (BI) no ar com os dados da bacia
**58142200 — Buquirinha II** (Rio Buquira). Siga **na ordem**.

Visão geral do fluxo:

```
Supabase (migrations)  →  .env  →  pipeline.py  →  pipeline_fluvio.py  →  Vercel (frontend)
   estrutura do banco     creds    pluviometria     fluviometria+Fases     BI no ar
```

---

## 1. Supabase — criar/preparar o banco

1. Acesse o projeto no **Supabase** → menu **SQL Editor**.
2. Cole e execute, **um arquivo de cada vez e nesta ordem**, o conteúdo de
   `supabase/migrations/`:
   - `001_initial.sql` (se ainda não aplicou)
   - `005_fluviometria.sql`
   - `006_regime.sql`
   - `007_eventos.sql`
   - `008_frequencia.sql`
   > A ordem importa (005 antes de 006, etc.). Sem essas tabelas, o pipeline
   > falha e as páginas de fluviometria/regime/eventos/extremos ficam vazias.
3. Em **Project Settings → API**, anote:
   - **Project URL** (`SUPABASE_URL`)
   - **service_role key** (`SUPABASE_SERVICE_KEY`) — secreta, só para o pipeline
   - **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — pública, para o frontend

---

## 2. Credenciais do pipeline — `pipeline/.env`

Crie/edite `pipeline/.env` com:

```
SUPABASE_URL=...                  # Project URL
SUPABASE_SERVICE_KEY=...          # service_role key
ANA_API_BASE_URL=https://www.ana.gov.br/hidrowebservice
ANA_API_USER=<seu CPF>            # cadastro HidroWebService da ANA
ANA_API_PASS=<senha recebida por e-mail>
```

---

## 3. Rodar o pipeline (preenche o Supabase)

No **Windows**, dentro de `pipeline/`:

```bat
cd pipeline
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Agora rode **nesta ordem** (a Fase 3 precisa da chuva, então pluviometria primeiro):

```bat
:: 1) Pluviometria -> preenche precipitacao_diaria
python pipeline.py

:: 2) Fluviometria -> usa a 58142200 (config.yaml) e roda Fases 1-4
python pipeline_fluvio.py
```

- O `pipeline_fluvio.py` já está fixado na estação **58142200** (via
  `config.yaml → fluviometria.exutorio_codigo`), e os parâmetros da bacia
  (A, L, Δh, CN) já estão preenchidos, então a **Fase 3 roda** sem pular.
- Cada estação leva alguns minutos; acompanhe os logs no terminal.

### Verificações rápidas
```bat
.venv\Scripts\python.exe -c "import pipeline_fluvio; print('imports OK')"
```

---

## 4. Higiene de dados (importante)

Se em algum teste anterior você rodou o pipeline com **Pindamonhangaba
(58183000)**, aquele dado **continua no Supabase** e apareceria no BI junto com a
Buquirinha. Para remover, no **SQL Editor** do Supabase:

```sql
delete from fluviometria_diaria   where estacao_codigo = '58183000';
delete from fluviometria_mensal   where estacao_codigo = '58183000';
delete from fluviometria_anual    where estacao_codigo = '58183000';
delete from estacoes_fluvio       where codigo         = '58183000';
-- repita para as demais tabelas de regime/eventos/extremos se necessário
```
> Se você nunca rodou com 58183000, pode pular este passo.

---

## 5. Frontend — build local e deploy na Vercel

### 5.1 Testar local
```bat
cd frontend
copy .env.local.example .env.local   :: edite com URL + anon key do Supabase
npm install
npm run build                        :: gate final: tem que passar sem erro
npm run dev                          :: abre http://localhost:3000 p/ conferir
```
Confira se as páginas `/fluviometria`, `/regime`, `/eventos`, `/extremos` e
`/transparencia` carregam **com os dados da Buquirinha II**.

### 5.2 Deploy
1. Suba o repositório para o GitHub (se ainda não estiver).
2. Na **Vercel**: **New Project → importar o repositório**.
3. Em **Root Directory**, selecione **`frontend`**.
4. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**. A Vercel builda e publica a URL pública do BI.

---

## 6. Checklist final antes de apresentar

- [ ] Migrations 001 + 005–008 aplicadas no Supabase.
- [ ] `pipeline.py` e `pipeline_fluvio.py` rodaram sem erro.
- [ ] Páginas do BI mostram a **Buquirinha II (58142200)** e têm dados.
- [ ] Sem dados antigos da Pindamonhangaba sobrando.
- [ ] `npm run build` passou.
- [ ] Deploy na Vercel concluído e URL abre.

---

### Observações herdadas da revisão (não bloqueiam o deploy)
- A chuva da bacia (Fase 3) usa os 3 pluviômetros do Projeto 1, que cobrem a
  cabeceira do Paraíba de forma só aproximada para a bacia pequena do Buquira —
  citar como limitação. Ver `docs/REVISAO_METODOLOGICA.md` (M2).
- Parâmetros da bacia e medição do L: `docs/DADOS_BACIA_BUQUIRA.md`.
