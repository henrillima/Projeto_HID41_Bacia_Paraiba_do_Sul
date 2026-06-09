# Projeto 2 – HID-41 (ITA): Metodologia de Cálculo Padronizada

Documento de referência para montar a "ferramenta" (planilha/script Python) que executa todas as etapas do Projeto 2. Para cada etapa: **o que é, dados de entrada, fórmulas, passo a passo de cálculo e o que discutir**. As fórmulas seguem o material da disciplina (Profa. Dani Bressiani, 2026) e o livro-texto *Hidrologia para Engenharia e Ciências Ambientais* (Collischonn & Dornelles, ABRH), capítulos 14, 15 e 18.

---

## 0. Preparação dos dados e da bacia

### 0.1 Dados de vazão (exutório)
- **Fonte:** HidroWeb / portal da ANA (SNIRH). Baixar a série de **vazão diária** (m³/s) da estação fluviométrica no exutório da sua bacia, mais a série de **cotas** (cm/m) se for refazer a curva-chave.
- Idealmente série **> 10–20 anos** para análise estatística confiável.
- **Pré-processamento obrigatório:**
  - Identificar e marcar falhas (preenchimento por média aritmética, ponderação regional ou regressão linear com postos vizinhos — válido quando a normal anual difere < 10% entre postos).
  - Análise de consistência (dupla massa, valores absurdos, dias inexistentes).
  - Converter datas para um índice temporal contínuo.

### 0.2 Caracterização física da bacia (para HU sintético, tc, SCS-CN)
Levantar a partir de MDE (SRTM/Copernicus) em QGIS:
- Área da bacia **A** (km²);
- Comprimento do talvegue/curso principal **L** (km);
- Diferença de cota ao longo do talvegue **Δh** (m), ou declividade **S** (m/m);
- Uso/ocupação do solo e tipo hidrológico de solo → para estimar o **CN**.

---

## 1. Curva de permanência e vazões Q90, Q50, Q10

### Conceito
A curva de permanência relaciona cada valor de vazão à porcentagem do tempo em que ele é **igualado ou superado**. Q90 é alta permanência (vazão de referência/estiagem), Q50 é a mediana, Q10 representa vazões altas/cheias frequentes.

### Passo a passo
1. Tomar toda a série de vazões diárias (n valores).
2. Ordenar em **ordem decrescente**.
3. Atribuir a posição `m = 1, 2, ..., n`.
4. Calcular a frequência de excedência (probabilidade empírica) — use a posição de plotagem de **Weibull**:

$$P(\%) = \frac{m}{n+1}\times 100$$

5. Plotar Q (eixo y) × P% (eixo x). Em hidrologia frequentemente usa-se escala log no eixo Q.
6. **Q_x** = vazão associada a P = x%. Interpolar entre os dois pontos vizinhos:

$$Q_x = Q_i + (Q_{i+1}-Q_i)\cdot\frac{x - P_i}{P_{i+1}-P_i}$$

obtendo **Q90, Q50, Q10**.

### Discutir
- O que Q90/Q50/Q10 dizem sobre regularidade do rio (rio "firme" × "torrencial").
- Q90 e Q95 como vazões de referência para **outorga**.
- Inclinação da curva: curva achatada → forte contribuição de base/aquífero; curva íngreme → resposta rápida, pouca regularização.
- Comparar com bacias de outras regiões (ex.: bacia amazônica × semiárido).

---

## 2. Filtro Digital de Eckhardt (2005) – separação de escoamentos

### Conceito
Separa a vazão total $y_i$ em **escoamento de base** $b_i$ e **escoamento direto/rápido** $f_i$, recursivamente.

$$y_i = f_i + b_i$$

### Equação do filtro

$$b_i = \frac{(1-BFI_{max})\cdot a\cdot b_{i-1} + (1-a)\cdot BFI_{max}\cdot y_i}{1 - a\cdot BFI_{max}}$$

com a restrição $b_i \le y_i$.

### Parâmetros
- **a** = constante de recessão do filtro (decaimento do aquífero):

$$a = e^{-\Delta t / k}$$

onde **k** é a constante de recessão, estimada na curva de depleção (estiagem sem chuva) usando dois valores de vazão espaçados de Δt:

