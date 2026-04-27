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
