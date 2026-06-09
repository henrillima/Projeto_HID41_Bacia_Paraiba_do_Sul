# Projeto 2 — Guia de Execução

Resumo prático do que precisa ser feito para rodar as Fases 1–4 do Projeto 2
end-to-end. Para o detalhamento metodológico, ver
[`METHODOLOGY.md`](METHODOLOGY.md) e o documento de referência da disciplina,
[`HID41_Projeto2_Metodologia.md`](../HID41_Projeto2_Metodologia.md).

---

## 1. Aplicar as novas migrations no Supabase

Acesse **Supabase → SQL Editor** e cole, **um arquivo de cada vez**, o
conteúdo de:

| Arquivo                                        | O que cria                                                                 |
|------------------------------------------------|---------------------------------------------------------------------------|
| [`005_fluviometria.sql`](../supabase/migrations/005_fluviometria.sql) | `estacoes_fluvio`, `fluviometria_{diaria,mensal,anual}`, `curva_chave_*`, `estacoes_candidatas_fluvio`, `config_estacoes_fluvio`, views, RLS. |
| [`006_regime.sql`](../supabase/migrations/006_regime.sql)             | `curva_permanencia`, `quantis_permanencia`, `eckhardt_serie/params`, `q7_minimos_anuais`, `q7_10_ajuste`, RLS. |
| [`007_eventos.sql`](../supabase/migrations/007_eventos.sql)           | `eventos_chuva_vazao`, `hidrograma_unitario_observado`, `hidrograma_unitario_scs`, `comparacao_uh`, RLS. |
| [`008_frequencia.sql`](../supabase/migrations/008_frequencia.sql)     | `max_anual_vazao`, `frequencia_ajuste/quantis`, `idf_parametros/curva`, `chuva_projeto`, RLS. |

**Ordem importa** — 005 antes de 006, etc.

---

## 2. Credenciais (.env)

Já está pronto em [`pipeline/.env`](../pipeline/.env) com:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
ANA_API_BASE_URL=https://www.ana.gov.br/hidrowebservice
ANA_API_USER=<seu CPF>
ANA_API_PASS=<senha recebida por e-mail>
```

> Token Bearer da ANA tem TTL de 60 min — o cliente cacheia em
> `pipeline/.cache/hidroweb_token.json` (gitignored) e renova automaticamente.

---

## 3. Pipeline pluviométrico (re-execução via API REST)

```bash
cd pipeline
.venv/Scripts/python.exe pipeline.py             # via REST (default)
.venv/Scripts/python.exe pipeline.py --via local # fallback ZIPs em data/raw/
```

Migrou a ingestão dos ZIPs estáticos para chamadas REST diretas (resolve
o problema de dados "congelados").

---

## 4. Pipeline fluviométrico — Projeto 2 (Fases 1–4)

### 4.1 Descobrir e escolher o exutório

```bash
.venv/Scripts/python.exe download_fluvio.py discover --top 10
```

Top-1 esperado para a bacia de estudo:
**58183000 — PINDAMONHANGABA** (A ≈ 9.600 km², 98 anos de dados,
0,1 km do pluviômetro de referência).

Opção A — confiar no top-1 do CSV:
```bash
.venv/Scripts/python.exe pipeline_fluvio.py
```

Opção B — escolher manualmente pelo front:
- Abra `/selecao-fluvio` no Vercel/local
- Clique em "Marcar como exutório" na linha desejada
- O pipeline lerá `config_estacoes_fluvio.is_outlet=true`

Opção C — passar código direto:
```bash
.venv/Scripts/python.exe pipeline_fluvio.py --codigos 58183000
```

### 4.2 Configurar parâmetros físicos da bacia (necessário para Fase 3)

Edite [`pipeline/config.yaml`](../pipeline/config.yaml), bloco `bacia:`:

```yaml
bacia:
  area_km2: 9600                  # área de drenagem do exutório (km²)
  comprimento_talvegue_km: 250    # L — extrair de SRTM no QGIS
  delta_h_m: 1200                 # Δh — extrair de SRTM no QGIS
  declividade_media: null         # se null, calcula automaticamente de Δh/L
  cn_amc2: 75                     # CN AMC-II — depende de uso e solo
  tc_metodo: watt_chow            # para A > 5000 km² use watt_chow
