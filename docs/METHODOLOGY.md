# Metodologia — Análise Pluviométrica

## 1. Fonte dos dados

Todos os dados pluviométricos foram obtidos do **ANA Hidroweb**
(`hidroweb.ana.gov.br`), sistema de gerenciamento de dados hidrológicos
da Agência Nacional de Águas.

Cada série é fornecida em formato CSV dentro de um ZIP. O CSV registra
precipitação **mensal** com colunas diárias (`Chuva01`…`Chuva31`).

### Níveis de consistência

| Nível | Descrição |
|-------|-----------|
| 1 | Bruto (sem revisão) |
| 2 | Consistido (revisado pela ANA) |

Quando o mesmo mês aparece com os dois níveis, **o nível 2 é mantido**,
pois representa dados revisados.

---

## 2. Construção da série diária

1. O CSV mensal é derretido (melt) em registros diários.
2. Datas inválidas (ex.: 31 de fevereiro) são descartadas via
   `pd.to_datetime(..., errors='coerce')`.
3. Valores negativos são tratados como ausentes (NaN).

---

## 3. Critério de validade mensal/anual

Um mês é considerado **válido** se o percentual de dias sem registro
for ≤ 5%. Meses inválidos são excluídos das somas mensais e anuais.

Um ano é **válido** somente se todos os 12 meses são válidos (sem
registros faltantes na tabela mensal).

O limiar de 5% foi escolhido como ponto de equilíbrio entre rigor
estatístico e preservação de anos com poucos dias de falha pontual.

---

## 4. Preenchimento de falhas

Aplicado exclusivamente na **estação de referência** (a escolhida com
maior quantidade de dados).

### 4.1 Período comum

Identificamos os dias em que **todas as 3 estações** possuem registro.
Esse conjunto é usado para treino e validação.

### 4.2 Holdout de validação

10% do período comum é separado aleatoriamente (seed fixo = 42) para
validação. Os outros 90% são usados para treino/ajuste. O mesmo holdout
é usado para ambos os métodos, garantindo comparação justa.

### 4.3 Regressão Linear Múltipla

Equação ajustada pelo método dos mínimos quadrados ordinários:

```
P_ref(t) = β₁·P₁(t) + β₂·P₂(t) + ... + β₀
```

Onde `P₁`, `P₂` são as precipitações das estações auxiliares.
O modelo é aplicado para preencher dias onde a referência tem falha
**e** todas as auxiliares têm dado.

**Métricas:**
- R² no conjunto de treino (90%)
- RMSE no holdout (10%)

### 4.4 IDW (Inverse Distance Weighting)

Interpolação espacial ponderada pela distância haversine:

```
P_ref(t) = Σᵢ [ Pᵢ(t) / dᵢᵖ ] / Σᵢ [ 1 / dᵢᵖ ]
```

Onde:
- `dᵢ` = distância haversine (km) entre a referência e a auxiliar i
- `p` = expoente da distância (adotado p=2)
- A soma é apenas sobre as estações **com dado** no dia t

**Diferença da regressão:** o IDW aceita preenchimento parcial
(ao menos uma auxiliar com dado). Não requer treino explícito.

**Métrica:** RMSE no mesmo holdout da regressão.

### 4.5 Seleção do método vencedor

O método com **menor RMSE no holdout** é declarado vencedor e
aplicado à série final. Os dias preenchidos recebem a flag
`preenchido=true` e o campo `metodo` com o nome do método.

---

## 5. Distância haversine

A distância entre dois pontos (φ₁,λ₁) e (φ₂,λ₂) na superfície terrestre:

```
a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
c = 2·atan2(√a, √(1−a))
d = R·c
```

Onde R = 6371 km (raio médio da Terra).

---

## 6. Histogramas

Calculados com `numpy.histogram` usando **30 bins** de largura uniforme.
Incluem também linha de média e mediana para visualização.

### Séries histogramadas