$$k = \frac{-\Delta t}{\ln\!\left(\dfrac{Q_{t+\Delta t}}{Q_t}\right)}$$

Alternativamente, ajustar reta em $\ln Q$ × $t$ nos trechos de recessão (modelo de Horton $Q_t = Q_0 e^{-t/k}$) e tirar **a** da inclinação.

- **BFI_max** = índice de escoamento de base máximo (fração máxima de base no total). Valores típicos de Eckhardt (2005):
  - 0,80 → rios perenes com aquífero poroso;
  - 0,50 → rios perenes com aquífero fraturado/rochoso;
  - 0,25 → rios efêmeros com aquífero poroso.

### Passo a passo
1. Estimar **k** (e portanto **a**) nas recessões; definir **BFI_max** pelo tipo de bacia.
2. Inicializar $b_0$ (ex.: $b_0 = y_0$ ou um percentil baixo da vazão).
3. Aplicar a recursão dia a dia; impor $b_i \le y_i$.
4. Calcular $f_i = y_i - b_i$.
5. **BFI** (índice global) $= \dfrac{\sum b_i}{\sum y_i}$.
6. Plotar hidrograma com base (vermelho) e escoamento rápido (azul) empilhados.

### Discutir
- BFI obtido e o que indica sobre armazenamento subterrâneo.
- Sensibilidade aos parâmetros (a, BFI_max).
- Coerência com a Q90 (bacias com BFI alto tendem a Q90 alta).

---

## 3. Hidrograma Unitário (HU) a partir de dados observados

### Conceito
HU = resposta da bacia (hidrograma de escoamento **direto**) a uma chuva efetiva **unitária** (1 mm ou 1 cm) de duração D. Hipóteses: linearidade, invariância temporal, proporcionalidade.

### Passo a passo
1. **Selecionar eventos isolados** na série: picos bem definidos, idealmente causados por uma chuva curta e intensa, com recessão limpa.
2. **Separar o escoamento de base** do evento (use o filtro de Eckhardt da etapa 2, ou método gráfico). O ponto de fim do escoamento direto (inflexão) pode usar:

$$D_{dias} \approx 0,827 \cdot A^{0,2}\quad(A\text{ em km}^2)$$

3. O que sobra é o **escoamento direto** (hidrograma de runoff).
4. Calcular o **volume escoado direto** (área sob o hidrograma direto): $V = \sum Q_i \cdot \Delta t$.
5. Converter em **lâmina** sobre a bacia: $h_{mm} = \dfrac{V}{A}$ (cuidar das unidades → mm).
6. **Normalizar** cada ordenada dividindo pela lâmina (para HU de 1 mm): $u_i = Q_i / h_{mm}$.
7. Verificar: a área do HU deve corresponder a 1 mm de lâmina sobre a bacia.
8. Anotar a **duração da chuva efetiva D** associada a esse HU.

> Para combinar durações diferentes, usar a **Curva S** (soma de HUs deslocados de D) e re-derivar o HU de outra duração.

### Discutir
- Forma do HU (tempo de pico, tempo de base) e o que revela da bacia.
- Variabilidade entre eventos (a hipótese de linearidade é só aproximada).

---

## 4. Hidrograma Unitário Sintético do SCS (triangular)

### Conceito
HU triangular definido por tempos característicos em função do **tempo de concentração tc**.

### Fórmulas
**Tempo de concentração** (escolher conforme tamanho da bacia):

- *Kirpich (1940)* — bacias pequenas/rurais:

$$t_c = 57\left(\frac{L^3}{\Delta h}\right)^{0,385}\quad[\text{min}],\; L\,[km],\;\Delta h\,[m]$$

- *Watt & Chow (1985)* — bacias maiores (até ~5840 km²):

$$t_c = 7,68\left(\frac{L}{S^{0,5}}\right)^{0,79}\quad[\text{min}],\; S\text{ adimensional}$$

**Tempos do HU SCS** (com d = duração da chuva unitária; converter tc para horas):

$$t_p = 0,6\, t_c \qquad T_p = t_p + \frac{d}{2}$$

- $T_p$ = tempo de ascensão (pico); ramo de recessão $\approx 1,67\,T_p$.
- Tempo de base: $t_b = T_p + 1,67\,T_p = 2,67\,T_p$.

