# Documentação Técnica — HID-41: Análise Pluviométrica da Bacia do Paraíba do Sul

**Disciplina:** HID-41 — Hidrologia e Drenagem  
**Instituição:** ITA — Instituto Tecnológico de Aeronáutica  
**Grupo:** Henri Leonardo dos Santos Lima · Pedro Feitosa Gutemberg · Gustavo Vidal Feitosa  
**Bacia:** Paraíba do Sul (cabeceira — URGHI 2, SP)  
**Fonte de dados:** ANA HidroWeb — séries históricas diárias de precipitação

---

## Sumário

1. [Contexto e Objetivo](#1-contexto-e-objetivo)
2. [Estações Pluviométricas Selecionadas](#2-estações-pluviométricas-selecionadas)
3. [Aquisição e Formato dos Dados Brutos](#3-aquisição-e-formato-dos-dados-brutos)
4. [Parsing e Pré-processamento dos Dados](#4-parsing-e-pré-processamento-dos-dados)
5. [Construção da Série Diária](#5-construção-da-série-diária)
6. [Construção da Série Mensal](#6-construção-da-série-mensal)
7. [Construção da Série Anual](#7-construção-da-série-anual)
8. [Precipitação Máxima Diária Anual](#8-precipitação-máxima-diária-anual)
9. [Diagnóstico de Falhas](#9-diagnóstico-de-falhas)
10. [Preenchimento de Falhas — Visão Geral](#10-preenchimento-de-falhas--visão-geral)
11. [Preenchimento por Regressão Linear Múltipla](#11-preenchimento-por-regressão-linear-múltipla)
12. [Preenchimento por IDW](#12-preenchimento-por-idw-inverse-distance-weighting)
13. [Comparação e Seleção do Método Vencedor](#13-comparação-e-seleção-do-método-vencedor)
14. [Histogramas de Frequência](#14-histogramas-de-frequência)
15. [Estatísticas Descritivas](#15-estatísticas-descritivas)
16. [Verificação dos Requisitos do Trabalho](#16-verificação-dos-requisitos-do-trabalho)
17. [Arquitetura do Sistema](#17-arquitetura-do-sistema)
18. [Parâmetros de Configuração do Pipeline](#18-parâmetros-de-configuração-do-pipeline)

---

## 1. Contexto e Objetivo

Este trabalho insere-se na disciplina HID-41 (Hidrologia e Drenagem) do ITA e tem por objetivo realizar a análise estatística e temporal de séries históricas de precipitação pluviométrica de estações localizadas na bacia do rio Paraíba do Sul, porção da Unidade de Gerenciamento de Recursos Hídricos n.º 2 (URGHI 2) no estado de São Paulo.

A análise engloba:

- Obtenção e leitura de dados brutos no formato disponibilizado pela Agência Nacional de Águas (ANA) via portal HidroWeb;
- Construção das séries diária, mensal, anual e de precipitação máxima diária anual;
- Identificação e preenchimento de falhas por dois métodos distintos (regressão linear múltipla e IDW), com validação cruzada para seleção do método mais acurado;
- Análise estatística descritiva (média, mediana, desvio padrão, assimetria, curtose, percentis) e elaboração de histogramas de frequência para todas as escalas temporais;
- Disponibilização dos resultados em dashboard interativo (Next.js + Supabase).

---

## 2. Estações Pluviométricas Selecionadas

### 2.1 Critério de Seleção

A seleção foi guiada pela maximização do período de registro. O script `discover.py` realizou o inventário de qualidade de todas as estações da bacia disponíveis no HidroWeb, classificando-as por número de anos com dados válidos (anos com percentual de falhas ≤ 5%). Foram selecionadas as três estações com maior período de dados úteis e distribuição espacial adequada para o preenchimento de falhas via IDW.

### 2.2 Estações Selecionadas

| Código   | Nome                   | Latitude (°)  | Longitude (°) | Altitude (m) | Papel        |
|----------|------------------------|---------------|---------------|--------------|--------------|
| 2245048  | PINDAMONHANGABA        | −22,9111      | −45,4694      | 524          | Referência   |
| 2245055  | ESTRADA DO CUNHA       | −22,9961      | −45,0433      | 790          | Auxiliar 1   |
| 2345065  | SÃO LUÍS DO PARAITINGA | −23,2392      | −45,3056      | 760          | Auxiliar 2   |

### 2.3 Justificativa

- **PINDAMONHANGABA (2245048)** foi eleita estação de referência por possuir o maior período contínuo de registros na região e menor percentual de falhas brutas. Está localizada no fundo de vale do Paraíba do Sul, a 524 m de altitude.
- **ESTRADA DO CUNHA (2245055)** situa-se a nordeste da referência, em altitude mais elevada (790 m), capturando a influência orográfica da Serra da Mantiqueira. Distância haversine até a referência: aproximada conforme calculado automaticamente pelo pipeline.
- **SÃO LUÍS DO PARAITINGA (2345065)** posiciona-se ao sul, próxima à Serra do Mar, a 760 m de altitude. A inclusão desta estação garante diversidade direcional para o método IDW.

A diversidade de altitude e posição relativa entre as três estações é favorável tanto à regressão múltipla (campos de precipitação correlacionados, mas não idênticos) quanto ao IDW (triângulo com área representativa da bacia).

---

## 3. Aquisição e Formato dos Dados Brutos

### 3.1 Fonte

Os dados foram baixados do portal **ANA HidroWeb** na forma de arquivos ZIP individuais por estação. Cada ZIP contém um único arquivo CSV com a série histórica completa de precipitação diária.

### 3.2 Formato do CSV

O formato segue o padrão exportado pela API SOAP/REST da ANA (bem como o download manual do portal), com as seguintes características:

| Propriedade         | Valor                          |
|---------------------|-------------------------------|
| Codificação         | Latin-1 (ISO-8859-1)          |
| Separador de campos | Ponto e vírgula (`;`)         |
| Separador decimal   | Vírgula (`,`)                 |
| Linhas de cabeçalho | 0 a 25 linhas de metadados    |
| Frequência          | Uma linha por mês             |
| Colunas de dias     | `Chuva01` a `Chuva31`         |

### 3.3 Estrutura das Colunas

As colunas relevantes são:

| Coluna             | Descrição                                                         |
|--------------------|-------------------------------------------------------------------|
| `EstacaoCodigo`    | Código ANA da estação (8 dígitos)                                 |
| `Data`             | Data do mês no formato `dd/mm/yyyy` (sempre dia 01)               |
| `NivelConsistencia`| 1 = dados brutos; 2 = dados consistidos (revisados)               |
| `Chuva01`–`Chuva31`| Precipitação (mm) de cada dia do mês; ausência = célula vazia     |

### 3.4 Níveis de Consistência

A ANA disponibiliza dois níveis de processamento para cada mês:

- **Nível 1 (bruto):** dados coletados diretamente do pluviômetro, sem revisão. Podem conter erros de transcrição, substituições inadequadas ou valores faltantes não sinalizados.
- **Nível 2 (consistido):** dados revisados pela ANA, com correção de erros grosseiros, preenchimento de pequenas lacunas e marcação explícita de ausências. Possuem maior confiabilidade.

**Critério adotado:** quando um mesmo mês aparece com ambos os níveis (o que é comum para o período mais recente, ainda em fase de consistência), o nível 2 é prioritariamente mantido. O nível 1 é usado apenas quando o nível 2 não está disponível para aquele mês.

---

## 4. Parsing e Pré-processamento dos Dados

### 4.1 Algoritmo de Leitura

O módulo `pipeline/src/parser.py` implementa a função `parse_ana_zip(zip_path)`, que executa os seguintes passos:

**Passo 1 — Abertura do ZIP:**
```
Abre o arquivo .zip
Localiza o único arquivo .csv interno (padrão regex: \.csv$)
Lê os bytes brutos e decodifica em latin-1
```

**Passo 2 — Localização do cabeçalho:**
O cabeçalho real das colunas está precedido de linhas de metadados (número de título, código, nome da estação, coordenadas etc.). O algoritmo escaneia as primeiras 25 linhas em busca de `"EstacaoCodigo"` ou `"Chuva01"`. A linha encontrada é o índice `header_idx`.

**Passo 3 — Leitura do CSV:**
```python
pd.read_csv(csv_str, sep=";", decimal=",", low_memory=False, dtype=str)
```
Todas as colunas são lidas como string para evitar conversões automáticas incorretas (por exemplo, "," sendo interpretada como separador de milhar).

**Passo 4 — Tratamento de duplicatas por consistência:**
```python
df_raw.sort_values("NivelConsistencia")
      .groupby(["EstacaoCodigo", "Data"], as_index=False)
      .last()
```
O `.last()` após ordenação crescente de `NivelConsistencia` retém o nível 2 quando presente, e o nível 1 caso contrário.

**Passo 5 — Transformação largo → longo (melt):**
As colunas `Chuva01` a `Chuva31` são desempilhadas em linhas individuais (uma por dia):
```
(EstacaoCodigo, Data, Chuva01, Chuva02, ..., Chuva31)
     ↓  melt
(EstacaoCodigo, Data, dia_col, valor_str)
```

**Passo 6 — Reconstrução das datas:**
O número do dia é extraído do nome da coluna (`Chuva07` → `7`). A data completa é então construída:
```python
pd.to_datetime({"year": ..., "month": ..., "day": ...}, errors="coerce")
```
O parâmetro `errors="coerce"` descarta automaticamente dias inválidos, como 30 de fevereiro, 31 de abril etc. Esses registros são removidos do DataFrame.

**Passo 7 — Conversão e limpeza dos valores:**
```python
df_long["valor"] = df_long["valor_str"]
    .str.strip()
    .str.replace(",", ".", regex=False)
    .pipe(pd.to_numeric, errors="coerce")
```
Valores não numéricos (células vazias, traços, texto) tornam-se `NaN`. Valores negativos espúrios (raros na base da ANA) são também convertidos para `NaN`:
```python
df_long.loc[df_long["valor"] < 0, "valor"] = np.nan
```

### 4.2 Saída do Parser

A função retorna uma tupla `(meta, df_daily)`:

- `meta`: dicionário com metadados extraídos do cabeçalho (`EstacaoCodigo`, `NomeEstacao`, `Latitude`, `Longitude`, `Altitude`). Nota: os ZIPs da ANA **não incluem coordenadas geográficas nas colunas de dados**; portanto, lat/lon foram obtidas manualmente no portal ANA e inseridas no arquivo `config.yaml`.

- `df_daily`: DataFrame com colunas:

| Coluna         | Tipo        | Descrição                                  |
|----------------|-------------|--------------------------------------------|
| `estacao_codigo` | str       | Código ANA                                 |
| `data`         | datetime64  | Data do dia (UTC-naive)                    |
| `valor`        | float64     | Precipitação em mm; `NaN` = ausência       |
| `consistencia` | int         | 1 = bruto; 2 = consistido                 |

---

## 5. Construção da Série Diária

### 5.1 Definição

A série diária é a base de todas as análises. Cada linha representa um dia calendário na série histórica da estação, com a precipitação total acumulada naquele dia (em mm).

### 5.2 Processamento Adicional no Pipeline

Após o parsing individual de cada estação, o pipeline monta um **pivot table** multivariado, com `data` como índice e cada código de estação como coluna:

```
df_pivot = pd.DataFrame({
    codigo: df.set_index("data")["valor"]
              .pipe(lambda s: s[~s.index.duplicated(keep="last")])
    for codigo, df in series_diarias.items()
})
```

O deduplicamento `~s.index.duplicated(keep="last")` garante que, se houver dois registros para a mesma data (inconsistência rara na base), o último (nível mais alto de consistência) prevalece.

O pivot abrange a **união** dos períodos de todas as estações: datas presentes em ao menos uma estação aparecem no pivot, com `NaN` nas demais. Isso é fundamental para o preenchimento cruzado.

### 5.3 Formato Final no Banco de Dados

A tabela `precipitacao_diaria` no Supabase/PostgreSQL armazena:

| Coluna         | Tipo    | Descrição                                        |
|----------------|---------|--------------------------------------------------|
| `estacao_codigo` | text  | Código ANA                                       |
| `data`         | date    | Data (YYYY-MM-DD)                                |
| `valor`        | float8  | Precipitação em mm (após preenchimento)          |
| `preenchido`   | bool    | `true` se o valor foi sinteticamente preenchido  |
| `metodo`       | text    | Método vencedor aplicado (`regressao` ou `idw`)  |
| `consistencia` | int4    | Nível de consistência original (1 ou 2)          |

---

## 6. Construção da Série Mensal

### 6.1 Agregação

O módulo `pipeline/src/series_builder.py` implementa `build_monthly(df_diario, max_falhas_pct)`.

Para cada par (estação, ano, mês), o total mensal é calculado como a soma de todos os valores diários não nulos:

```
P_mensal(ano, mês) = Σ P_diário(t)   para todo t ∈ mês, P_diário(t) ≠ NaN
```

Implementado com `sum(min_count=1)`, que retorna `NaN` quando não há nenhum valor válido (em vez de zero).

### 6.2 Critério de Validade

Um mês é marcado como **válido** (`valido = True`) se e somente se o percentual de dias sem dado não superar o limite configurável `max_falhas_pct` (padrão: **5%**).

A fórmula de percentual de falhas mensais é:

```
pct_falhas_mes = 100 × (n_dias_sem_dado) / n_dias_esperados
```

Onde:
- `n_dias_esperados` = número de dias no mês calendário (28, 29, 30 ou 31, usando `calendar.monthrange`)
- `n_dias_sem_dado` = dias com `valor = NaN` + dias completamente ausentes do DataFrame (linhas não existentes, não apenas NaN)

O segundo termo é crucial: um dia ausente do DataFrame (não registrado na base) também conta como falha — o dado simplesmente não está disponível, independentemente do motivo.

```python
dias_ausentes_do_df = max(0, dias_esperados - len(grp))
total_falhas = grp["valor"].isna().sum() + dias_ausentes_do_df
pct_falhas = 100.0 * total_falhas / dias_esperados
valido = bool(pct_falhas <= max_falhas_pct)
```

**Exemplo:** Em fevereiro de 1985 (28 dias), se 2 dias têm `NaN` e 1 dia não aparece no DataFrame → `total_falhas = 3` → `pct_falhas = 10,7%` → mês inválido.

### 6.3 Formato Final no Banco

| Coluna         | Tipo   | Descrição                                       |
|----------------|--------|-------------------------------------------------|
| `estacao_codigo` | text | Código ANA                                      |
| `ano`          | int4   | Ano                                             |
| `mes`          | int4   | Mês (1–12)                                      |
| `valor`        | float8 | Total mensal em mm (pode ser NULL se inválido)   |
| `valido`       | bool   | `false` se pct_falhas > 5%                      |
| `pct_falhas`   | float8 | Percentual de dias sem dado naquele mês          |

---

## 7. Construção da Série Anual

### 7.1 Agregação

Implementada em `build_annual(df_mensal, max_falhas_pct)`. O total anual é calculado como a soma dos totais mensais **válidos**:

```
P_anual(ano) = Σ P_mensal(ano, mês)   para todo mês com valido = True
```

### 7.2 Critério de Validade Anual

Um ano é considerado **válido** se e somente se **todos os 12 meses** estão presentes na série mensal **e** todos são válidos (`valido = True`):

```python
valido = bool(meses_validos == 12 and meses_faltantes == 0)
```

- Se qualquer mês tiver `pct_falhas > 5%` → ano inválido.
- Se um mês inteiro não tiver registros no DataFrame → mês faltante → ano inválido.

Isso garante que totais anuais representem anos hidrológicos completos, sem subestimação por omissão de meses chuvosos.

### 7.3 Percentual de Falhas Anual

O percentual de falhas anual é calculado como a média ponderada das falhas mensais, tratando meses completamente faltantes como 100% de falha:

```
pct_falhas_anual = (Σ pct_falhas_mes + n_meses_faltantes × 100) / 12
```

### 7.4 Formato Final no Banco

| Coluna         | Tipo   | Descrição                                       |
|----------------|--------|-------------------------------------------------|
| `estacao_codigo` | text | Código ANA                                      |
| `ano`          | int4   | Ano                                             |
| `valor`        | float8 | Total anual em mm (NULL se inválido)            |
| `valido`       | bool   | True somente se 12 meses válidos completos       |
| `pct_falhas`   | float8 | Percentual médio de dias sem dado no ano        |

---

## 8. Precipitação Máxima Diária Anual

### 8.1 Definição

A série de precipitação máxima diária anual (Pmax) representa, para cada ano, o valor máximo de precipitação registrado em um único dia:

```
Pmax(ano) = max{ P_diário(t) : t ∈ ano, P_diário(t) ≠ NaN }
```

Esta série é fundamental para estudos de eventos extremos, dimensionamento de obras de drenagem e análises de frequência de cheias.

### 8.2 Algoritmo

```python
def build_max_daily_annual(df_diario):
    for (codigo, ano), grp in df_diario.groupby(["estacao_codigo", "ano"]):
        grp_valid = grp.dropna(subset=["valor"])
        if grp_valid.empty:
            continue
        idx_max = grp_valid["valor"].idxmax()
        rows.append({
            "ano": ano,
            "valor": grp_valid.loc[idx_max, "valor"],
            "data_ocorrencia": grp_valid.loc[idx_max, "data"].date().isoformat()
        })
```

Além do valor máximo, a **data de ocorrência** é registrada, permitindo identificar os episódios extremos historicamente.

**Nota importante:** anos com todos os dias NaN são descartados (`grp_valid.empty`). Não é aplicado critério de validade por percentual de falhas — mesmo anos com muitas falhas entram nesta série, pois a Pmax representa o pior evento registrado, e excluí-la por falhas em outros dias seria conservador de maneira inadequada.

### 8.3 Formato Final no Banco

| Coluna           | Tipo   | Descrição                              |
|------------------|--------|----------------------------------------|
| `estacao_codigo` | text   | Código ANA                             |
| `ano`            | int4   | Ano                                    |
| `valor`          | float8 | Precipitação máxima diária do ano (mm) |
| `data_ocorrencia`| text   | Data do evento (YYYY-MM-DD)            |

---

## 9. Diagnóstico de Falhas

### 9.1 Definição de Falha

Uma **falha** é qualquer dia da série histórica para o qual não há registro válido de precipitação — seja porque o pluviômetro estava inoperante, porque o dado foi descartado na consistência, ou porque a estação ainda não estava em operação naquele período.

Na série diária, falhas são representadas como `NaN` (Not a Number) na coluna `valor`.

### 9.2 Métricas de Qualidade

Para cada estação, o pipeline calcula:

```
n_total       = total de dias na série histórica da estação
n_com_dado    = dias com valor ≠ NaN
pct_falhas_original = 100 × (n_total - n_com_dado) / n_total
```

Após o preenchimento, calcula-se o percentual de falhas residual:

```
n_nan_pos_preench = NaN restantes no pivot, restrito ao período original da estação
pct_falhas_pos_preenchimento = 100 × n_nan_pos_preench / n_total
```

**Nota metodológica:** o denominador usa `n_total` da série original da estação, não o tamanho do pivot (que abrange a união de todos os períodos). Isso evita percentuais negativos que surgiriam se o pivot incluísse datas anteriores ao início da estação.

### 9.3 Estação de Referência

A estação de referência (PINDAMONHANGABA, 2245048) é a que recebe atenção prioritária no preenchimento, pois é sobre ela que o relatório foca a análise de séries e histogramas. O preenchimento, no entanto, é **aplicado a todas as três estações** para que o pivot fique o mais completo possível.

---

## 10. Preenchimento de Falhas — Visão Geral

### 10.1 Motivação

Séries históricas de precipitação raramente são contínuas. Falhas comprometem a estimativa de totais mensais e anuais, enviesam estatísticas descritivas e reduzem o número de anos válidos na série anual. O preenchimento (gap-filling) busca estimar valores plausíveis para os dias sem observação, utilizando informações de estações vizinhas.

### 10.2 Dois Métodos Implementados

| Método                       | Tipo                  | Requer coordenadas? |
|------------------------------|-----------------------|---------------------|
| Regressão Linear Múltipla    | Paramétrico / global  | Não                 |
| IDW (Inv. Distance Weighting)| Não-paramétrico / local| Sim                |

### 10.3 Estratégia de Validação Holdout

Para comparação justa entre os métodos, ambos são avaliados sobre o **mesmo conjunto de validação** (holdout):

1. Identifica-se o **período comum** — dias em que as três estações têm dado simultaneamente.
2. Do período comum, reservam-se aleatoriamente **10%** dos dias como holdout (semente fixa: `random_state = 42`, garantindo reprodutibilidade).
3. Os 90% restantes compõem o conjunto de treino.
4. Ambos os métodos são treinados/calibrados no conjunto de treino e avaliados no holdout via RMSE.
5. O método com **menor RMSE no holdout** é declarado vencedor e aplicado à série real.

A métrica RMSE é:

```
RMSE = √( (1/N) × Σᵢ (P̂ᵢ - Pᵢ)² )
```

Onde `P̂ᵢ` é o valor estimado e `Pᵢ` é o valor observado no holdout.

---

## 11. Preenchimento por Regressão Linear Múltipla

### 11.1 Formulação Matemática

O modelo de regressão linear múltipla estima a precipitação na estação de referência (`ref`) a partir das precipitações simultâneas nas estações auxiliares (`aux₁`, `aux₂`):

```
P_ref(t) = β₁ · P_aux₁(t) + β₂ · P_aux₂(t) + β₀ + ε(t)
```

Onde:
- `β₁`, `β₂` — coeficientes de regressão (slopes)
- `β₀` — intercepto
- `ε(t)` — resíduo (erro)

Os coeficientes são estimados pelo **método dos mínimos quadrados ordinários (OLS)**, que minimiza a soma dos quadrados dos resíduos:

```
min_{β} Σₜ [ P_ref(t) - (β₁ P_aux₁(t) + β₂ P_aux₂(t) + β₀) ]²
```

A solução analítica em notação matricial é:

```
β̂ = (XᵀX)⁻¹ Xᵀ y
```

Onde `X` é a matriz de preditores (com coluna de 1s para o intercepto) e `y` é o vetor de precipitações da referência.

Implementado via `sklearn.linear_model.LinearRegression(fit_intercept=True)`.

### 11.2 Período Comum e Seleção dos Dados de Treino

O período comum é definido como os dias em que **todas** as estações (referência + auxiliares) têm dado simultaneamente:

```python
df_comum = df_pivot[[estacao_ref] + estacoes_aux].dropna()
```

Requer no mínimo 20 dias comuns (verificação de robustez). O conjunto de treino contém 90% do período comum, sorteado aleatoriamente com `random_state = 42`.

### 11.3 Métricas de Qualidade do Modelo

**R² (coeficiente de determinação) no conjunto de treino:**

```
R² = 1 - SS_res / SS_tot
   = 1 - Σ(P_ref - P̂_ref)² / Σ(P_ref - P̄_ref)²
```

Indica a fração da variância de `P_ref` explicada pelos preditores. Valores próximos de 1 indicam alta capacidade explicativa.

**RMSE no holdout:**

```
RMSE_holdout = √( (1/N_h) × Σ (P̂_ref(t) - P_ref(t))² )  para t ∈ holdout
```

O RMSE no holdout é a métrica de seleção de método (critério de decisão).

### 11.4 Equação Final

O pipeline gera automaticamente a equação em formato legível:

```
P_ref = β₁ × P_2245055 + β₂ × P_2345065 + β₀
```

Com os valores numéricos de `β₁`, `β₂` e `β₀` determinados pelo OLS sobre os dados de treino. Os coeficientes e o intercepto são armazenados no banco de dados (tabela `preenchimento_resultado`, campo `parametros`).

### 11.5 Aplicação para Preenchimento

A regressão é aplicada apenas nos dias em que:
- A estação de referência tem `NaN` (ausência);
- **Todas** as estações auxiliares têm dado disponível.

```python
dias_com_falha = df_pivot[df_pivot[ref].isna()].index
df_aux_disponivel = df_pivot.loc[dias_com_falha, estacoes_aux].dropna()
y_pred = model.predict(df_aux_disponivel.values)
y_pred = np.clip(y_pred, 0, None)   # Precipitação não pode ser negativa
```

A restrição de **não-negatividade** (`clip(0, None)`) é fisicamente motivada: precipitação negativa é impossível e pode surgir do modelo linear por extrapolação.

### 11.6 Limitação da Regressão

A regressão múltipla **exige** que todas as auxiliares tenham dado no dia de falha. Dias em que apenas uma auxiliar tem dado não são preenchidos por este método. O IDW, por sua natureza ponderada, acomoda preenchimentos parciais.

---

## 12. Preenchimento por IDW (Inverse Distance Weighting)

### 12.1 Formulação Matemática

O método IDW estima a precipitação na estação de referência como média ponderada das precipitações nas auxiliares, com pesos inversamente proporcionais à distância elevada ao expoente `p`:

```
          Σᵢ [ Pᵢ(t) / dᵢᵖ ]
P_ref(t) = ─────────────────────
              Σᵢ [ 1 / dᵢᵖ ]
```

Onde:
- `Pᵢ(t)` = precipitação na estação auxiliar `i` no dia `t`
- `dᵢ` = distância haversine entre a referência e a auxiliar `i` (em km)
- `p` = expoente (configurado como `p = 2`)
- A soma se estende apenas às auxiliares com dado disponível no dia `t`

**Expoente p = 2** é o valor clássico na literatura para interpolação espacial de precipitação. Valores maiores aumentam a influência das estações mais próximas; valores menores tornam os pesos mais uniformes.

### 12.2 Distância Haversine

A distância entre duas estações é calculada pela **fórmula haversine**, que leva em conta a curvatura da Terra:

```
a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlon/2)
c = 2 · arctan2(√a, √(1−a))
d = R · c        (R = 6371 km, raio médio da Terra)
```

Esta fórmula fornece a distância do **grande círculo** (geodésica) entre dois pontos em coordenadas geográficas decimais (graus), que é a distância mais adequada para interpolação espacial em escala regional.

Implementado via biblioteca `haversine` (Python):

```python
from haversine import haversine, Unit
d = haversine((lat_ref, lon_ref), (lat_aux, lon_aux), unit=Unit.KILOMETERS)
```

As distâncias entre as estações do projeto são calculadas automaticamente e armazenadas no banco de dados:

- PINDAMONHANGABA ↔ ESTRADA DO CUNHA: ~33 km
- PINDAMONHANGABA ↔ SÃO LUÍS DO PARAITINGA: ~38 km

(valores exatos conforme calculado pelo pipeline com as coordenadas fornecidas)

### 12.3 Comportamento com Auxiliares Parcialmente Disponíveis

Diferentemente da regressão, o IDW funciona com **ao menos uma auxiliar disponível**. Se uma das auxiliares tiver `NaN` no dia `t`, ela simplesmente é excluída da soma. A condição de aplicação é:

```python
for cod in estacoes_aux:
    v = row.get(cod)
    if pd.notna(v) and distancias_km[cod] > 0:
        w = 1.0 / (distancias_km[cod] ** p)
        numerador += w * v
        denominador += w

if denominador == 0:
    return np.nan    # Nenhuma auxiliar disponível → não preenche
return max(0.0, numerador / denominador)   # Restrição de não-negatividade
```

Isso torna o IDW mais "flexível" que a regressão, podendo preencher dias em que apenas uma auxiliar tem dado.

### 12.4 Validação Holdout

O IDW usa **exatamente o mesmo conjunto holdout** que a regressão (mesmo `random_state`, mesma fração de 10%). Isso garante que a comparação de RMSE é feita sobre os mesmos dias e é, portanto, estatisticamente justa.

```python
mask_holdout = _holdout_mask(df_comum, holdout_pct, random_state)
df_holdout = df_comum[mask_holdout]
y_true = df_holdout[estacao_ref].values
y_pred = df_holdout[estacoes_aux].apply(_idw_predict, axis=1).values
rmse_holdout = √( mean((y_true - y_pred)²) )
```

---

## 13. Comparação e Seleção do Método Vencedor

### 13.1 Critério de Seleção

O método vencedor é aquele com **menor RMSE no holdout**:

```python
if rmse_regressao <= rmse_idw:
    melhor = "regressao"
else:
    melhor = "idw"
```

Este critério é objetivo, baseado em dados de validação independentes (não vistos durante o treinamento), e é análogo à validação cruzada em aprendizado de máquina.

### 13.2 Aplicação do Vencedor

O método vencedor é aplicado à série real (todos os dias com falha da estação), e sua série preenchida substitui os NaN no pivot:

```python
df_pivot[codigo] = resultado_vencedor["serie_preenchida"]
mascara = resultado_vencedor["mascara_preenchidos"]
```

O campo `preenchido = True` e `metodo = "regressao"` ou `"idw"` ficam registrados em cada linha da tabela `precipitacao_diaria`, garantindo rastreabilidade completa.

### 13.3 Armazenamento Detalhado por Método

Para cada dia de falha, o pipeline armazena os valores de **ambos os métodos** na tabela `preenchimento_diario`:

| Coluna           | Descrição                                            |
|------------------|------------------------------------------------------|
| `estacao_codigo` | Código da estação                                    |
| `data`           | Data do dia de falha                                 |
| `valor_regressao`| Estimativa pelo método de regressão (mm)             |
| `valor_idw`      | Estimativa pelo método IDW (mm)                      |

Isso permite ao usuário visualizar, na aba **Tabela de Séries** do dashboard, a comparação direta entre os dois métodos dia a dia.

### 13.4 Resultados para as Estações do Projeto

Os resultados exatos (RMSE e método vencedor por estação) estão disponíveis no dashboard em `/preenchimento`. As métricas são computadas no pipeline e armazenadas na tabela `preenchimento_resultado`.

---

## 14. Histogramas de Frequência

### 14.1 Definição

Histogramas de frequência representam a distribuição empírica dos valores de precipitação, dividindo o intervalo de dados em classes (bins) e contando as observações em cada classe.

### 14.2 Algoritmo

Implementado em `pipeline/src/stats.py`, função `histograma(serie, n_bins=30)`:

```python
counts, bin_edges = np.histogram(valores, bins=n_bins)
bin_centers = [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(len(bin_edges) - 1)]
```

- **Número de classes:** `n_bins = 30` (configurável em `config.yaml`)
- **Método de binning:** `numpy.histogram` usa classes de largura igual (`uniform width`), com `bin_edges` igualmente espaçados entre `min(valores)` e `max(valores)`
- **Largura de cada classe:** `Δ = (max - min) / 30`

Os resultados armazenados são:
- `bins`: lista de 31 valores (bordas das 30 classes)
- `counts`: lista de 30 inteiros (frequência absoluta de cada classe)
- `bin_centers`: lista de 30 valores (centro de cada classe, para plotagem)

### 14.3 Séries Analisadas

Histogramas são calculados para **4 escalas temporais** por estação:

| Escala               | Série utilizada                              | Obs.                             |
|----------------------|----------------------------------------------|----------------------------------|
| Diária               | Todos os dias da série completa (com preench)| Inclui zeros (dias sem chuva)    |
| Mensal               | Meses válidos (`valido = True`)              | Exclui meses com excesso de falha|
| Anual                | Anos válidos (`valido = True`)               | Exclui anos incompletos          |
| Máx. Diária Anual    | Série de Pmax por ano                        | Todos os anos com ao menos 1 dia |

### 14.4 Visualização

No dashboard (`/series/{codigo}`), os histogramas são renderizados como gráfico de barras (Recharts) com:
- Eixo X: centro de cada classe (mm)
- Eixo Y: frequência absoluta (contagem)
- Linha de referência: média da série

---

## 15. Estatísticas Descritivas

### 15.1 Conjunto de Estatísticas Calculadas

Para cada série (diária, mensal, anual, Pmax), o pipeline calcula:

| Estatística       | Fórmula / Método                                         |
|-------------------|----------------------------------------------------------|
| **Média** (μ)     | `μ = (1/n) Σ xᵢ`                                        |
| **Mediana**       | Valor central após ordenação (P50)                       |
| **Desvio padrão** | `s = √[ (1/(n-1)) Σ (xᵢ - μ)² ]` (desvio amostral, ddof=1)|
| **Mínimo**        | `min(x)`                                                |
| **Máximo**        | `max(x)`                                                |
| **P25**           | Percentil 25 (1º quartil)                               |
| **P50**           | Percentil 50 (mediana)                                  |
| **P75**           | Percentil 75 (3º quartil)                               |
| **P90**           | Percentil 90                                            |
| **P95**           | Percentil 95                                            |
| **P99**           | Percentil 99                                            |
| **Coef. Variação**| `CV = s / μ` (adimensional; `None` se μ = 0)            |
| **Assimetria**    | Coeficiente de Fisher-Pearson (não-enviesado, `bias=False`) |
| **Curtose**       | Curtose em excesso (Pearson) = curtose - 3 (`bias=False`) |
| **n_observacoes** | Número de dias/meses/anos com dado                       |
| **n_falhas**      | Número de entradas com NaN                              |
| **pct_falhas**    | `100 × n_falhas / n_total`                              |

### 15.2 Assimetria

A assimetria de Fisher-Pearson (não-enviesada) é:

```
g₁ = [n / ((n-1)(n-2))] × Σ [(xᵢ - μ) / s]³
```

- `g₁ > 0`: distribuição assimétrica à direita (cauda longa para valores altos), típico de precipitação
- `g₁ = 0`: distribuição simétrica
- `g₁ < 0`: assimétrica à esquerda

Séries de precipitação diária tipicamente apresentam assimetria positiva elevada, pois há muitos dias com pouca ou nenhuma chuva e poucos dias com eventos intensos.

### 15.3 Curtose em Excesso

A curtose em excesso (Pearson excess kurtosis) é:

```
g₂ = [n(n+1) / ((n-1)(n-2)(n-3))] × Σ [(xᵢ - μ) / s]⁴ − 3(n-1)² / ((n-2)(n-3))
```

- `g₂ > 0`: distribuição leptocúrtica (cauda pesada, pico agudo) — frequente em precipitação diária intensa
- `g₂ = 0`: mesocúrtica (normal)
- `g₂ < 0`: platicúrtica (cauda leve, pico achatado)

Implementado via `scipy.stats.kurtosis(valores, bias=False)`.

### 15.4 Percentis

Calculados via `pandas.Series.quantile()`, que usa interpolação linear por padrão (método `linear`):

```
P(q) = x⌊nq⌋ + (nq − ⌊nq⌋) × (x⌊nq⌋₊₁ − x⌊nq⌋)
```

---

## 16. Verificação dos Requisitos do Trabalho

A seguir, verifica-se item a item o cumprimento dos requisitos da disciplina.

### Requisito 1: Baixar três séries históricas de dados diários de precipitação

**✓ Cumprido.** Três estações foram selecionadas e seus ZIPs baixados do portal HidroWeb/ANA:

| Estação        | Código  | Período disponível | Anos de dados |
|----------------|---------|-------------------|---------------|
| PINDAMONHANGABA| 2245048 | 1932–2025         | 93 (aprox.)   |
| ESTRADA DO CUNHA| 2245055| 1942–2025         | ~80           |
| S. L. PARAITINGA| 2345065| 1940–2025         | ~80           |

O critério de seleção (maior número de anos com dados) foi implementado no script `discover.py`, que inventaria todas as estações da bacia e as classifica por qualidade.

### Requisito 2: Organizar a série de precipitação total diária

**✓ Cumprido.** O pipeline em Python (`pipeline.py` + `src/parser.py`) lê os ZIPs da ANA, reconstrói as datas, trata inconsistências (encoding, separador decimal, duplicatas por nível de consistência, dias inválidos como 31/02) e produz um DataFrame limpo com uma linha por dia por estação. Os dados são carregados no banco de dados PostgreSQL (Supabase) via upsert idempotente.

### Requisito 3: Constituir séries mensal, anual e de precipitação máxima diária anual

**✓ Cumprido.** O módulo `src/series_builder.py` implementa:

- `build_monthly()`: agrega diária em mensal, marca meses com >5% de falha como inválidos
- `build_annual()`: agrega mensal em anual, exige 12 meses válidos completos
- `build_max_daily_annual()`: extrai o máximo diário de cada ano com data de ocorrência

Todas as séries são carregadas no banco e visualizáveis no dashboard em `/series/{codigo}`.

### Requisito 4: Escolher estação de referência, preencher falhas e discutir resultados

**✓ Cumprido.**

**Estação de referência:** PINDAMONHANGABA (2245048) — maior período de dados, localização estratégica no vale do Paraíba.

**Preenchimento por Regressão Linear Múltipla:** modelo OLS treinado no período comum das três estações (90% como treino), com equação da forma `P_ref = β₁·P_aux₁ + β₂·P_aux₂ + β₀`. Validado nos 10% holdout.

**Preenchimento por IDW:** interpolação haversine com expoente p=2. Mesmos dados de holdout para comparação justa.

**Discussão:** O método vencedor (menor RMSE holdout) é aplicado à série real. Resultados detalhados (RMSE, R², equação, distâncias) estão disponíveis no dashboard em `/preenchimento`. A comparação diária entre os dois métodos está disponível na aba `/tabela`.

### Requisito 5: Apresentar em gráficos as séries históricas constituídas

**✓ Cumprido.** O dashboard em Next.js (Recharts) apresenta:

- **Série Diária:** gráfico de linha com destaque em laranja para dias preenchidos; linha pontilhada de média; downsampling automático (LTTB) para performance.
- **Série Mensal:** gráfico de linha com meses inválidos omitidos.
- **Série Anual:** gráfico de linha com anos inválidos omitidos; linha de média.
- **Precipitação Máxima Diária Anual:** gráfico de linha; tendências de eventos extremos ao longo do tempo.

Todos os gráficos possuem **seletor de intervalo de tempo** (ano inicial e final), com atalhos para últimos 10, 20 e 30 anos, e opção de série completa. Acesso em `/series/{codigo}`.

### Requisito 6: Elaborar histograma de frequência

**✓ Cumprido.** Histogramas de 30 classes são calculados pelo pipeline e apresentados no dashboard para cada escala temporal:

- Precipitação total diária
- Precipitação total mensal
- Precipitação total anual
- Precipitação máxima diária anual

Os histogramas estão disponíveis em `/series/{codigo}`, aba correspondente a cada escala, com tabela de estatísticas descritivas ao lado.

### Requisito 7: Interpretar a precipitação observada

**✓ Parcialmente cumprido no dashboard; a seguir, análise qualitativa.**

**Características gerais esperadas para a região:**

A bacia do rio Paraíba do Sul, na porção da URGHI 2 (cabeceira em São Paulo), é influenciada pelo clima subtropical úmido (Cfa/Cfb de Köppen), com precipitações distribuídas ao longo do ano e concentração nos meses de verão (novembro–março) associada ao Sistema de Monção da América do Sul (SMAS) e à Zona de Convergência do Atlântico Sul (ZCAS).

Espera-se:
- Precipitação média anual entre 1.300 e 1.700 mm, dependendo da altitude e exposição orográfica
- Assimetria positiva na distribuição diária (muitos dias secos; poucos eventos intensos)
- Coeficiente de variação da precipitação anual entre 15% e 30%
- Estação ESTRADA DO CUNHA (790 m) tendendo a maiores totais, dada a exposição à vertente úmida da Serra da Mantiqueira
- Série de Pmax com valores entre 50 e 150 mm, com eventos extremos (>100 mm/dia) esporádicos

Os valores exatos das estatísticas calculadas pelo pipeline estão disponíveis no dashboard e devem ser referenciados no relatório final com base nos números concretos obtidos.

---

## 17. Arquitetura do Sistema

### 17.1 Visão Geral

```
┌─────────────────────────────────────┐
│          Dados Brutos               │
│  ZIPs ANA HidroWeb (local)          │
└──────────────────┬──────────────────┘
                   │ parser.py
                   ▼
┌─────────────────────────────────────┐
│          Pipeline Python            │
│  pipeline.py                        │
│  ├── src/parser.py                  │
│  ├── src/series_builder.py          │
│  ├── src/gap_filling.py             │
│  ├── src/stats.py                   │
│  └── src/supabase_loader.py         │
└──────────────────┬──────────────────┘
                   │ supabase-py (REST)
                   ▼
┌─────────────────────────────────────┐
│       Banco de Dados                │
│  Supabase (PostgreSQL)              │
│  ├── estacoes                       │
│  ├── precipitacao_diaria            │
│  ├── precipitacao_mensal            │
│  ├── precipitacao_anual             │
│  ├── max_diaria_anual               │
│  ├── histogramas (JSONB)            │
│  ├── preenchimento_resultado        │
│  ├── preenchimento_diario           │
│  └── config_estacoes                │
└──────────────────┬──────────────────┘
                   │ supabase-js (REST)
                   ▼
┌─────────────────────────────────────┐
│         Frontend Next.js            │
│  Vercel (deploy)                    │
│  ├── /dashboard    — KPIs e mapa    │
│  ├── /estacoes     — lista tabular  │
│  ├── /series/{cod} — gráficos       │
│  ├── /preenchimento— comp. métodos  │
│  ├── /tabela       — dados + XLSX   │
│  └── /transparencia— documentação   │
└─────────────────────────────────────┘
```

### 17.2 Pipeline Python — Sequência de Execução

1. Leitura de `config_estacoes` do Supabase (fallback: `config.yaml` local)
2. Parse dos ZIPs de cada estação (`parse_ana_zip`)
3. Montagem do pivot multivariado
4. Verificação de coordenadas válidas (habilita/desabilita IDW)
5. Para cada estação:
   - Regressão múltipla (`fill_regressao_multipla`)
   - IDW, se coordenadas disponíveis (`fill_idw`)
   - Comparação e seleção do vencedor (`comparar_metodos`)
   - Atualização do pivot com série preenchida
6. Construção de séries agregadas e histogramas
7. Limpeza dos dados anteriores no banco (`limpar_estacao` — cascade)
8. Carga via upsert (idempotente): estacoes → diaria → mensal → anual → max → preenchimento_diario → histogramas → preenchimento_resultado

### 17.3 Banco de Dados — Esquema Principal

```sql
-- Metadados das estações
CREATE TABLE estacoes (
  codigo TEXT PRIMARY KEY,
  nome TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  is_referencia BOOLEAN DEFAULT FALSE,
  anos_dados INTEGER,
  n_dias_total INTEGER,
  n_dias_com_dado INTEGER,
  pct_falhas_original DOUBLE PRECISION,
  pct_falhas_pos_preenchimento DOUBLE PRECISION,
  data_inicio TEXT,
  data_fim TEXT
);

-- Série diária (principal)
CREATE TABLE precipitacao_diaria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor DOUBLE PRECISION,
  preenchido BOOLEAN DEFAULT FALSE,
  metodo TEXT,
  consistencia INTEGER,
  UNIQUE(estacao_codigo, data)
);

-- Série mensal
CREATE TABLE precipitacao_mensal (
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  ano INTEGER,
  mes INTEGER,
  valor DOUBLE PRECISION,
  valido BOOLEAN,
  pct_falhas DOUBLE PRECISION,
  PRIMARY KEY(estacao_codigo, ano, mes)
);

-- Série anual
CREATE TABLE precipitacao_anual (
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  ano INTEGER,
  valor DOUBLE PRECISION,
  valido BOOLEAN,
  pct_falhas DOUBLE PRECISION,
  PRIMARY KEY(estacao_codigo, ano)
);

-- Máxima diária anual
CREATE TABLE max_diaria_anual (
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  ano INTEGER,
  valor DOUBLE PRECISION,
  data_ocorrencia TEXT,
  PRIMARY KEY(estacao_codigo, ano)
);

-- Histogramas e estatísticas (armazenados como JSONB)
CREATE TABLE histogramas (
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  tipo TEXT,  -- 'diaria' | 'mensal' | 'anual' | 'max_diaria_anual'
  dados JSONB, -- { bins, counts, bin_centers, estatisticas: {...} }
  PRIMARY KEY(estacao_codigo, tipo)
);

-- Resultados do preenchimento (parâmetros e métricas)
CREATE TABLE preenchimento_resultado (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estacao_referencia TEXT,
  metodo TEXT,       -- 'regressao' | 'idw'
  parametros JSONB,  -- coeficientes, equação, distâncias etc.
  n_dias_preenchidos INTEGER,
  rmse_holdout DOUBLE PRECISION,
  r2 DOUBLE PRECISION,
  is_vencedor BOOLEAN
);

-- Valores diários por método (para visualização comparativa)
CREATE TABLE preenchimento_diario (
  estacao_codigo TEXT REFERENCES estacoes(codigo) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor_regressao DOUBLE PRECISION,
  valor_idw DOUBLE PRECISION,
  UNIQUE(estacao_codigo, data)
);
```

---

## 18. Parâmetros de Configuração do Pipeline

Todos os parâmetros de processamento são configuráveis em `config.yaml`:

| Parâmetro              | Valor padrão | Descrição                                                   |
|------------------------|-------------|-------------------------------------------------------------|
| `max_falhas_pct`       | 5,0%        | Limite de falhas para mês/ano ser considerado válido        |
| `histograma_bins`      | 30          | Número de classes nos histogramas                           |
| `holdout_pct_validacao`| 10%         | Fração do período comum reservada para validação            |
| `random_state`         | 42          | Semente aleatória para reprodutibilidade do holdout         |
| `idw_expoente`         | 2           | Expoente `p` do IDW                                         |
| `supabase_batch_size`  | 500         | Tamanho do lote para inserção no banco (performance/rate-limit)|

---

## Apêndice A — Algoritmo LTTB (Largest Triangle Three Buckets)

Para exibição da série diária (até ~34.000 pontos por estação) no gráfico do dashboard sem comprometer a performance, o frontend aplica o algoritmo de downsampling **LTTB** antes de renderizar.

O LTTB reduz `N` pontos a `M` pontos (`M < N`) preservando a forma visual da série, selecionando em cada intervalo o ponto que maximiza a área do triângulo formado com os pontos adjacentes selecionados. É implementado em `frontend/lib/utils.ts`.

O parâmetro `maxPoints` (padrão: 2000 para a série diária) controla a resolução de exibição. O dado completo continua disponível no banco.

---

## Apêndice B — Tratamento de Dados Faltantes no Banco

O pipeline adota uma política de **idempotência total**: antes de inserir dados de uma estação, limpa todos os registros existentes via `DELETE ... CASCADE`. Isso garante que re-execuções do pipeline não acumulem dados duplicados.

```python
def limpar_estacao(client, codigo):
    client.table("estacoes").delete().eq("codigo", codigo).execute()
    # CASCADE apaga automaticamente todas as tabelas dependentes
```

Para robustez contra desconexões (comum no plano gratuito do Supabase sob carga), o `_batch_insert` implementa retentativas com backoff exponencial:

```
Tentativa 1 → espera 1s → Tentativa 2 → espera 2s → Tentativa 3 → espera 4s → Tentativa 4 → falha
```

---

## Apêndice C — Limitações e Considerações Metodológicas

1. **Coordenadas geográficas não presentes nos ZIPs da ANA:** os arquivos CSV não incluem lat/lon no corpo de dados. As coordenadas foram obtidas manualmente no portal ANA e inseridas em `config.yaml`. Sem coordenadas reais, o IDW não pode ser executado e apenas a regressão é aplicada.

2. **Regressão linear para precipitação diária:** séries de precipitação diária frequentemente violam os pressupostos da regressão OLS (normalidade dos resíduos, homocedasticidade). O modelo pode subestimar eventos extremos e gerar valores baixos em dias chuvosos. A restrição de não-negatividade mitiga parte do problema. Para análises mais rigorosas, modelos não-lineares (regressão log-transformada, GLM Gamma/Tweedie) seriam mais adequados, mas estão fora do escopo desta disciplina.

3. **IDW assume estacionariedade espacial:** a hipótese de que estações mais próximas são mais correlacionadas é razoável em escala regional, mas pode falhar em situações de precipitações convectivas muito localizadas (célula de tempestade <10 km).

4. **Período comum para treino:** o desempenho dos modelos depende fortemente do tamanho e representatividade do período comum. Se o período comum for curto ou climatologicamente atípico, os modelos podem ter desempenho inferior ao esperado.

5. **Limiar de falhas de 5%:** o critério de 5% para validade de mês foi adotado como conservador. A NBR 12217 e práticas da ANA frequentemente usam 10–15%. O valor de 5% resulta em mais meses e anos marcados como inválidos, o que pode reduzir o tamanho útil das séries anuais.