| Série | Unidade | Observações incluídas |
|-------|---------|----------------------|
| Diária | mm | Todos os dias com dado |
| Mensal | mm | Meses válidos (≤5% falha) |
| Anual | mm | Anos válidos |
| Máx. diária anual | mm | Um valor por ano |

---

## 7. Estatísticas descritivas

Para cada série são calculados:

| Estatística | Descrição |
|-------------|-----------|
| Média, Mediana | Tendência central |
| Desvio padrão | Dispersão |
| Mín., Máx. | Extremos |
| P25, P50, P75, P90, P95, P99 | Percentis |
| Coef. de variação | CV = σ/μ |
| Assimetria (Skewness) | Pearson, não-viesado |
| Curtose (Kurtosis) | Excesso em relação à normal |
| n_observações, n_falhas | Contagem e % |

A assimetria positiva (típica de precipitação) indica maior concentração
de valores baixos com cauda direita alongada (eventos extremos raros).

---

## 8. Projeto 2 — Fluviometria, curva-chave e migração para API REST

A partir do **Projeto 2 (Fase 1)**, o pipeline foi estendido para ingerir dados
**fluviométricos** (vazão e cota) e migrado para a nova **API REST
HidroWebService da ANA**. As fórmulas seguem o documento da disciplina
[`HID41_Projeto2_Metodologia.md`](../HID41_Projeto2_Metodologia.md) (Profa.
Dani Bressiani, 2026) e Collischonn & Dornelles, cap. 14, 15 e 18.

### 8.1 Fonte dos dados — API REST HidroWebService

| Endpoint                                                     | Uso                                          |
|--------------------------------------------------------------|----------------------------------------------|
| `/EstacoesTelemetricas/OAUth/v1`                             | Autenticação (Bearer token, TTL 60 min)      |
| `/EstacoesTelemetricas/HidroInventarioEstacoes/v1`           | Inventário (descobrir candidatas a exutório) |
| `/EstacoesTelemetricas/HidroSerieVazao/v1`                   | Série diária de vazão (m³/s), 366 dias/req   |
| `/EstacoesTelemetricas/HidroSerieCotas/v1`                   | Série diária de cotas (cm)                   |
| `/EstacoesTelemetricas/HidroSerieResumoDescarga/v1`          | Medições pontuais para curva-chave           |
| `/EstacoesTelemetricas/HidroSerieCurvaDescarga/v1`           | Curvas oficiais da ANA (referência)          |
| `/EstacoesTelemetricas/HidroSerieChuva/v1`                   | Pluviometria diária (substitui ZIPs locais)  |

Detalhes operacionais (autenticação, retries, cache de token e respostas) estão
em [`ANA_REST_API.md`](ANA_REST_API.md).

### 8.2 Descoberta da estação exutória

A bacia do Paraíba do Sul pertence à macrorregião hidrográfica **5 (Atlântico,
Trecho Leste)** no inventário ANA; suas estações fluviométricas usam o prefixo
de código `58` (sub-bacia 58 — Paraíba do Sul). O ranking de candidatas
implementado em [`fluvio_discover.py`](../pipeline/src/fluvio_discover.py)
combina:

```
score = 0.5 · score_anos
      + 0.3 · score_falhas
      + 0.2 · score_proximidade

score_anos        = min(anos_dados / 40, 1)
score_proximidade = 1 / (1 + dist_min_km / 20)
```

`dist_min_km` é a menor distância haversine entre a candidata e qualquer um dos
três pluviômetros do projeto. As 5 melhores candidatas ficam disponíveis em
[/selecao-fluvio](/selecao-fluvio) para escolha manual.

### 8.3 Séries fluviométricas

**Série diária** consolida vazão e cota:

```
fluviometria_diaria: (estacao_codigo, data) →
  vazao_m3s, cota_cm, consistencia, status_vazao, status_cota,
  preenchido, metodo
```