**Vazão de pico** (HU para 1 mm; A em km², Tp em h → Qp em m³/s/mm):

$$Q_p = \frac{0,208\cdot A}{T_p}$$

(constante 0,208 no SI; é a que conserva volume sob o triângulo de lâmina unitária.)

### Passo a passo
1. Calcular tc (Kirpich ou Watt&Chow), depois tp, Tp, tb.
2. Calcular Qp.
3. Montar o triângulo: (0,0) → (Tp, Qp) → (tb, 0).
4. Discretizar em Δt e tabular as ordenadas.

### Discutir
- Comparar o HU sintético SCS com o HU observado da etapa 3 (pico, tempo ao pico, formato).
- Limitações do triângulo simplificado.

---

## 5. Aplicação a diferentes eventos de precipitação (convolução)

### Chuva efetiva pelo método SCS-CN
$$S = \frac{25400}{CN} - 254\;[mm] \qquad I_a = 0,2\,S$$
$$Q = \frac{(P - I_a)^2}{(P - I_a + S)}\quad\text{se } P>I_a;\qquad Q=0 \text{ se } P\le I_a$$
(P = chuva total mm; Q = chuva efetiva/escoamento direto mm; CN de 0 a 100 conforme solo/uso.)

### Convolução com o HU
Para um hietograma de chuva efetiva $P_1, P_2, ..., P_m$ (em mm) e HU de ordenadas $u_j$:

$$Q_n = \sum_{j} P_j \cdot u_{\,n-j+1}$$

### Passo a passo
1. Escolher ≥ 2 eventos de chuva reais distintos (volume/intensidade diferentes).
2. Para cada um: P → chuva efetiva por SCS-CN (discretizada em blocos de duração D do HU).
3. Convoluir com o HU (observado e/ou SCS) → hidrograma de escoamento direto.
4. Somar o escoamento de base → hidrograma total simulado.
5. Comparar com o hidrograma observado do evento.

### Discutir
- Quão bem o HU reproduz eventos de magnitudes diferentes (teste da linearidade).
- Efeito do CN e das perdas iniciais.

---

## 6. Vazão mínima de referência Q7,10

### Conceito
**Q7,10** = vazão mínima média de **7 dias consecutivos** com período de retorno de **10 anos** (probabilidade anual de 10% de não ser atingida). Vazão de referência clássica para outorga/qualidade.

### Passo a passo
1. Para **cada ano** da série, calcular a **média móvel de 7 dias** da vazão e tomar o **mínimo anual** dessas médias → série de mínimas anuais de 7 dias (Q7).
2. Ajustar uma distribuição de **mínimos** à série Q7 (comumente **log-Pearson III**, **Weibull** ou **Gumbel para mínimos**).
3. Posição de plotagem (para mínimos, excedência inferior): $P = m/(n+1)$ na série ordenada **crescente**.
4. TR = 10 anos para mínimos ⇒ probabilidade de não-excedência $P = 1/TR = 0,10$.
5. Ler/estimar a vazão correspondente na distribuição ajustada → **Q7,10**.

### Discutir
- Q7,10 vs Q90/Q95 (todas vazões de referência, mas conceitos distintos).
- Implicação para disponibilidade hídrica e outorga na bacia.

---

## 7. Ajuste e refazimento da curva-chave

### Conceito
Curva-chave relaciona **cota (h)** × **vazão (Q)** na seção. Forma usual (potência):

$$Q = a\,(h - h_0)^{\,b}$$

onde $h_0$ = cota de vazão nula.

### Passo a passo
1. Reunir os pares (cota, vazão) medidos (medições de descarga líquida) baixados.
2. Estimar $h_0$ (otimização) e linearizar:

$$\ln Q = \ln a + b\,\ln(h-h_0)$$

3. Regressão linear em $\ln(h-h_0)$ × $\ln Q$ → obter **a** e **b**.
4. Avaliar ajuste: R², resíduos; se necessário usar **curva por trechos** (extravasamento de calha).
5. Aplicar a curva-chave para converter a série de cotas em vazões e comparar com a série de vazões original.

### Discutir
- Qualidade do ajuste, histerese, mudança de seção, extrapolação para cotas altas (risco).
- Diferença entre curva ajustada e a oficial da ANA.