```

Se `area_km2` ficar `null`, a Fase 3 (HUs) é pulada com aviso. Outras
fases não dependem disso.

### 4.3 Rodar o pipeline completo

```bash
.venv/Scripts/python.exe pipeline_fluvio.py
```

Ele executa, na ordem:

1. **Fase 1** — baixa séries Q, cota, medições e curva oficial via REST;
   ajusta curva-chave Q = a·(h − h₀)^b; preenche dias com cota mas sem Q.
2. **Fase 2** — curva de permanência completa + Q5–Q99; filtro de Eckhardt
   com α estimado por recessões; Q7,10 por Log-Pearson III.
3. **Fase 3** — isola eventos chuva-vazão; HU observado por evento + médio;
   HU SCS triangular; comparação NSE.
4. **Fase 4** — máximas anuais; ajusta 5 distribuições; seleciona pela AIC+KS;
   quantis Q(TR) com IC 90 % bootstrap; popula curva IDF regional; gera
   chuva de projeto TR 10 e TR 100.

Cada estação leva alguns minutos. Logs detalhados em stdout.

---

## 5. Frontend — onde olhar cada análise

| Página                                              | O que mostra                                                                         |
|-----------------------------------------------------|--------------------------------------------------------------------------------------|
| [`/selecao-fluvio`](http://localhost:3000/selecao-fluvio) | Ranking de candidatas a exutório; botão "Marcar como exutório".                       |
| [`/fluviometria`](http://localhost:3000/fluviometria)     | Séries diária/mensal/anual de Q (Fase 1); KPIs e curva-chave ajustada.                |
| [`/regime`](http://localhost:3000/regime)                 | Curva de permanência (Q90/Q50/Q10), separação de escoamento (Eckhardt), Q7,10 (LP3). |
| [`/eventos`](http://localhost:3000/eventos)               | Lista de eventos isolados; hietograma+hidrograma de cada um; HU médio × SCS.         |
| [`/extremos`](http://localhost:3000/extremos)             | 4 abas: ajustes (AIC/KS), vazões de projeto (Q por TR), IDF, chuva de projeto.        |
| [`/transparencia`](http://localhost:3000/transparencia)   | Metodologia completa + glossário (Seções 1–10).                                       |

---

## 6. Verificações rápidas

```bash
# Imports Python OK?
cd pipeline
.venv/Scripts/python.exe -c "import pipeline_fluvio; print('OK')"

# Build TypeScript OK?
cd ../frontend
npm run type-check

# Dev server local
npm run dev   # → http://localhost:3000
```

---

## 7. Decisões de default a confirmar antes de fechar o relatório

| Etapa            | Default atual                                       | Alternativas / o que confirmar                                            |
|------------------|-----------------------------------------------------|--------------------------------------------------------------------------|
| Eckhardt BFI_max | 0.80 (aquífero poroso)                              | 0.50 fraturado, 0.25 efêmero — confirmar com IPT/CPRM para PdS cabeceira |
| Q7,10            | Log-Pearson III (padrão ANA)                        | Weibull mínima, Gumbel mínima                                            |
| tc (Fase 3)      | Watt&Chow (A ≈ 9600 km²)                            | Kirpich, SCS lag — comparar resultados                                   |
| φ-index vs SCS-CN| φ-index na conversão evento → chuva efetiva         | SCS-CN exige `cn_amc2` confirmado                                        |
| PDF de cheias    | AIC + filtro KS (p ≥ 0.05)                          | BIC primário ou KS primário                                              |
| IDF regional     | Pfafstetter / DNOS SJC (a/b/c/d **placeholder**)    | **Confirmar com fonte oficial** (CETESB, IDF-BR, IDFGEO)                 |
| Chuva projeto    | Blocos alternados, padrão intermediário, 360 min    | Padrão adiantado/atrasado, duração ≠                                     |

Todos esses defaults estão em [`config.yaml`](../pipeline/config.yaml) e
podem ser alterados sem mexer no código.