- `consistencia`: 1 (bruto) ou 2 (consistido); na duplicata, prevalece 2.
- `preenchido = true` ⇔ vazão derivada de cota via curva-chave.

**Série mensal** agrega por média/min/max de vazão (não soma — vazão é fluxo
instantâneo, não volume); meses com pct_falhas > 5% são marcados inválidos.

**Série anual** vale somente se os 12 meses forem válidos.

### 8.4 Curva-chave por potência

Forma adotada (Collischonn & Dornelles eq. 14.x; Tucci §6):

$$Q = a \cdot (h - h_0)^{b}$$

Onde `h₀` é a cota correspondente a vazão nula (não necessariamente o zero da
régua). Procedimento em [`rating_curve.py`](../pipeline/src/rating_curve.py):

1. **Grid-search de h₀** em [0, h_min) com passo 5 cm, minimizando o SSR do
   ajuste log-linear `ln Q = ln a + b · ln(h − h₀)`.
2. **Refino de (a, b)** na escala natural via `scipy.optimize.curve_fit`,
   inicializado com os valores do log-linear; isso lida melhor com
   heterocedasticidade quando há saltos grandes de Q.
3. **Métricas** reportadas: R² na escala natural, RMSE em m³/s, MAE, p-value do
   teste de Kolmogorov-Smirnov sobre os resíduos normalizados.

A curva é então **aplicada à série de cotas** para preencher dias com cota
observada mas vazão ausente — armazenado com `preenchido = true` e
`metodo = "curva_chave"`. Cotas fora da faixa observada [h_min, h_max] resultam
em NaN para evitar extrapolação.

A curva oficial da ANA (`HidroSerieCurvaDescarga`) é armazenada em paralelo na
mesma tabela `curva_chave_ajuste` com `forma = "ana_oficial"` para comparação.

### 8.5 Migração da ingestão pluviométrica

A função [`pluvio_api.fetch_chuva_diaria()`](../pipeline/src/pluvio_api.py)
substitui (com a flag `--via rest`) o caminho anterior baseado em ZIPs locais:

```bash
# Novo padrão (puxa direto da ANA):
python pipeline.py

# Legado (ZIPs em data/raw/):
python pipeline.py --via local
```

A estrutura de saída (`estacao_codigo, data, valor, consistencia`) é
preservada, garantindo compatibilidade total com o resto do pipeline
(gap_filling, series_builder, supabase_loader).

---

## 9. Projeto 2 — Fase 2: Regime de vazões

### 9.1 Curva de permanência (Q5–Q99)

Implementação em [`flow_duration.py`](../pipeline/src/flow_duration.py).

1. Tomar toda a série de vazões diárias (n valores, valores NaN descartados).
2. Ordenar em **ordem decrescente**.
3. Atribuir a posição `m = 1..n`.
4. Probabilidade de excedência por **plotagem de Weibull**:

   ```
   P(%) = m / (n + 1) · 100
   ```

5. Interpolar linearmente os valores de Q nos percentis-alvo (Q5, Q10, Q25, Q50,
   Q75, Q90, Q95, Q99). A curva completa é gerada com passo de 0,5% (201 pontos).
6. Indicadores derivados:
    - **Razão Q10/Q90** — índice de "torrência" do regime.
    - **Declividade log** — slope `(log Q90 − log Q10) / (90 − 10)` (negativa).

Q90 é a vazão de referência para outorga adotada por boa parte das agências
estaduais (CETESB, ANA Outorga Federal); Q50 é a mediana de longo prazo;
Q10 representa vazões altas frequentes (uso em projetos de drenagem urbana).

### 9.2 Filtro digital de Eckhardt (separação de escoamentos)

Implementação em [`eckhardt.py`](../pipeline/src/eckhardt.py).

Equação recursiva (Eckhardt 2005):

$$b_i = \frac{(1 - BFI_{max}) \cdot \alpha \cdot b_{i-1} + (1 - \alpha) \cdot BFI_{max} \cdot y_i}{1 - \alpha \cdot BFI_{max}}, \quad b_i \le y_i$$