---

## 8. Ajuste de PDF para vazões máximas e curvas de TR

### Conceito
Análise de frequência de **cheias**: ajustar uma distribuição às vazões máximas anuais e estimar quantis para TR = 5, 10, 25, 50, 100, 500, 1000 anos.

### Passo a passo
1. Montar a série de **vazões máximas anuais** (máximo diário de cada ano) — série anual (AMS).
2. Estatística descritiva: média $\bar{x}$, desvio $s$, assimetria.
3. Posição de plotagem empírica (Weibull): $P = m/(n+1)$, ordem **decrescente**; $TR = 1/P$.
4. Ajustar distribuições teóricas candidatas: **Gumbel (EV1)**, **Log-Normal**, **GEV**, **Log-Pearson III**.
5. **Gumbel** (máximos), por fator de frequência:

$$x_{TR} = \bar{x} + K_{TR}\,s$$
$$K_{TR} = -\frac{\sqrt{6}}{\pi}\left[0,5772 + \ln\!\left(\ln\frac{TR}{TR-1}\right)\right]$$

(ou, na forma direta: $y_{TR} = -\ln[-\ln(1-1/TR)]$, $x_{TR} = u + \alpha\,y_{TR}$, com $\alpha = s\sqrt6/\pi$ e $u = \bar x - 0,5772\,\alpha$.)

6. Escolher a melhor PDF por aderência (qui-quadrado, Kolmogorov-Smirnov, ou inspeção do papel de probabilidade).
7. Calcular $Q_{TR}$ para TR = 5, 10, 25, 50, 100, 500, 1000.
8. Plotar Q × TR (eixo TR em log) com pontos empíricos e curva ajustada (ver figura de análise de frequência do material).

### Discutir
- Qual distribuição aderiu melhor e por quê.
- Intervalo de confiança / incerteza na extrapolação para TR alto (1000 anos com série curta = grande incerteza).
- Comparar magnitudes com outras bacias.

---

## 9. Curvas IDF para a região

### Conceito
IDF relaciona **Intensidade × Duração × Frequência (TR)** da chuva:

$$i = \frac{a\,TR^{\,b}}{(t_d + c)^{\,d}}$$

(i em mm/h; $t_d$ duração em min; TR em anos; a, b, c, d parâmetros locais).

### Caminho recomendado (ITA → Lorena/SP, vale do Paraíba)
**Opção A (usar IDF pronta):** obter os parâmetros a, b, c, d para a estação mais próxima via:
- **IDF-BR / Pluvio** (GPRH – UFV);
- **IDFGEO** (gphidro.shinyapps.io/idfgeo/);
- Equações IDF do SGB/CPRM ou tabelas (Tucci, 1993).

**Opção B (construir a IDF):**
1. Série de **precipitação diária máxima anual** (> 10 anos) — HidroWeb.
2. Para cada ano, extrair as máximas anuais de várias durações.
3. Ajustar distribuição (Gumbel / log-normal / Log-Pearson III) para cada duração.
4. Estimar chuvas máximas para TR = 5, 10, 20, 50, 100, 1000 (e os do projeto).
5. Desagregar a chuva diária em durações sub-diárias (relações de desagregação CETESB/Pfafstetter, ex.: 24h→1h, 30min etc.) quando só houver dado diário.
6. Ajustar os parâmetros a, b, c, d por regressão não-linear.

### Passo a passo de uso
- Para cada TR (5,10,25,50,100,500,1000), variar $t_d$ e plotar **i × duração**, uma curva por TR.

### Discutir
- Parâmetros obtidos × cidades de referência (POA, SP, RJ, Curitiba) da tabela do material.
- Por que a IDF da sua região difere (regime de chuvas, relevo, continentalidade).

---

## 10. Chuva de projeto (hietograma) para TR = 10 e 100 anos

### Conceito
Sequência temporal de precipitação capaz de provocar a cheia de projeto associada a um TR. Método padrão: **Blocos Alternados** (precisa da IDF).