onde `y_i` = vazão total, `b_i` = vazão de base, `f_i = y_i − b_i` = vazão direta.

**Parâmetros:**
- `α = exp(−Δt/k)` com `Δt = 1 dia`; `k` é a constante de recessão (dias).
  Estimada pela **mediana** das regressões log-lineares `ln(Q_t) = ln(Q_0) − t/k`
  em janelas contínuas de queda monotônica (≥ 5 dias) após pelo menos 3 dias
  sem chuva. Se nenhuma janela for válida, usa-se `α = 0,98` como padrão.
- `BFI_max`: valores de Eckhardt (2005):
  - **0,80** — rios perenes com aquífero poroso (cabeceira do Paraíba do Sul);
  - 0,50 — rios perenes com aquífero fraturado/rochoso;
  - 0,25 — rios efêmeros com aquífero poroso.

O filtro é aplicado em uma única passada forward. `b_0` é inicializado com o
primeiro valor válido de `y`.

**Métricas:**
- `bfi_global = Σ b / Σ y` — fração média de longo prazo do escoamento de base.

### 9.3 Q7,10 — análise de frequência de mínimos

Implementação em [`low_flow.py`](../pipeline/src/low_flow.py).

1. Aplicar média móvel de 7 dias na série de vazão.
2. Para cada **ano hidrológico** (out → set, padrão SE do Brasil), extrair o
   **mínimo** dessa média móvel, com data de ocorrência. Anos com menos de
   300 dias de Q7 válido são descartados.
3. Ajustar **Log-Pearson III** sobre `ln(Q7_min)` pelo **método dos momentos**:
   `μ_log`, `σ_log`, `g_log` (assimetria amostral corrigida).
4. Q7,10 é o quantil de **probabilidade de não-excedência 0,10**, obtido
   pela `pearson3.ppf` do scipy (no espaço log) e exponenciado.
5. Diagnóstico: p-value do teste KS comparando a distribuição empírica
   (em log) com a Pearson III ajustada.

A escolha de LP3 segue o padrão brasileiro/ANA para vazões de referência
ecológica. Para séries curtas (< 20 anos), o IC é largo — reportamos `n_anos`
e KS p-value lado a lado para que o leitor avalie a confiabilidade.

---

## 10. Projeto 2 — Fase 3: Eventos e Hidrogramas Unitários

### 10.1 Isolamento de eventos chuva-vazão

Implementação em [`event_isolation.py`](../pipeline/src/event_isolation.py).

1. **Detecção de picos** via `scipy.signal.find_peaks`:
   - `prominence` mínima = 0,3 · Q95 da série diária (escala a sensibilidade
     pela magnitude do regime);
   - `distance` mínima entre picos = 5 dias (configurável).
2. **Recuo até o início**: do pico, anda para trás enquanto Q estiver subindo
   monotonicamente — o último mínimo local marca o início do evento.
3. **Avanço até o fim**: `D_dias = 0,827 · A^0,2` (Collischonn & Dornelles
   eq. 18.x); cortado antes se houver um próximo pico em janela menor.
4. **Filtros**:
   - Chuva total ≥ 20 mm (configurável) acumulada entre o dia anterior ao
     início e o dia do pico;
   - Duração total dentro de `[base_time, base_time + 2]` dias.
5. **Separação de base**: linha reta entre Q(início) e Q(fim); `q_direto =
   max(q_total − base, 0)`.
6. **Volume e lâmina**: `V = Σ q_direto · 86400 s` em m³; `h_mm = V/(A · 1000)`.
7. **Chuva da bacia**: para Fase 1 usamos a **média simples** das
   precipitações diárias das 3 estações pluviométricas do projeto
   (refinamento por Thiessen pode entrar em uma fase futura).

### 10.2 Chuva efetiva — φ-index

Implementação em [`event_isolation.calcular_phi_index`](../pipeline/src/event_isolation.py).

Bissecção de φ tal que `Σ max(P_i − φ, 0) = h_mm`. Como o passo de chuva é
diário (Δt = 1 dia), φ tem unidade de mm/dia. Alternativa SCS-CN está em
[`scs_uh.chuva_efetiva_scs_cn`](../pipeline/src/scs_uh.py) — mais robusta
quando há dados de CN.

### 10.3 Hidrograma unitário observado

Implementação em [`unit_hydrograph.py`](../pipeline/src/unit_hydrograph.py).

Para cada evento isolado: `u_i = q_direto_i / h_mm` (ordenadas em m³/s/mm).
Hipóteses de linearidade e invariância temporal são apenas aproximadas; o
HU médio é obtido alinhando os HUs individuais pelo índice do pico e
tomando a média ordenada-a-ordenada. Reportamos também o desvio padrão por
ordenada, que dá uma noção da variabilidade entre eventos.

### 10.4 Hidrograma unitário sintético SCS

Implementação em [`scs_uh.py`](../pipeline/src/scs_uh.py).

Tempo de concentração:
- **Kirpich (1940)**, em **minutos**:

  $$t_c = 57 \cdot \left(\frac{L^3}{\Delta h}\right)^{0{,}385}$$

  com L em km e Δh em m. Indicado para bacias pequenas/rurais.
- **Watt & Chow (1985)**, em **minutos**:

  $$t_c = 7{,}68 \cdot \left(\frac{L}{\sqrt{S}}\right)^{0{,}79}$$

  com S adimensional. Recomendado para A > 5.000 km² (como o caso de
  Pindamonhangaba, A ≈ 9.600 km²).

HU SCS triangular (com duração efetiva `d`):

$$t_p = 0{,}6 \cdot t_c \qquad T_p = t_p + d/2 \qquad Q_p = \frac{0{,}208 \cdot A}{T_p} \qquad t_b = 2{,}67 \cdot T_p$$

(`Q_p` em m³/s/mm; `A` em km²; `T_p` em h). A constante `0,208` conserva o
volume sob o triângulo unitário no sistema SI.

### 10.5 Aplicação a eventos — SCS-CN + convolução

$$S = \frac{25400}{CN} - 254 \quad [\text{mm}] \qquad I_a = 0{,}2 \cdot S$$

$$Q = \frac{(P - I_a)^2}{P - I_a + S} \quad \text{para } P > I_a;\quad Q = 0 \text{ caso contrário}$$

A convolução discreta com o HU:

$$Q_n = \sum_j P_j \cdot u_{\,n-j+1}$$

está em [`unit_hydrograph.aplicar_huo`](../pipeline/src/unit_hydrograph.py)
(via `numpy.convolve`).

### 10.6 Métricas de comparação observado × SCS

Implementação em [`scs_uh.comparar_obs_vs_scs`](../pipeline/src/scs_uh.py):

- **Nash-Sutcliffe (NSE)** sobre ordenadas interpoladas para a malha do SCS;
- **Erro relativo no pico**: `(Qp_SCS − Qp_obs) / Qp_obs`;
- **Erro no tempo de pico**: `Tp_SCS − Tp_obs` em horas.

NSE ≥ 0,5 é considerado bom em hidrologia de bacias bem-comportadas.

---

## 11. Projeto 2 — Fase 4: Frequência de cheias, IDF e chuva de projeto

### 11.1 Vazões máximas anuais

Implementação em [`flood_frequency.serie_max_anual_q`](../pipeline/src/flood_frequency.py).
Para cada ano-calendário extrai-se o **máximo diário** da série de vazão,
com a data de ocorrência preservada. Anos sem dado são descartados.

### 11.2 Ajuste de distribuições candidatas

Implementação em [`flood_frequency.ajustar_distribuicoes`](../pipeline/src/flood_frequency.py).