### Passo a passo (Blocos Alternados)
1. Definir a **duração total** da chuva (geralmente = **tc** da bacia) e o número de intervalos **n**; discretização $\Delta t = t_d/n$.
2. Para cada duração acumulada $t_k = k\,\Delta t$ (k=1..n), calcular a **intensidade** pela IDF no TR desejado.
3. Calcular a **profundidade acumulada** $P_k = i_k \cdot t_k$.
4. **Incrementos** de cada bloco: $\Delta P_k = P_k - P_{k-1}$.
5. **Reordenar** os incrementos: maior bloco no centro, demais alternados antes/depois (padrão intermediário). Pode-se gerar também padrão adiantado e atrasado.
6. Repetir para **TR = 10 anos** e **TR = 100 anos**.

### (Opcional) acoplar à transformação chuva-vazão
- Passar a chuva de projeto por SCS-CN (chuva efetiva) e convoluir com o HU → **hidrograma de projeto** para cada TR.

### Discutir
- Diferença de volume e pico entre TR 10 e 100.
- Sensibilidade ao padrão temporal (adiantado/intermediário/atrasado).
- Comparar o pico estimado por chuva-vazão com o $Q_{TR}$ da análise de frequência (etapa 8) — coerência entre os dois caminhos.

---

## 11. Estrutura do relatório (itens básicos)

1. **Capa** — disciplina HID-41, ITA, título, autores, data.
2. **Resumo** — objetivo, métodos, principais resultados (Q90/Q50/Q10, BFI, Q7,10, Q100, etc.) em ~150–250 palavras.
3. **Sumário**.
4. **Introdução** — contexto hidrológico, importância das análises, caracterização da bacia de estudo.
5. **Objetivos** — geral e específicos (um por etapa).
6. **Metodologia** — descrever cada etapa (1 a 10) com as fórmulas deste documento, fonte dos dados e ferramentas (Python/Excel/QGIS).
7. **Resultados** — gráficos e tabelas: curva de permanência, separação de escoamentos, HUs, hidrogramas simulados, Q7,10, curva-chave, Q×TR, IDF, hietogramas.
8. **Discussão** — interpretação, comparação entre etapas e com outras regiões/bibliografia.
9. **Conclusões** — síntese e implicações para gestão/projeto.
10. **Referências** — Collischonn & Dornelles (cap. 14, 15, 18); Eckhardt (2005); Tucci; ANA/HidroWeb; etc.

---

## 12. Resumo de fórmulas (cola rápida)

| Etapa | Fórmula-chave |
|---|---|
| Permanência | $P=m/(n+1)$, ordem decrescente |
| Eckhardt | $b_i=\frac{(1-BFI_{max})a\,b_{i-1}+(1-a)BFI_{max}\,y_i}{1-a\,BFI_{max}}$ |
| Recessão | $a=e^{-\Delta t/k}$; $k=\frac{-\Delta t}{\ln(Q_{t+\Delta t}/Q_t)}$ |
| HU observado | $u_i=Q_i/h_{mm}$, $h_{mm}=V/A$ |
| tc Kirpich | $t_c=57(L^3/\Delta h)^{0,385}$ [min] |
| tc Watt&Chow | $t_c=7,68(L/S^{0,5})^{0,79}$ [min] |
| HU SCS | $t_p=0,6t_c$; $T_p=t_p+d/2$; $Q_p=0,208A/T_p$ |
| SCS-CN | $S=25400/CN-254$; $I_a=0,2S$; $Q=(P-I_a)^2/(P-I_a+S)$ |
| Convolução | $Q_n=\sum_j P_j\,u_{n-j+1}$ |
| Curva-chave | $Q=a(h-h_0)^b$ |
| Gumbel | $x_{TR}=\bar x+K_{TR}s$; $K_{TR}=-\frac{\sqrt6}{\pi}[0,5772+\ln(\ln\frac{TR}{TR-1})]$ |
| IDF | $i=aTR^b/(t_d+c)^d$ |
| Blocos alt. | $\Delta P_k=i_k t_k - i_{k-1}t_{k-1}$ |

---

*Observação: as constantes/posições de plotagem (Weibull) e a forma de Gumbel seguem a convenção do livro-texto da disciplina. Confirme com a Profa. a distribuição preferida para vazões máximas (Gumbel vs. GEV/Log-Pearson III) e o valor de BFI_max adequado ao tipo de aquífero da sua bacia antes de fechar os números.*