| Distribuição        | Estimação                            | Espaço      |
|---------------------|--------------------------------------|-------------|
| Gumbel (EV1)        | Momentos                             | Natural Q   |
| GEV                 | MLE (`scipy.stats.genextreme.fit`)   | Natural Q   |
| LogNormal           | Momentos em log(Q)                   | log Q       |
| Pearson III         | Momentos (mu, sigma, skew)           | Natural Q   |
| Log-Pearson III     | Momentos em log(Q)                   | log Q       |

Para cada ajuste reportamos `log_lik`, **AIC**, **BIC** e KS (estatística +
p-value contra a CDF teórica ajustada).

### 11.3 Seleção da distribuição

Critério primário: **AIC** entre as distribuições que **passaram no KS**
(p ≥ 0,05). Se nenhuma passar, é destacada a melhor pelo AIC mesmo assim,
e o front sinaliza ao usuário a baixa aderência. Critérios alternativos
(`bic`, `ks`) são configuráveis em `config.yaml → frequencia.criterio_selecao`.

### 11.4 Quantis Q(TR) e intervalos de confiança

$$P_{exc} = 1/TR \quad \Rightarrow \quad Q_{TR} = F^{-1}(1 - 1/TR)$$

IC 90% (configurável) por **bootstrap não-paramétrico**: reamostragem com
reposição da série original observada, re-ajuste da distribuição, cálculo do
quantil em cada amostra; os percentis (1-α)/2 e 1−(1-α)/2 das amostras dão o IC.
Default: 1.000 reamostras. Implementação em
[`flood_frequency.quantis_tr`](../pipeline/src/flood_frequency.py).

### 11.5 IDF regional

Implementação em [`idf.py`](../pipeline/src/idf.py). Equação adotada
(Pfafstetter generalizada):

$$i = \frac{a \cdot TR^{\,b}}{(t_d + c)^{\,d}} \quad [\text{mm/h}]$$

com `TR` em anos e `t_d` em minutos. Os parâmetros `(a, b, c, d)` ficam em
`config.yaml → idf.parametros`. **Default placeholder** para São José dos
Campos: a = 1239,7; b = 0,181; c = 22; d = 0,890 — substituir pelos valores
confirmados na fonte oficial (CETESB / Pfafstetter DNOS / IDF-BR / IDFGEO).

A curva é tabelada para `TR ∈ {2, 5, 10, 25, 50, 100, 500, 1000}` e
`duracao_min ∈ {5, 10, 15, 30, 60, 120, 360, 720, 1440}`.

### 11.6 Chuva de projeto — método dos blocos alternados

Implementação em [`design_storm.chuva_projeto_blocos_alternados`](../pipeline/src/design_storm.py).

1. Definir duração total `t_d` (default 360 min) e número de blocos `n`.
2. Δt = `t_d / n`; t_k = k · Δt.
3. `P_k = i(TR, t_k) · t_k` — profundidade acumulada (mm).
4. ΔP_k = `P_k − P_{k-1}` — incrementos por bloco.
5. Reordenar os incrementos:
   - **Intermediário (default)**: maior no centro, alternando antes/depois.
   - **Adiantado**: ordem decrescente (pico no início).
   - **Atrasado**: ordem crescente (pico no fim).

Aplicado para TR = 10 e TR = 100 anos por padrão (configurável em
`config.yaml → chuva_projeto.trs_projeto`).

### 11.7 Acoplamento opcional Fase 3 ↔ Fase 4

A função
[`design_storm.hidrograma_projeto_via_hu`](../pipeline/src/design_storm.py)
permite passar a chuva de projeto pelo SCS-CN (opcional) e convoluir com o
HU SCS triangular gerado na Fase 3, produzindo o **hidrograma de projeto**.
Esse pico pode ser comparado com Q(TR) da análise de frequência (Fase 4),
servindo como sanity check do caminho chuva → vazão. Esse passo não é
gravado automaticamente pelo pipeline; pode ser invocado em notebooks
isolados quando os parâmetros físicos da bacia estiverem confirmados.
