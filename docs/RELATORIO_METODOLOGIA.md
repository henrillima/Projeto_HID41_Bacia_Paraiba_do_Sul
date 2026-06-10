# Relatório Metodológico — Análise Hidrológica da Bacia do Paraíba do Sul

> Documento técnico mestre, escrito como insumo único para produção do relatório
> final em LaTeX. Todas as decisões, parâmetros, fórmulas, resultados numéricos
> e limitações da metodologia adotada estão consolidadas aqui. Os dados que
> aparecem neste texto refletem o estado do banco de dados do projeto na data
> da última execução do pipeline e podem ser reproduzidos integralmente a
> partir do código-fonte e dos arquivos de configuração indicados.

---

## Sumário

1. Identificação do trabalho
2. Caracterização da bacia hidrográfica
3. Fontes de dados — ANA HidroWebService REST
4. Estações utilizadas
5. Projeto 1 — análise pluviométrica
6. Projeto 2 / Fase 1 — fluviometria e curva-chave
7. Projeto 2 / Fase 2 — regime de vazões
8. Projeto 2 / Fase 3 — eventos chuva-vazão e hidrograma unitário
9. Projeto 2 / Fase 4 — frequência, IDF e chuva de projeto
10. Validação cruzada com a Parte 1 do projeto
11. Premissas e limitações
12. Resultados-chave (tabela executiva)
13. Referências bibliográficas
14. Apêndices

---

## 1. Identificação do trabalho

**Disciplina.** HID-41 — Hidrologia e Drenagem, Instituto Tecnológico de
Aeronáutica (ITA).

**Docente.** Profa. Dra. Danielle de Almeida Bressiani.

**Grupo.** Henri Leonardo dos Santos Lima · Pedro Feitosa Gutemberg · Gustavo
Vidal Feitosa.

**Bacia de estudo.** Sub-bacia do Rio Buquira, afluente da margem esquerda do
Rio Paraíba do Sul, cabeceira da Unidade de Gerenciamento de Recursos Hídricos
URGHI 2, estado de São Paulo. A área de drenagem até o exutório oficial do
estudo (estação fluviométrica ANA 58142200 — Buquirinha II) é de **407 km²**
no inventário ANA e **410,08 km²** no dataset CABra (catchment 318), valor
adotado nas análises físicas.

**Escopo dos Projetos 1 e 2.**

- **Projeto 1** — Análise pluviométrica clássica de séries históricas: ingestão
  e crítica dos dados; construção das séries diária, mensal e anual; tratamento
  de falhas por dois métodos comparáveis (regressão linear múltipla e
  ponderação pelo inverso da distância — IDW); estatísticas descritivas e
  histogramas por estação.
- **Projeto 2** — Hidrologia quantitativa do exutório da bacia, dividida em
  quatro fases sequenciais:
  - **Fase 1** — coleta e consolidação de vazão/cota; ajuste e aplicação da
    curva-chave; construção das séries fluviométricas mensal e anual.
  - **Fase 2** — caracterização do regime: curva de permanência, filtro
    digital de Eckhardt para separação de escoamentos e estimativa da vazão
    mínima ecológica $Q_{7,10}$.
  - **Fase 3** — isolamento de eventos chuva–vazão, ajuste do hidrograma
    unitário observado e comparação com o hidrograma unitário sintético do
    Soil Conservation Service (SCS).
  - **Fase 4** — análise de frequência das vazões máximas anuais, IDF
    regional e chuva de projeto pelo método dos blocos alternados.

**Período de análise.** Para o Projeto 1, séries pluviométricas de 1970 a 2025
(quando disponíveis). Para o Projeto 2, série fluviométrica restrita à janela
**1979-01-01 a 2025-12-31** — o trecho 1970–1978 do registro da Buquirinha II
contém um platô artificial (cotas constantes registradas pela ANA na fase de
implantação da estação), que produz eventos com coeficiente de escoamento
superior a um (fisicamente impossível) e enviesa as máximas anuais; o
truncamento é uma decisão metodológica explícita justificada na seção 6.1.

---

## 2. Caracterização da bacia hidrográfica

### 2.1 Localização

O Rio Buquira nasce nas vertentes da Serra da Mantiqueira em Monteiro
Lobato/SP (coordenadas aproximadas 22°56′04″ S, 45°40′52″ O) e drena no
sentido norte-sul até desaguar no Rio Paraíba do Sul em São José dos Campos
(SJC). A estação fluviométrica que define o exutório do estudo está
posicionada a:

- Latitude: $-23{,}1247°$
- Longitude: $-45{,}9072°$
- Altitude do gauge: $562{,}81$ m

A bacia é caracteristicamente **serrana**: as cabeceiras na Mantiqueira
ultrapassam $1\,700$ m e o exutório, no fundo do vale do Paraíba, está a
$\sim 580$ m. O gradiente vertical de $\Delta z \approx 1\,163$ m em apenas
$42$ km de talvegue principal corresponde a uma declividade média do canal de
aproximadamente $2{,}76\%$, o que classifica a bacia hidrologicamente como
de resposta rápida a moderada.

### 2.2 Atributos físicos (CABra catchment 318)

O dataset **CABra — Catchment Attributes for Brazil** (Almeida et al., 2021)
identifica a bacia até a estação 58142200 como o catchment de número 318.
Adotamos seus atributos como referência, complementados por medições próprias
sobre a rede hidrográfica recortada à bacia.

| Atributo | Símbolo | Valor adotado | Fonte |
|---|---|---|---|
| Área de drenagem | $A$ | $410{,}08$ km² | CABra `catch_area` (ANA: 407 km²) |
| Elevação mínima (gauge) | — | $562{,}81$ m | CABra `elev_gauge` |
| Elevação média | — | $853{,}39$ m | CABra `elev_mean` |
| Elevação máxima | — | $1\,725{,}54$ m | CABra `elev_max` |
| Desnível do talvegue | $\Delta h$ | $1\,163$ m | $\text{elev\_max} - \text{elev\_gauge}$ |
| Comprimento do talvegue | $L$ | $42{,}1$ km | Medido no QGIS sobre a rede `CABra_drainage` recortada (caminho de fluxo mais longo até o exutório) |
| Declividade do canal | $S = \Delta h / L$ | $0{,}0276$ (2,76 %) | Calculada |
| Declividade do terreno | catch_slope | $23{,}99\%$ | CABra (informativo; não usada nos cálculos) |
| Ordem de Strahler | — | 2 | CABra |

A distinção entre **declividade do canal** ($S = \Delta h/L$) e **declividade
do terreno** (`catch_slope`) é importante: o tempo de concentração é função da
declividade do canal, não do terreno. Usar 23,99% como $S$ no cálculo do tempo
de concentração subestimaria $t_c$ em uma ordem de grandeza.

### 2.3 Uso e cobertura do solo

A composição do uso do solo do catchment, segundo o CABra (com base no
MapBiomas), está concentrada em vegetação remanescente:

- Floresta nativa: 70,0%
- Pasto / vegetação rasteira: 20,9%
- Vegetação arbustiva: 6,9%
- Agricultura: 1,3%
- Áreas urbanas: 0,6%
- Solo exposto: 0,2%
- Corpos d'água: 0,1%

Solo dominante: **Latossolos** (Haplic Ferralsols na nomenclatura WRB),
profundos (~173 cm), textura média (argila 32%, silte 19%, areia 49%). A
combinação Latossolo profundo + cobertura florestal predominante caracteriza
um sistema bem drenado, classificado como **grupo hidrológico B** na tipologia
do NRCS (escolha conservadora — Latossolos profundos podem ser classificados
como grupo A em algumas referências; a sensibilidade ao grupo é discutida na
seção 2.5).

### 2.4 Tempo de concentração

Dois métodos clássicos foram aplicados, com resultados divergentes:

$$t_c^{\text{Kirpich}} = 57 \cdot \left(\frac{L^3}{\Delta h}\right)^{0{,}385}$$

com $L$ em km e $\Delta h$ em m, resultando em $t_c$ em minutos. Para a bacia:
$t_c^{\text{Kirpich}} = 282{,}9$ min $\approx 4{,}7$ h.

$$t_c^{\text{Watt\&Chow}} = 7{,}68 \cdot \left(\frac{L}{\sqrt{S}}\right)^{0{,}79}$$

com $L$ em km e $S$ adimensional (declividade do canal), $t_c$ em minutos.
Para a bacia: $t_c^{\text{W\&C}} \approx 612$ min $\approx 10{,}2$ h.

Os dois métodos divergem por um fator próximo de dois. Watt & Chow foi
calibrado para bacias canadenses de até ≈ 5 840 km² e, em princípio,
seria mais apropriado para a faixa intermediária de área da Buquira; Kirpich
(1940) foi calibrado em bacias agrícolas pequenas (< 30 km²) e é
frequentemente reportado como subestimador para áreas maiores.

**Decisão adotada.** A análise principal usa **Kirpich** ($t_c = 282{,}9$ min;
configuração `bacia.tc_metodo: kirpich` em `pipeline/config.yaml`), por:

1. coerência com o tempo de pico observado no hidrograma unitário derivado dos
   eventos reais (Seção 8.4) — apesar das limitações de comparação direta
   entre escalas temporais (Seção 8.6);
2. preservar consistência com o material didático da disciplina.

Em uma análise de drenagem urbana real, recomendaríamos reportar ambos como
sensibilidade e adotar o conservador para dimensionamento de obras.

### 2.5 Curve Number (NRCS TR-55)

O parâmetro CN do método SCS-CN é necessário para a conversão chuva–chuva
efetiva no cálculo do hidrograma de cheia. A estimativa segue o procedimento
TR-55 (NRCS, 1986), aplicado à composição de uso/solo da bacia (Seção 2.3) sob
condição antecedente de umidade média (AMC-II):

- Floresta nativa em solo grupo B: $CN \approx 55$–$60$
- Pastagem em solo grupo B (boa condição): $CN \approx 61$–$69$
- Vegetação arbustiva em solo grupo B: $CN \approx 48$–$56$

Aplicando os percentuais de cobertura como pesos:

$$CN_{\text{composto}} \approx 0{,}70 \cdot 58 + 0{,}21 \cdot 65 + 0{,}07 \cdot 52 + 0{,}013 \cdot 78 + \ldots \approx 60$$

**Valor adotado: $CN = 60$ (AMC-II)**, configuração `bacia.cn_amc2: 60`.

**Sensibilidade ao grupo hidrológico.** Se o Latossolo for reclassificado
como **grupo A** (mais permeável), o CN composto cai para aproximadamente 33.
Como o método SCS-CN é altamente sensível a esse parâmetro (a capacidade de
retenção potencial $S$ varia inversamente com $CN$), a faixa de incerteza no
volume escoado é grande e deve ser reportada em qualquer dimensionamento de
estrutura crítica.

---

## 3. Fontes de dados — ANA HidroWebService REST

### 3.1 Migração SOAP/ZIP → REST

O projeto migrou completamente a ingestão de dados do legado (download manual
de arquivos ZIP do portal SNIRH/Hidroweb) para o **HidroWebService REST**, o
serviço REST oficial publicado pela Agência Nacional de Águas e Saneamento
Básico (ANA). A migração trouxe três ganhos:

1. **Atualização incremental** sem download manual de ZIPs;
2. **Padronização da consistência** (`Nivel_Consistencia` da ANA é honrado
   diretamente no JSON retornado, eliminando ambiguidades de parsing);
3. **Cache local idempotente** de JSONs em `pipeline/data/raw_v2/`, permitindo
   re-execuções do pipeline sem hits desnecessários no serviço.

O caminho legado é mantido como fallback (`python pipeline.py --via local`)
para o cenário em que a API REST esteja indisponível.

### 3.2 Endpoints utilizados

| Endpoint | Função no projeto |
|---|---|
| `/EstacoesTelemetricas/OAUth/v1` | Autenticação por usuário + senha; retorna Bearer token JWT |
| `/EstacoesTelemetricas/HidroInventarioEstacoes/v1` | Inventário de estações por UF e código de bacia; usado para descoberta de candidatas a exutório e pluviômetros |
| `/EstacoesTelemetricas/HidroSerieChuva/v1` | Série diária de precipitação (mm) |
| `/EstacoesTelemetricas/HidroSerieVazao/v1` | Série diária de vazão (m³/s) |
| `/EstacoesTelemetricas/HidroSerieCotas/v1` | Série diária de cotas linimétricas (cm) |
| `/EstacoesTelemetricas/HidroSerieResumoDescarga/v1` | Medições pontuais de descarga (curva-chave) |
| `/EstacoesTelemetricas/HidroSerieCurvaDescarga/v1` | Curvas-chave oficiais da ANA, para referência |

### 3.3 Autenticação

O HidroWebService REST exige cadastro prévio com CPF e e-mail junto à ANA
(`hidro@ana.gov.br`). A autenticação é por par usuário/senha, que retorna um
**Bearer token JWT** com **TTL de 60 minutos**. O cliente Python implementado
em `pipeline/src/ana_client.py` cacheia o token em
`pipeline/.cache/hidroweb_token.json` (TTL operacional de 55 min, margem de
segurança) e renova-o automaticamente quando expira.

### 3.4 Cache, retries e limites operacionais

Parâmetros adotados (`pipeline/config.yaml`, bloco `ana_api`):

- **Rate limit:** 2 requisições/segundo (margem para evitar bloqueio de IP
  pelo serviço).
- **Retries:** até 4 tentativas em respostas HTTP 429 (rate limit) ou 5xx
  (erro do servidor), com backoff exponencial.
- **Timeout:** 90 s por requisição (alguns endpoints, particularmente o
  inventário com UF + código de bacia, podem demorar > 30 s).
- **Janelas de série:** as séries diárias são divididas em janelas de 365
  dias pelo cliente para respeitar o limite por requisição do serviço.

### 3.5 Níveis de consistência da ANA

Cada dia da série diária na ANA carrega um campo `Nivel_Consistencia`:

- `1` — Dado **bruto**, ainda não revisado pela ANA;
- `2` — Dado **consistido**, revisado pela equipe da ANA.

Quando o mesmo dia aparece com ambos os níveis na série retornada (caso comum
em estações com revisão parcial), o pipeline **mantém o nível 2** como
valor canônico, descartando o registro nível 1 da mesma data. Esse
comportamento é implementado em `pipeline/src/fluvio_parser.py::consolidar_serie_diaria_fluvio`.

---

## 4. Estações utilizadas

### 4.1 Projeto 1 — Pluviômetros de referência

A análise pluviométrica do Projeto 1 usa três estações fixas, escolhidas no
início do projeto pela combinação de cobertura temporal longa, períodos
sobrepostos suficientes para preenchimento por regressão e distribuição
espacial razoável dentro do sistema de cabeceiras do Paraíba do Sul:

| Código ANA | Nome | Lat | Lon | Altitude (m) | Papel |
|---|---|---|---|---|---|
| **2245048** | Pindamonhangaba | $-22{,}9111$ | $-45{,}4694$ | 524 | **Referência** |
| 2245055 | Estrada do Cunha | $-22{,}9961$ | $-45{,}0433$ | 790 | Auxiliar |
| 2345065 | São Luís do Paraitinga | $-23{,}2392$ | $-45{,}3056$ | 760 | Auxiliar |

A estação de **referência** é aquela cuja série passa pelo processo de
preenchimento de falhas (Seção 5.3–5.5). As estações auxiliares fornecem os
preditores usados no preenchimento.

### 4.2 Projeto 2 — Exutório fluviométrico

| Atributo | Valor |
|---|---|
| Código ANA | **58142200** |
| Nome | BUQUIRINHA II |
| Operadora | SGB-CPRM (Serviço Geológico do Brasil) |
| Latitude | $-23{,}1247°$ |
| Longitude | $-45{,}9072°$ |
| Área de drenagem (CABra) | 410,08 km² |
| Período da série na ANA | 1970-01-01 a 2023-03-31 |
| Período adotado no estudo | **1979-01-01 a 2023-03-31** (44,2 anos efetivos) |
| Percentual de falhas (vazão) | **0,33%** |

A estação foi **fixada** em `pipeline/config.yaml → fluviometria.exutorio_codigo`
e não é resultado de seleção automática. Essa decisão é deliberada: o exutório
oficial do trabalho é o mesmo da **Parte 1** do projeto (Excel entregue na
disciplina), garantindo comparabilidade direta dos resultados. A interface
`/selecao-fluvio` do BI permite inspecionar dados base de estações
fluviométricas usadas, mas não executa seleção automática.

### 4.3 Projeto 2 — Pluviômetros para chuva sobre a bacia

A chuva média da bacia, usada nas análises de chuva-vazão da Fase 3 (Seção
8), exige estações pluviométricas **dentro ou imediatamente próximas** ao
contorno da sub-bacia do Buquira. As três estações do Projeto 1 não atendem
a esse requisito: estão a 51, 63 e 90 km do exutório, todas no fundo do vale
do Paraíba, sem cobrir a cabeceira serrana onde precipitação orográfica é
dominante.

A solução adotada foi introduzir um **segundo conjunto de pluviômetros**
exclusivos da Fase 3, denominado **P2**. O conjunto P2 foi selecionado por
critério geográfico (distância ≤ 30 km do exutório) e temporal (≥ 25 anos
de dados, com cobertura recente — dados além de 2020). As três estações
ativas, registradas em `config_pluviometros_p2`, são:

| Código ANA | Nome | Operadora | Lat | Lon | Alt (m) | Distância ao exutório | Período |
|---|---|---|---|---|---|---|---|
| 2245054 | MONTEIRO LOBATO | SGB-CPRM | $-22{,}9333$ | $-45{,}8333$ | 680 | 22,6 km (cabeceiras norte) | 1970–2024 |
| 2345071 | SANTA BRANCA | SGB-CPRM | $-23{,}3692$ | $-45{,}9003$ | 573 | 27,2 km (jusante leste) | 1952–2024 |
| 2345106 | UHE SANTA BRANCA BARRAMENTO | LIGHT | $-23{,}3733$ | $-45{,}8700$ | 627 | 27,9 km (jusante leste) | 1955–2026 |

A combinação cobre: (a) **cabeceiras serranas** ao norte da bacia
(Monteiro Lobato, próxima às nascentes do Buquira), (b) **jusante leste**
junto ao Paraíba do Sul (Santa Branca, duas operadoras independentes em
proximidade — útil para verificação cruzada de qualidade). As três estações
têm dados continuados até o presente (2024–2026), permitindo análises sobre
toda a janela temporal do estudo.

A **chuva média da bacia** é calculada como a média aritmética simples das
três séries diárias de P2 para cada dia em que pelo menos uma das três
estações tem registro. Estendê-la a um esquema de Thiessen ponderado por área
ou IDW é uma melhoria metodológica natural mas que foi avaliada como ganho
marginal frente à dispersão real do sinal — a opção adotada está descrita
em `pipeline/pipeline_fluvio.py::_carregar_chuva_media_bacia`.

### 4.4 Isolamento técnico P1 / P2 no banco de dados

Para garantir que as análises do Projeto 1 (BI público em `/estacoes`,
`/dashboard`, `/series` etc.) não sejam contaminadas pelos pluviômetros do
Projeto 2, foi adicionada uma coluna `projeto VARCHAR(2)` na tabela
`estacoes` do banco PostgreSQL/Supabase, com valores `'P1'` ou `'P2'`. A
view `resumo_estacoes` (consumida pelo Projeto 1) inclui o filtro
`WHERE projeto = 'P1'`, isolando o conjunto. As séries diárias de chuva
de ambos os projetos compartilham a tabela `precipitacao_diaria`; a Fase
3 do Projeto 2 filtra explicitamente por `config_pluviometros_p2.ativo = TRUE`
ao buscar dados (Seção 8.1).

---

## 5. Projeto 1 — Análise pluviométrica

### 5.1 Construção das séries temporais

A partir das séries diárias retornadas pela API REST, o pipeline constrói
três séries derivadas por estação:

- **Série diária:** valores diretos da ANA, com `consistencia` ∈ {1, 2}.
  Valores negativos são tratados como ausentes (NaN). Datas inválidas
  (exemplo: "31 de fevereiro") são descartadas via `pandas.to_datetime(...,
  errors='coerce')`.
- **Série mensal:** soma dos valores diários do mês. Um mês é marcado como
  **inválido** quando o percentual de dias sem registro excede $5{,}0\%$
  (parâmetro `processamento.max_falhas_pct` = 5,0 em `config.yaml`). Meses
  inválidos são excluídos das somas anuais.
- **Série anual:** soma das doze somas mensais válidas do ano. Um ano é
  considerado **válido** somente se **todos os doze meses** forem válidos.

O limiar de 5% por mês foi adotado como ponto de equilíbrio entre rigor
estatístico (permitir agregar somente meses com cobertura suficiente) e
preservação dos anos: limites mais rigorosos (1–2%) descartariam fatias
significativas da série; limites mais frouxos (10–15%) introduziriam viés
nas somas mensais por compensação de dias faltantes.

### 5.2 Preenchimento de falhas — visão geral

O pipeline implementa **dois métodos independentes** de preenchimento e
seleciona automaticamente o vencedor por critério objetivo:

1. **Regressão linear múltipla** sobre os dias com registro nas estações
   auxiliares (Seção 5.3);
2. **Inverse Distance Weighting (IDW)** com ponderação pelo inverso do
   quadrado da distância (Seção 5.4).

A comparação é feita sobre um **holdout** comum a ambos os métodos: 10% dos
dias do período sobreposto entre as três estações são separados
aleatoriamente (com semente fixa `random_state = 42`, garantindo
reprodutibilidade) e usados exclusivamente para avaliação. Os outros 90% são
usados para ajuste/aplicação. O método com **menor RMSE no holdout** é
declarado vencedor e aplicado à série final.

### 5.3 Regressão linear múltipla

A equação ajustada por mínimos quadrados ordinários é:

$$P_{\text{ref}}(t) = \beta_0 + \sum_{i=1}^{n_{\text{aux}}} \beta_i \cdot P_i(t)$$

onde $P_{\text{ref}}(t)$ é a precipitação na estação de referência no dia
$t$, $P_i(t)$ são as precipitações nas estações auxiliares (no caso, $n_{\text{aux}}=2$),
e $\beta_0, \beta_1, \ldots, \beta_n$ são os coeficientes estimados.

O modelo só é aplicado a um dia em que **todas as estações auxiliares** têm
registro. Dias em que alguma auxiliar falta caem para o IDW (que tolera
preenchimento parcial — basta uma auxiliar disponível).

### 5.4 IDW (Inverse Distance Weighting)

A interpolação espacial pelo inverso da distância pondera as estações
auxiliares pela proximidade haversine ao ponto de referência:

$$P_{\text{ref}}(t) = \frac{\displaystyle\sum_{i \in A(t)} P_i(t) \cdot d_i^{-p}}{\displaystyle\sum_{i \in A(t)} d_i^{-p}}$$

onde $A(t)$ é o subconjunto de auxiliares com dado no dia $t$, $d_i$ é a
distância haversine entre a estação $i$ e a estação de referência (km), e
$p$ é o expoente. Adotamos $p = 2$ (configuração `processamento.idw_expoente`).

A distância haversine entre dois pontos $(\varphi_1, \lambda_1)$ e
$(\varphi_2, \lambda_2)$ na superfície terrestre é:

$$a = \sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos\varphi_1 \cdot \cos\varphi_2 \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$d = 2 R \cdot \arctan2\left(\sqrt{a}, \sqrt{1-a}\right)$$

com $R = 6\,371$ km (raio médio da Terra).

### 5.5 Validação por holdout

Cada método é treinado/aplicado apenas sobre os 90% de treino e avaliado
sobre o mesmo conjunto de holdout (10%, semente 42). As métricas reportadas:

- **RMSE** no holdout (mm) — critério primário de seleção;
- **$R^2$** no treino (apenas regressão).

### 5.6 Resultados obtidos para a estação de referência

Para a estação **2245048 — Pindamonhangaba** (referência):

| Método | RMSE no holdout (mm) | Dias preenchidos | $R^2$ no treino |
|---|---|---|---|
| Regressão linear múltipla | **7,30** | 501 | 0,2917 |
| IDW ($p = 2$) | 7,64 | 501 | — |

Método vencedor: **regressão linear múltipla**, pelo menor RMSE no holdout
(7,30 < 7,64). A equação ajustada para Pindamonhangaba foi:

$$P_{2245048}(t) = 0{,}2306 \cdot P_{2245055}(t) + 0{,}3635 \cdot P_{2345065}(t) + 1{,}3689$$

Os 501 dias da série diária com falha original foram preenchidos com a
equação acima e recebem `preenchido = TRUE` e `metodo = 'regressao'` no
banco. A coluna `valor` carrega o valor preenchido; a flag preserva a
rastreabilidade.

Para as estações auxiliares, a mesma comparação foi feita aplicando a
mesma metodologia (apenas trocando o papel: a estação a ser preenchida vira
referência local, as outras duas viram auxiliares). Em todas as três
estações, a **regressão venceu** o IDW no holdout, embora por margem
pequena (compatível com a literatura: regressão capta covariação direta;
IDW assume isotropia espacial que nem sempre se verifica em sistemas
serranos).

### 5.7 Histogramas e estatísticas descritivas

Para cada uma das quatro séries por estação (diária, mensal, anual, máxima
diária anual), o pipeline calcula:

- **Histograma** com 30 classes uniformes (parâmetro
  `processamento.histograma_bins`);
- Conjunto de **16 estatísticas descritivas**: média, mediana, desvio
  padrão, mínimo, máximo, P10, P25, P50, P75, P90, P95, P99, coeficiente
  de variação, assimetria (Pearson, não-viesada), curtose (em excesso) e
  contagem de observações com sua porcentagem de falhas.

A assimetria positiva pronunciada na distribuição diária ($\mu \approx 9{,}9$
mm e mediana $\approx 5{,}7$ mm na referência) reflete o regime típico
brasileiro de poucos eventos extremos contra muitos eventos pequenos. Anos
secos, como **2014** (precipitação total $\approx 617$ mm em Pindamonhangaba
contra média histórica $\approx 1\,400$ mm), são identificáveis na série
anual e podem ser referenciados ao episódio histórico da **crise hídrica do
Sudeste em 2013/2014**.

---

## 6. Projeto 2 / Fase 1 — Fluviometria e curva-chave

### 6.1 Janela de análise

O conjunto fluviométrico bruto da ANA para a estação 58142200 cobre o
período **1970-01-01 a 2023-03-31**. No entanto, o trecho **1970–1978**
contém um artefato sistemático: as cotas registradas formam um platô em
$\approx 1{,}50$ m com variabilidade quase nula, característica de série
implantada sem leituras reais (cota constante registrada por convenção até
o início efetivo das observações). A conversão dessas cotas constantes
pela curva-chave produz vazões artificialmente uniformes ($\approx 7$ m³/s)
que:

1. inflam falsamente o número de eventos isolados na Fase 3, gerando
   "eventos" com lâmina escoada $h$ próxima de zero mas $P_{\text{total}}$
   pequena, levando a coeficientes de escoamento $h / P_{\text{total}} > 1$
   (fisicamente impossível);
2. influenciam a curva de permanência puxando os quantis intermediários;
3. introduzem máximos anuais espúrios na AMS de cheias.

**Decisão metodológica:** truncar a série em **1979-01-01** (configuração
`fluviometria.data_inicio: "1979-01-01"`). A janela efetiva passa a ser de
**44,2 anos** (1979-01-01 a 2023-03-31), com 0,33% de falhas no campo
vazão. Esta decisão é registrada no comentário do `config.yaml` e
referenciada nas seções 8.2 e 9.1.

### 6.2 Coleta dos dados fluviométricos

Para a estação fixada como exutório, o pipeline baixa via REST (Seção 3.2):

1. **Série diária de vazão** (`HidroSerieVazao/v1`): 16 161 dias entre
   1979-01 e 2023-03, dos quais 16 108 com valor não-nulo (0,33% de
   falhas).
2. **Série diária de cotas** (`HidroSerieCotas/v1`): 16 161 dias.
3. **Medições pontuais de descarga** (`HidroSerieResumoDescarga/v1`): 354
   medições cota–vazão históricas, usadas como base para o ajuste da
   curva-chave.
4. **Curvas oficiais da ANA** (`HidroSerieCurvaDescarga/v1`): 22 versões
   históricas, mantidas no banco para referência mas não usadas como
   ferramenta de conversão (o pipeline gera sua própria curva ajustada).

### 6.3 Ajuste da curva-chave por função potência

O ajuste segue a forma clássica de Collischonn & Dornelles (2013, cap. 14):

$$Q = a \cdot (h - h_0)^b$$

onde $Q$ é a vazão (m³/s), $h$ é a cota observada (m), $h_0$ é a cota
correspondente a vazão nula (não necessariamente o zero da régua
linimétrica), e $a, b$ são os parâmetros a ajustar.

O procedimento adotado (`pipeline/src/rating_curve.py`) é em duas etapas:

1. **Grid-search de $h_0$**: variando $h_0$ no intervalo $[0, h_{\min})$
   com passo de 5 cm (configuração `rating_curve.h0_step_cm`), ajusta-se
   um modelo linear $\ln Q = \ln a + b \cdot \ln(h - h_0)$ por mínimos
   quadrados ordinários e mantém-se o $h_0$ que minimiza a soma dos
   quadrados dos resíduos no log.
2. **Refino de $(a, b)$ na escala natural**: a partir dos valores
   iniciais obtidos na etapa anterior, ajusta-se o modelo não-linear
   $Q = a \cdot (h - h_0)^b$ via `scipy.optimize.curve_fit` (Levenberg–
   Marquardt). Este refino corrige a tendência sistemática introduzida
   pelo ajuste em log (heterocedasticidade que penaliza desproporcionalmente
   valores baixos de $Q$).

**Resultado para a estação 58142200:**

| Parâmetro | Valor |
|---|---|
| $a$ | **3,0235** |
| $b$ | **2,036** |
| $h_0$ | **0,05 m** |
| $h_{\min}$ observada | 0,98 m |
| $h_{\max}$ observada | 3,48 m |
| Coeficiente de determinação $R^2$ | **0,9432** |
| RMSE (m³/s) | 1,352 |
| Número de medições | 354 |

A curva ajustada explica 94,3% da variância das vazões medidas a partir das
cotas, com erro típico de 1,35 m³/s — desempenho consistente com curvas
publicadas para estações da bacia do Paraíba do Sul. O p-valor do teste de
Kolmogorov–Smirnov sobre os resíduos normalizados é 0,0001 (rejeita
normalidade); isto é esperado e não invalida o ajuste — a forma potência
não assume resíduos normais, e o teste serve apenas como diagnóstico.

### 6.4 Aplicação da curva-chave

Após o ajuste, a curva é aplicada à série de **cotas** para preencher dias
em que há cota registrada mas vazão ausente:

$$Q_{\text{preenchido}}(t) = a \cdot (h(t) - h_0)^b, \quad \text{se } h_{\min} \le h(t) \le h_{\max}$$

Cotas fora do intervalo observado $[h_{\min}, h_{\max}]$ não são extrapoladas
(o pipeline mantém NaN), evitando estimativas em região onde a curva não
foi calibrada. Na janela adotada, **559 dias** dos 576 candidatos
(elegíveis para preenchimento) foram preenchidos com sucesso pela curva-chave.

Dias com vazão preenchida recebem `preenchido = TRUE` e
`metodo = 'curva_chave'` no banco.

### 6.5 Construção das séries mensal e anual

A partir da série diária consolidada de vazão (observada + preenchida pela
curva-chave), o pipeline calcula:

- **Série mensal:** média, mínimo e máximo diários do mês. Um mês é
  inválido se mais de 5% dos dias têm vazão ausente;
- **Série anual:** estatísticas anuais derivadas das séries mensais
  válidas; um ano só é válido se todos os 12 meses são válidos.

Diferentemente da pluviometria, a vazão é uma grandeza de **fluxo
instantâneo** (m³/s), não cumulativa. Por isso a série mensal usa **médias**,
não somas (somar vazões diárias produziria uma quantidade adimensional sem
significado físico). Volumes mensais escoados, se necessários, são obtidos
multiplicando a vazão média mensal por 86 400 s e pelo número de dias do
mês.

---

## 7. Projeto 2 / Fase 2 — Regime de vazões

### 7.1 Curva de permanência (Weibull)

A curva de permanência caracteriza a distribuição empírica de vazões
ordenadas: para cada percentil $p$ ∈ (0, 100), o valor $Q_p$ corresponde
à vazão que é igualada ou excedida em $p\%$ do tempo. O método de plotagem
de Weibull foi adotado (`regime.permanencia.metodo_plotting: weibull`):

1. Tomam-se todas as $n$ vazões diárias válidas da série;
2. Ordenam-se em **ordem decrescente**, atribuindo a posição $m = 1, 2, \ldots, n$;
3. A probabilidade de excedência empírica é
   $$p_m = \frac{m}{n+1} \cdot 100$$
4. Interpola-se linearmente $Q$ nos percentis-alvo (Q5, Q10, Q25, Q50, Q75,
   Q90, Q95, Q99) e gera-se a curva completa com passo de 0,5%.

**Resultados para a estação 58142200**, janela 1979–2023:

| Percentil $p$ (%) | $Q_p$ (m³/s) | Interpretação |
|---|---|---|
| Q1 | 31,63 | Vazões muito altas, raras |
| Q5 | 20,91 | Pico anual médio |
| Q10 | **15,68** | Vazões altas frequentes |
| Q25 | 10,20 | Vazões superiores |
| Q50 | **6,99** | Mediana de longo prazo |
| Q75 | 5,00 | Vazões inferiores |
| Q90 | **3,99** | Vazão de outorga padrão (ANA/CETESB) |
| Q95 | 3,37 | Vazão de estiagem |
| Q99 | 2,64 | Mínimos extremos |

**Indicadores derivados:**

- **Razão $Q_{10}/Q_{90} = 3{,}93$** — caracteriza um regime de torrência
  moderada (valores entre 3 e 10 são típicos de bacias serranas brasileiras
  com vegetação preservada);
- **Declividade log da curva** $-0{,}00743$ por unidade de percentil — a
  inclinação leve da curva entre Q10 e Q90 confirma um regime relativamente
  regularizado, coerente com a alta proporção de escoamento de base na
  bacia (Seção 7.2).

O **Q90 = 3,99 m³/s** é a vazão de referência usada pela ANA e pela CETESB
para concessão de outorgas hídricas no estado de São Paulo.

### 7.2 Filtro digital de Eckhardt — separação de escoamentos

A separação do hidrograma observado em escoamento superficial (rápido) e
escoamento de base (lento) é feita pelo filtro digital recursivo proposto
por Eckhardt (2005), que melhora os filtros clássicos de Lyne & Hollick por
incorporar um parâmetro fisicamente significativo: o **BFI máximo**.

A equação recursiva, aplicada em uma única passada para frente sobre a
série, é:

$$b_t = \frac{(1 - \text{BFI}_{\max}) \cdot \alpha \cdot b_{t-1} + (1 - \alpha) \cdot \text{BFI}_{\max} \cdot y_t}{1 - \alpha \cdot \text{BFI}_{\max}}, \quad b_t \le y_t$$

onde $y_t$ é a vazão total no dia $t$, $b_t$ é a parcela de escoamento de
base, e a parcela de escoamento direto é $f_t = y_t - b_t \ge 0$.

A inicialização adota $b_0 = y_0$ (vazão de base no primeiro dia da série
igual à vazão total — hipótese conservadora válida para séries longas, onde
o efeito do transitório se dissipa em poucas semanas).

**Parâmetros adotados:**

- **$\text{BFI}_{\max} = 0{,}80$** (configuração
  `regime.eckhardt.bfi_max_default`). Valor sugerido por Eckhardt (2005)
  para rios perenes com aquífero **poroso** dominante — coerente com a
  geomorfologia da bacia (Latossolos profundos, cobertura florestal
  preservada). Valores alternativos da tabela de Eckhardt: 0,50 para
  aquíferos fraturados em rocha cristalina; 0,25 para rios efêmeros.
- **$\alpha = e^{-\Delta t / k}$** com $\Delta t = 1$ dia. O parâmetro $k$
  é a constante de recessão (dias), estimada por **regressão log-linear**
  $\ln Q_t = \ln Q_0 - t/k$ em janelas contínuas de queda monotônica de
  vazão com pelo menos 5 dias e iniciadas após pelo menos 3 dias **sem
  chuva** (mascaramento via série de chuva média da bacia, Seção 8.1).
  Esse mascaramento evita identificar como "recessão" trechos de queda que
  ainda recebem aporte direto.

  **Resultado:** 26 janelas válidas de recessão; $k = 19{,}76$ dias
  (mediana; intervalo entre 9,98 e 36,28 dias). O $\alpha$ resultante é
  $e^{-1/19{,}76} = 0{,}9506$.

**Métrica reportada:**

$$\text{BFI}_{\text{global}} = \frac{\sum_t b_t}{\sum_t y_t} = \mathbf{0{,}7674}$$

ou seja, **76,7%** do volume total escoado pela bacia ao longo da série é
contribuição do aquífero. Este valor é compatível com a expectativa para uma
bacia florestada sobre Latossolos profundos: a infiltração predomina sobre
o escoamento superficial, e o aquífero regulariza naturalmente o regime.

### 7.3 Q7,10 — vazão mínima ecológica

A vazão de referência para estiagens, $Q_{7,10}$, é definida como a menor
média móvel de 7 dias com período de retorno de 10 anos (ou
equivalentemente, com probabilidade de não-excedência anual de 10%). É a
métrica padrão da ANA e do CONAMA para definir vazões ambientais.

**Procedimento:**

1. **Média móvel de 7 dias** na série de vazão diária (centrada no final
   da janela);
2. **Mínimo anual** por **ano hidrológico** (outubro→setembro, padrão SE
   do Brasil — `regime.q7_10.ano_hidrologico_inicio_mes: 10`), respeitando
   o ciclo natural da estação chuvosa de verão; anos com menos de 300 dias
   válidos de $Q_7$ são descartados;
3. **Ajuste da distribuição Log-Pearson III** ($LP3$) sobre os logaritmos
   naturais dos mínimos anuais, pelo método dos momentos. A LP3 é o padrão
   ANA para vazões de estiagem;
4. **$Q_{7,10}$** é o quantil de probabilidade de não-excedência $p = 0{,}10$
   no espaço $\log Q$, exponenciado para retornar à escala natural.

**Resultado para a estação 58142200:**

| Parâmetro | Valor |
|---|---|
| Número de anos com $Q_7$ válido | 43 |
| $\mu_{\log}$ (média do log da série de mínimos) | 1,287 |
| $\sigma_{\log}$ (desvio do log) | 0,242 |
| $g_{\log}$ (assimetria amostral, $\log Q$) | 0,263 |
| **$Q_{7,10}$** | **2,675 m³/s** |
| p-valor KS contra LP3 ajustada | 0,490 |

O p-valor do teste de Kolmogorov–Smirnov de 0,49 indica que a LP3 é
estatisticamente compatível com a distribuição empírica dos mínimos
anuais (não rejeita a hipótese nula da LP3 com larga margem). O valor
$Q_{7,10} = 2{,}68$ m³/s é a vazão garantida em 90% dos anos hidrológicos
e corresponde a aproximadamente 67% do $Q_{90}$ — coerente com regime
regularizado por aquífero.

---

## 8. Projeto 2 / Fase 3 — Eventos chuva-vazão e hidrograma unitário

### 8.1 Chuva média da bacia

A chuva média sobre a bacia é construída como média aritmética simples
das séries diárias dos três pluviômetros do conjunto P2 (Seção 4.3):

$$\bar{P}(t) = \frac{1}{n_{\text{ativas}}(t)} \sum_{i \in P2(t)} P_i(t)$$

onde $n_{\text{ativas}}(t)$ é o número de estações de P2 com registro no
dia $t$. Quando uma estação tem falha, a média é calculada sobre as duas
restantes — não há imputação de zero, evitando viés à diminuição em
períodos com cobertura parcial.

Implementação: `pipeline/pipeline_fluvio.py::_carregar_chuva_media_bacia`.
A função paginа explicitamente a leitura da tabela `precipitacao_diaria` no
Supabase (PostgreSQL impõe limite default de 1 000 registros por query
sem `range`), assegurando que toda a série seja carregada — característica
crítica em uma janela de 16 161 dias × 3 estações.

### 8.2 Isolamento de eventos

O isolamento de eventos chuva–vazão segue um procedimento em cinco etapas,
implementado em `pipeline/src/event_isolation.py::identificar_eventos`:

1. **Detecção de picos** sobre a série de vazão pela função
   `scipy.signal.find_peaks`:
   - **Proeminência mínima**: $0{,}3 \cdot Q_{95}$. A proeminência é uma
     medida que isola picos das oscilações do nível de base; a constante
     0,3 foi calibrada para capturar eventos de média magnitude sem
     fragmentar eventos longos com múltiplos sub-picos;
   - **Distância mínima entre picos**: 5 dias
     (`eventos.distancia_min_picos_dias: 5`), evitando dupla contagem em
     eventos prolongados.
2. **Recuo até o início do evento**: partindo do dia do pico, o algoritmo
   anda para trás enquanto $Q$ ainda estiver subindo monotonicamente; o
   último mínimo local antes da subida marca o início do evento.
3. **Avanço até o fim do evento**: a partir do pico, avança $D$ dias, onde
   $D$ é o **base-time SCS**:
   $$D = 0{,}827 \cdot A^{0{,}2} \quad [\text{dias}]$$
   (Collischonn & Dornelles, 2013, cap. 18). Para $A = 410$ km², $D \approx
   2{,}8$ d. Se outro pico aparece dentro desta janela, o evento termina
   antes desse pico subsequente.
4. **Filtro de chuva mínima**: o evento é descartado se a chuva acumulada
   da bacia no intervalo $[\text{pico} - L_{\text{back}}, \text{pico}]$
   for menor que **10 mm**
   (`eventos.p_min_evento_mm: 10`), onde $L_{\text{back}}$ é o **lookback**
   $\max(\lceil D \rceil, 3)$ dias. O lookback foi ajustado para capturar
   a chuva geradora em bacias com tempo de resposta de poucos dias (a
   detecção de picos opera na vazão, que tem inércia hidrológica; a chuva
   geradora pode cair 2–3 dias antes do pico em bacias com $t_c$ próximo
   de um dia).
5. **Filtro de duração**: a duração total do evento deve estar em
   $[D, D+2]$ dias (configuração `eventos.duracao_max_dias: null` →
   automático). Eventos com duração fora dessa faixa são descartados.

**Resultado para a estação 58142200, janela 1979–2023:**

- Picos detectados pela `find_peaks`: 489
- Eventos descartados por chuva insuficiente: 31
- Eventos descartados por duração inadequada: 1
- **Eventos válidos isolados: 457**

### 8.3 Lâmina escoada e chuva efetiva

Para cada evento válido, a base do hidrograma é separada por **reta linear**
ligando $Q(\text{início})$ a $Q(\text{fim})$. O escoamento direto em cada
dia $i$ do evento é:

$$q_{\text{direto},i} = \max\bigl(q_{\text{total},i} - q_{\text{base},i},\; 0\bigr)$$

**Volume escoado direto:**

$$V = \sum_i q_{\text{direto},i} \cdot 86\,400 \quad [\text{m}^3]$$

(com $86\,400$ s/dia para passo diário).

**Lâmina escoada na bacia** (mm sobre a área):

$$h = \frac{V}{A \cdot 1\,000} \quad [\text{mm, com } V \text{ em m}^3 \text{ e } A \text{ em km}^2]$$

O fator $1\,000$ corresponde a $1$ mm $\cdot$ $1$ km² $= 1\,000$ m³.

**Chuva efetiva via $\phi$-index.** O método $\phi$-index, implementado em
`pipeline/src/event_isolation.py::calcular_phi_index`, define a infiltração
constante $\phi$ (mm/dia, dado que o passo é diário) por bissecção
numérica que satisfaz a igualdade:

$$\sum_{i} \max(P_i - \phi, 0) = h$$

ou seja, a chuva efetiva acumulada (subtraída da infiltração constante)
deve igualar a lâmina escoada. Esse é o procedimento padrão para
"reconstruir" a chuva efetiva a partir do hidrograma observado.

Por construção, $P_{\text{efetiva}} = h$ — o $\phi$-index é o valor que
torna essa identidade verdadeira. Esta consistência é garantida em
`pipeline_fluvio.py:460` (correção do bug B1 da auditoria original).

### 8.4 Hidrograma unitário observado

Cada evento individual gera um **hidrograma unitário** dividindo cada
ordenada do escoamento direto pela lâmina total:

$$u_i^{(\text{evento})} = \frac{q_{\text{direto},i}}{h} \quad [\text{m}^3/\text{s}/\text{mm}]$$

O **hidrograma unitário médio observado** é obtido alinhando os HUs
individuais pelo índice do pico e tomando, ordenada a ordenada, a média
aritmética. Reporta-se também o desvio padrão por ordenada, que dá uma
medida da variabilidade entre eventos.

**Hipóteses fundamentais do método:** linearidade da resposta (a forma do
hidrograma não depende da magnitude da chuva) e invariância temporal (a
resposta da bacia é estável ao longo do tempo). Ambas são aproximações —
em bacias com componente significativa de escoamento sub-superficial
(como é o caso) a linearidade é apenas parcialmente satisfeita.

Implementação: `pipeline/src/unit_hydrograph.py::huo_medio` e
`huo_observado`.

### 8.5 Hidrograma unitário sintético SCS triangular

Como alternativa puramente sintética (sem requerer dados de chuva–vazão),
o método SCS triangular gera um HU baseado apenas em parâmetros físicos da
bacia. Com $t_c$ calculado (Seção 2.4) e duração efetiva da chuva
$d = \Delta t_{\text{SCS}} = 60$ min (configuração
`eventos.huo_scs.dt_min: 60`):

$$t_p = 0{,}6 \cdot t_c \quad [\text{h}]$$

$$T_p = t_p + \frac{d}{2} \quad [\text{h}]$$

$$Q_p = \frac{0{,}208 \cdot A}{T_p} \quad [\text{m}^3/\text{s}/\text{mm}]$$

$$t_b = 2{,}67 \cdot T_p \quad [\text{h}]$$

A constante $0{,}208$ assegura que o volume do triângulo unitário
(ordenadas em m³/s/mm × tempo em h) corresponda a 1 mm de chuva efetiva
distribuída sobre a bacia.

**Resultado para a estação 58142200, com $t_c$ Kirpich:**

| Parâmetro | Valor | Unidade |
|---|---|---|
| Área $A$ | 410,08 | km² |
| $t_c$ Kirpich | 282,93 | min (4,72 h) |
| $t_p$ | 2,83 | h |
| $T_p$ | **3,615** | h |
| $Q_p$ | **23,59** | m³/s/mm |
| $t_b$ | 9,652 | h |

### 8.6 Comparação observado × SCS — limitação metodológica

O HU observado é construído sobre **séries diárias** ($\Delta t = 1$ d), por
limitação fundamental dos dados pluviométricos disponíveis (a ANA só
fornece chuva diária). O HU SCS triangular, por outro lado, opera
naturalmente em escala **horária** ($\Delta t_{\text{SCS}} = 60$ min).

A comparação direta entre os dois — por exemplo, calcular Nash–Sutcliffe
ordenada a ordenada — **não é estatisticamente válida**: a malha temporal
discreta do HU observado (passos de 24 horas) achata o pico, enquanto a
do HU SCS preserva-o em escala horária. O Nash resultante é uma maçã com
laranja.

**Tratamento adotado.** O BI exibe os dois hidrogramas em **painéis
separados** (componente
`frontend/components/charts/HidrogramaUnitario.tsx`), cada um na sua escala
natural, com uma linha de referência indicando onde o $T_p$ do SCS cairia
no eixo do HU observado. A comparação numérica entre $T_p$, $Q_p$ e $t_b$
dos dois métodos é reportada lado a lado para informação qualitativa, mas
não é interpretada como métrica de qualidade do ajuste SCS.

Em uma análise rigorosa para projeto de obras, seria necessário derivar o
HU observado em escala sub-diária (via método da Curva-S aplicada às
ordenadas diárias, ou via desagregação dos eventos de chuva diária) antes
de comparar com o SCS. Essa derivação foi avaliada como melhoria
metodológica fora do escopo do projeto.

### 8.7 Comentário sobre a chuva-vazão na bacia

A aplicação dos eventos a chuvas distintas (testar como o hidrograma de
saída se comporta para diferentes hietogramas de entrada) é feita por
**convolução discreta** do hietograma com o HU:

$$Q_n = \sum_{j=1}^{N} P_j^{(\text{efetivo})} \cdot u_{n-j+1}$$

onde $P_j^{(\text{efetivo})}$ é a chuva efetiva no passo $j$ (calculada
pelo $\phi$-index ou pelo método SCS-CN), $u_k$ são as ordenadas do HU
adotado, e $Q_n$ é a vazão de saída no passo $n$. A convolução é
implementada via `numpy.convolve` em
`pipeline/src/unit_hydrograph.py::aplicar_huo`.

A consistência dimensional exige que **chuva e HU estejam no mesmo passo
de tempo**. Em uma aplicação completa de projeto, isto significa
desagregar a chuva diária projetada (Seção 9.6) em sub-passos compatíveis
com o HU SCS horário antes de convoluir. Este acoplamento opcional Fase 3
↔ Fase 4 está implementado em
`pipeline/src/design_storm.py::hidrograma_projeto_via_hu` como utilidade
para análises de notebook isoladas, mas não é gravado automaticamente
pelo pipeline padrão.

---

## 9. Projeto 2 / Fase 4 — Frequência de cheias, IDF e chuva de projeto

### 9.1 Vazões máximas anuais

A análise de frequência de cheias opera sobre a **série de máximas anuais
(AMS)**. Para cada ano-calendário, extrai-se o máximo diário da vazão e
preserva-se a data de ocorrência. Anos com menos de **330 dias válidos** são
descartados — esse filtro (correção B2 da auditoria) evita inflação espúria
da AMS por anos de borda da série com cobertura parcial.

**Resultado para a estação 58142200, janela 1979–2023:** **44 anos** de
máximas retidos para análise. A média da AMS é $\approx 40$ m³/s; o
máximo observado é $\approx 75$ m³/s (evento de dezembro de 2009, $P_{\text{total}}
\approx 96$ mm na chuva da bacia).

### 9.2 Ajuste de cinco distribuições candidatas

Cinco distribuições paramétricas foram ajustadas independentemente à AMS:

| Distribuição | Notação | Método de estimação adotado | Espaço de ajuste |
|---|---|---|---|
| Gumbel | EV1 | Momentos | Natural $Q$ |
| Generalized Extreme Value | GEV | Máxima verossimilhança (MLE) — `scipy.stats.genextreme.fit` | Natural $Q$ |
| LogNormal | LogN | Momentos em $\log Q$ | $\log Q$ |
| Pearson III | P3 | Momentos | Natural $Q$ |
| Log-Pearson III | LP3 | Momentos em $\log Q$ | $\log Q$ |

**Nota metodológica sobre AIC e métodos mistos.** O critério AIC pressupõe
que a verossimilhança seja maximizada via MLE. Apenas a GEV foi ajustada
por MLE; as demais, por momentos. A escolha refletиv uma decisão pragmática:
os ajustes por momentos são tradicionais no contexto brasileiro
(Naghettini & Pinto, 2007) e numericamente mais estáveis para amostras
pequenas, mas usar AIC para compará-los com a GEV-MLE penaliza
sistematicamente as distribuições por momentos. O pipeline registra o
método em `frequencia_ajuste.metodo` e emite aviso explícito; a seleção
deve ser tratada como **indicativa**.

A log-verossimilhança da LP3 (e da LogNormal) inclui o **jacobiano**
$-\sum \ln(x_i)$ para que o AIC seja comparável com distribuições
ajustadas no espaço natural — implementação em
`pipeline/src/flood_frequency.py`.

**Resultados de ajuste** (n = 44, janela 1979–2023):

| Distribuição | AIC | BIC | KS p-valor |
|---|---|---|---|
| Gumbel | 355,099 | 358,668 | 0,9639 |
| **GEV (recomendada)** | **353,870** | 359,223 | 0,877 |
| LogNormal | 354,388 | **357,956** | 0,7356 |
| Pearson III | 354,435 | 359,787 | 0,8369 |
| Log-Pearson III | 355,092 | 360,444 | 0,8018 |

### 9.3 Seleção da distribuição

O critério primário adotado (`frequencia.criterio_selecao: aic`) seleciona
a distribuição com **menor AIC** entre as que **passam no teste de
Kolmogorov–Smirnov** (p-valor ≥ 0,05). Todas as cinco distribuições
passam no KS com folga (p-valores entre 0,73 e 0,96), de modo que o
critério se reduz a "menor AIC".

**Distribuição recomendada: GEV.** AIC = 353,87 (o menor); diferença para
a segunda colocada (LogNormal, AIC = 354,39) é $\Delta\text{AIC} = 0{,}52$,
abaixo do limiar usual de 2 para inferir suporte fraco. Em outras
palavras: a evidência para preferir a GEV sobre a LogNormal é marginal.
A GEV foi escolhida automaticamente pela menor AIC; o relatório pode
defender qualquer das duas, mas a GEV é a escolha conservadora porque
sua cauda direita é potencialmente mais pesada (parâmetro de forma $\xi$
pode capturar comportamento de Fréchet em séries de extremos), reduzindo o
risco de subestimar a cheia centenária.

### 9.4 Quantis $Q(\text{TR})$ e intervalos de confiança

O quantil de tempo de retorno TR é, por definição:

$$Q_{\text{TR}} = F^{-1}\left(1 - \frac{1}{\text{TR}}\right)$$

onde $F$ é a CDF da distribuição ajustada. Para a GEV ajustada por MLE com
parâmetros $(\xi, \mu, \sigma)$:

$$Q_{\text{TR}} = \mu + \frac{\sigma}{\xi} \left[ \bigl(-\ln(1 - 1/\text{TR})\bigr)^{-\xi} - 1 \right]$$

**Intervalos de confiança 90%** são obtidos por **bootstrap não-paramétrico**
(`frequencia.bootstrap_n: 1000`, `frequencia.ic_nivel: 0.90`): a cada
amostra bootstrap, reamostra-se a AMS original **com reposição**,
re-ajusta-se a distribuição, e calcula-se $Q_{\text{TR}}$. Os percentis 5%
e 95% das 1 000 estimativas formam o IC 90%.

**O termo "não-paramétrico" refere-se à etapa de reamostragem** (reamostra
**os dados**, não os parâmetros). Não há suposição distribucional na
reamostragem; ela é equivalente a "se essa amostra é representativa, o que
seria razoável observar se repetíssemos o experimento?".

**Resultado para a estação 58142200, distribuição GEV:**

| TR (anos) | $Q_{\text{TR}}$ (m³/s) | IC 90% inferior | IC 90% superior |
|---|---|---|---|
| 2 | 39,3 | 36,1 | 43,6 |
| 5 | 51,0 | 46,6 | 57,1 |
| 10 | **57,8** | 52,3 | 63,7 |
| 25 | 65,5 | 58,1 | 74,4 |
| 50 | 70,7 | 61,2 | 83,3 |
| 100 | **75,3** | 64,0 | 93,7 |
| 500 | 84,6 | 68,4 | 122,8 |
| 1 000 | 88,0 | 70,2 | 137,4 |

A vazão de projeto para tempo de retorno de **100 anos** é $\approx 75$
m³/s, com intervalo de confiança 90% entre 64 e 94 m³/s. Para o
dimensionamento de uma obra que requeira proteção centenária, o limite
superior do IC (94 m³/s) seria a vazão recomendada como referência
conservadora.

### 9.5 IDF — equação de chuvas intensas para São José dos Campos

A equação adotada é a publicada por **Ferreira & Waltz (2001)** no XIV
Simpósio Brasileiro de Recursos Hídricos da ABRH, ajustada sobre dados
pluviográficos de São José dos Campos no período 1973–1984 + 1993–1998
(16 anos).

A forma matemática é a clássica de **Pfafstetter** (1957):

$$i = \frac{a \cdot \text{TR}^{\,b}}{(t_d + c)^{\,d}} \quad [\text{mm/h}]$$

onde $i$ é a intensidade da chuva (mm/h), TR é o tempo de retorno (anos),
$t_d$ é a duração da chuva (min), e $a, b, c, d$ são os parâmetros
ajustados.

**Parâmetros para São José dos Campos** (configuração
`pipeline/config.yaml → idf.parametros`):

| Parâmetro | Valor |
|---|---|
| $a$ | **5 710** |
| $b$ | **0,1263** |
| $c$ | **38,21** |
| $d$ | **1,0766** |

**Validação numérica.** A implementação foi conferida contra a Tabela 6
do artigo de Ferreira & Waltz (2001) em cinco pontos representativos:

| $t_d$ (min) | TR (anos) | $i$ Tabela (mm/h) | $i$ Implementação (mm/h) | Desvio |
|---|---|---|---|---|
| 10 | 2 | 96,1 | 96,07 | $-0{,}03\%$ |
| 20 | 2 | 78,4 | 78,43 | $+0{,}04\%$ |
| 60 | 10 | 54,7 | 54,72 | $+0{,}04\%$ |
| 10 | 20 | 128,5 | 128,50 | $0{,}00\%$ |
| 1 440 | 20 | 3,2 | 3,22 | $+0{,}63\%$ |

Todos os desvios são inferiores a 1%, o que valida a implementação tanto
nos parâmetros quanto na fórmula.

**Faixa de validade declarada pelo paper:** TR ≤ 20 anos e duração
$t_d \le 360$ min (6 h). Aplicações para TR = 100 anos (chuva de projeto
de drenagem urbana) caem em **extrapolação**, mas a forma Pfafstetter é
matematicamente estável para extrapolar em TR. O intervalo de confiança
real para TR > 20 anos é largo e cresce; uma análise rigorosa de drenagem
deveria considerar essa incerteza.

**Limitação adicional — efeito orográfico.** A IDF de SJC é calibrada
sobre dados de pluviógrafos no vale do Paraíba do Sul, em altitude
$\approx 580$ m. A bacia do Buquira, no entanto, é serrana: cabeceiras
nas vertentes da Serra da Mantiqueira a $\approx 1\,700$ m, com
$\Delta z = 1\,163$ m em apenas 42 km de talvegue. Pela influência do
**forçamento orográfico** (elevação ascendente do ar úmido atlântico
pelo escarpamento serrano), as intensidades reais de chuva nas
cabeceiras superiores são tipicamente **10–30% maiores** que as
previstas pela IDF do vale (Bertoni & Tucci, 2007).

Em consequência, a chuva de projeto TR = 100 calculada com a IDF de SJC
(Seção 9.6) deve ser interpretada como **limite inferior** das
intensidades reais nas cabeceiras. Para dimensionamentos rigorosos de
estruturas em pontos das cabeceiras, recomenda-se aplicar um **fator de
segurança orográfico** sobre o volume calculado, ou refazer a análise via
**transposição altimétrica** da IDF (multiplicação de $i$ por um fator
$(1 + k \cdot \Delta z / 100)$ com $k$ regional) ou via construção de uma
**IDF local** a partir da chuva diária máxima anual dos pluviômetros P2
(método de desagregação CETESB ou similar). Essas duas alternativas ficam
como pendência metodológica para evolução do trabalho.

### 9.6 Chuva de projeto pelo método dos blocos alternados

A chuva de projeto é o hietograma sintético que representa uma chuva
crítica com tempo de retorno TR adotado. O método dos blocos alternados
adotado distribui a chuva acumulada da IDF na seguinte sequência:

1. **Definir duração total** $t_d$ (configuração
   `chuva_projeto.duracao_total_min: 360`) e o **passo** $\Delta t$
   (`chuva_projeto.dt_min: 10`). Número de blocos: $n = t_d / \Delta t = 36$.
2. Para cada $t_k = k \cdot \Delta t$, $k = 1, \ldots, n$:
   $$P_k = i(\text{TR}, t_k) \cdot t_k$$
   (precipitação acumulada da chuva de duração $t_k$, em mm).
3. **Incrementos por bloco:** $\Delta P_k = P_k - P_{k-1}$, com $P_0 = 0$.
4. **Reorganização dos incrementos** (configuração
   `chuva_projeto.padrao: intermediario`): o maior incremento é colocado no
   centro do hietograma, e os demais são distribuídos alternadamente —
   um para trás, um para frente — em ordem decrescente. O padrão
   "intermediário" é o mais conservador para projeto de drenagem urbana
   porque concentra a intensidade no meio da duração total, maximizando a
   coincidência com o pico do hidrograma unitário.

**Resultado para a estação 58142200, IDF SJC:**

| TR (anos) | Precipitação total $t_d = 360$ min (mm) | Intensidade máxima do bloco central |
|---|---|---|
| 10 | **72,7** | 19,6 mm em $\Delta t = 10$ min |
| 100 | **97,3** | 26,2 mm em $\Delta t = 10$ min |

Os hietogramas completos (36 blocos cada) estão armazenados na tabela
`chuva_projeto` do Supabase em formato JSONB.

---

## 10. Validação cruzada com a Parte 1 do projeto

### 10.1 Material de referência

A Parte 1 do projeto, entregue anteriormente à disciplina em planilha
eletrônica (`Projeto2_parte1_HID41_Gustavo_Henri_PedroFeitosa.xlsx`),
contém:

- **Curva de Permanência** da estação 58142200 com 19 quantis tabelados
  (Q5 a Q95, passo 5%);
- **Filtro de Eckhardt** com parâmetros declarados $\alpha = 0{,}98$ e
  $\text{BFI}_{\max} = 0{,}80$, com vazão de base diária por dia.

A janela temporal coberta pela planilha é **1980-10-01 a 2010-09-30**,
correspondendo a 30 anos hidrológicos completos (10 957 dias).

### 10.2 Procedimento de validação

Para verificar se a implementação numérica do pipeline reproduz os
resultados da Parte 1, executamos os mesmos cálculos restringindo a janela
do pipeline à do Excel (1980-10-01 a 2010-09-30) e usando os mesmos
parâmetros do filtro de Eckhardt ($\alpha = 0{,}98$, $\text{BFI}_{\max} = 0{,}80$).

### 10.3 Resultados

| Métrica | Excel (Parte 1) | Pipeline (mesma janela) | Desvio relativo |
|---|---|---|---|
| Q5 (m³/s) | 21,32 | 21,26 | $-0{,}26\%$ |
| Q10 (m³/s) | 16,37 | 16,17 | $-1{,}27\%$ |
| Q25 (m³/s) | 10,83 | 10,64 | $-1{,}77\%$ |
| Q50 (m³/s) | 7,65 | 7,59 | $-0{,}68\%$ |
| Q75 (m³/s) | 5,69 | 5,64 | $-0{,}80\%$ |
| Q90 (m³/s) | 4,45 | 4,48 | $+0{,}56\%$ |
| Q95 (m³/s) | 3,96 | 4,02 | $+1{,}67\%$ |
| Vazão média (m³/s) | 9,34 | 9,29 | $-0{,}52\%$ |
| Vazão máxima (m³/s) | 59,45 | 75,68 | $+27{,}3\%$ |
| **BFI Eckhardt (global)** | **0,7548** | **0,7425** | $-1{,}23$ p.p. |
| Número de dias na janela | 10 957 | 10 940 | $-0{,}2\%$ |

### 10.4 Análise

**Para todos os quantis de permanência ($Q_5$ a $Q_{95}$), o desvio entre
o Excel e o pipeline é inferior a 2%.** Para a média, a diferença é de
0,52%. Para o BFI de Eckhardt, a diferença é de 1,23 ponto percentual —
todas perfeitamente consistentes com diferenças residuais esperadas
devido a:

- pequenas diferenças na **inicialização** $b_0$ do filtro recursivo (o
  Excel inicializa com $b_0 = y_0$, o pipeline também, mas o
  arredondamento numérico pode divergir em uma casa decimal);
- diferenças no número exato de dias da janela (10 957 vs 10 940 — o
  Excel ignora alguns dias com `Quality = 0`, o pipeline mantém todos
  com `consistencia = 2`).

A única diferença significativa é o **valor máximo** ($+27\%$), explicado
pelo fato de que o pipeline preenche dias com cota observada mas vazão
ausente via curva-chave, podendo extrapolar para cotas próximas do
$h_{\max}$ observado. O Excel da Parte 1 usa apenas vazão observada e,
portanto, não incorpora esses valores preenchidos. Essa diferença é uma
escolha metodológica do pipeline (cobertura temporal mais completa às
custas de um pequeno risco de extrapolação), não um erro.

### 10.5 Conclusão

A implementação do pipeline reproduz com **alta fidelidade** os resultados
da Parte 1 do projeto. Diferenças nas demais análises (curvas de
permanência, BFI, Q7,10) na janela completa do pipeline (1979–2023, ~44
anos) em relação ao Excel são atribuíveis exclusivamente à **diferença
de período** — anos pós-2014 da janela completa carregam uma seca
prolongada que puxa quantis baixos ($Q_{90}$, $Q_{95}$) para valores
inferiores —, não à diferença de método.

---

## 11. Premissas e limitações

Esta seção consolida explicitamente todas as premissas adotadas e as
limitações reconhecidas, organizando-as em duas tabelas para facilitar
referência futura.

### 11.1 Premissas

| # | Premissa | Justificativa |
|---|---|---|
| P1 | Dados ANA com `consistencia = 2` são tratados como verdade-de-referência | Padrão da Agência Nacional de Águas; é o dado revisado, oficialmente consistido |
| P2 | Mês inválido quando > 5% dos dias têm falha | Compromisso adotado pelo grupo entre rigor estatístico e preservação de cobertura temporal |
| P3 | Holdout fixo com semente 42 (10%) na comparação Regressão × IDW | Garante reprodutibilidade e comparação justa entre métodos |
| P4 | Curva-chave $Q = a(h-h_0)^b$ (potência simples) | Forma clássica (Collischonn & Dornelles, cap. 14); intervalo de aplicação restrito a $[h_{\min}, h_{\max}]$ observado |
| P5 | Janela fluviométrica truncada em 1979-01-01 | Trecho 1970–1978 contém platô artificial; truncar produz série coerente |
| P6 | $\text{BFI}_{\max} = 0{,}80$ no filtro de Eckhardt | Recomendação Eckhardt (2005) para rios perenes com aquífero poroso típico de cabeceira do PdS sobre Latossolo |
| P7 | $\alpha$ estimado por mediana das regressões log-lineares de recessão | Robusto a outliers; mascaramento por chuva evita identificar como "recessão" trechos com aporte |
| P8 | Q7,10 ajustado por LP3 com método dos momentos | Padrão ANA/CONAMA; ano hidrológico outubro-setembro |
| P9 | Tempo de concentração pelo método de Kirpich | Coerência com material didático e com $T_p$ qualitativo do HU observado |
| P10 | $CN = 60$ (AMC-II, solo grupo B) | NRCS TR-55 sobre uso e solo do CABra 318 |
| P11 | Chuva média da bacia = média aritmética dos 3 pluviômetros P2 | Simplicidade; estações P2 cobrem cabeceiras + jusante; Thiessen ponderado é melhoria marginal |
| P12 | Análise de frequência sobre AMS com filtro de 330 dias por ano | Evita máximos espúrios em anos de borda |
| P13 | Bootstrap não-paramétrico (1 000 reamostras) para IC 90% | Padrão para amostras pequenas; não pressupõe distribuição correta |
| P14 | Critério de seleção: AIC entre as que passam KS (p ≥ 0,05) | Mantém aderência distribucional + parsimônia paramétrica |
| P15 | IDF Ferreira & Waltz (2001) para São José dos Campos | Equação publicada validada em 5 pontos contra Tabela 6 do paper; SJC é praticamente a foz do Buquira |

### 11.2 Limitações reconhecidas

| # | Limitação | Mitigação proposta |
|---|---|---|
| L1 | IDF extrapolada para TR > 20 anos (paper válido até TR = 20) | Reportar TR = 100 com ressalva de extrapolação; intervalo de confiança real largo |
| L2 | IDF de SJC subestima intensidades nas cabeceiras serranas (~10–30%) | Transposição altimétrica ou IDF local dos pluvios P2 como evolução |
| L3 | Tempo de concentração divergente (Kirpich × Watt & Chow, fator 2×) | Reportar ambos como sensibilidade no relatório; análise crítica do $T_p$ observado |
| L4 | AIC compara MLE (GEV) com momentos (Gumbel, LogN, P3, LP3) | Sinalização explícita; tratar como indicativo, não como crítica forte |
| L5 | KS com parâmetros estimados da mesma amostra → p-valor inflado | Diagnóstico qualitativo, não como gate de aprovação |
| L6 | Comparação direta HU observado × HU SCS inválida (escalas distintas) | Visualização em painéis separados; comparação apenas qualitativa |
| L7 | Chuva da bacia por média simples (sem Thiessen) | Cobertura espacial das 3 estações P2 é adequada para a bacia |
| L8 | Linearidade e invariância do HU observado | Aproximação clássica; HU médio + desvio padrão por ordenada documentam variabilidade |
| L9 | CN sensível ao grupo hidrológico (B → 60; A → 33) | Adotado grupo B (conservador para cheia); faixa reportada |
| L10 | Pluviômetro Buquirinha (P1) desativado em 1972 | Substituído por Monteiro Lobato + Santa Branca + UHE Santa Branca como conjunto P2 |

---

## 12. Resultados-chave — tabela executiva

| Item | Valor | Seção |
|---|---|---|
| **Bacia (CABra 318)** | | |
| Área de drenagem $A$ | 410,08 km² | 2.2 |
| Comprimento do talvegue $L$ | 42,1 km | 2.2 |
| Desnível $\Delta h$ | 1 163 m | 2.2 |
| Declividade do canal $S$ | 0,0276 (2,76%) | 2.2 |
| Tempo de concentração (Kirpich) | 282,9 min ($\approx 4{,}7$ h) | 2.4 |
| Curve Number AMC-II | 60 (faixa 56–62) | 2.5 |
| **Estação fluviométrica** | | |
| Código ANA (exutório) | 58142200 — BUQUIRINHA II | 4.2 |
| Janela analisada | 1979-01-01 a 2023-03-31 | 6.1 |
| Cobertura efetiva | 44,2 anos; 0,33% de falhas | 6.1 |
| **Curva-chave** | | |
| Forma | $Q = 3{,}0235 \cdot (h - 0{,}05)^{2{,}036}$ | 6.3 |
| Coeficiente de determinação $R^2$ | 0,9432 | 6.3 |
| RMSE | 1,35 m³/s | 6.3 |
| Número de medições | 354 | 6.3 |
| **Curva de permanência** | | |
| Q10 | 15,7 m³/s | 7.1 |
| Q50 | 7,0 m³/s | 7.1 |
| **Q90 (outorga)** | **4,0 m³/s** | 7.1 |
| **Eckhardt** | | |
| Constante de recessão $k$ | 19,76 dias (mediana de 26 recessões) | 7.2 |
| $\alpha$ resultante | 0,9506 | 7.2 |
| **BFI global** | **0,767** | 7.2 |
| **Q7,10 (vazão mínima ecológica)** | | |
| Distribuição | Log-Pearson III | 7.3 |
| $\mu_{\log}, \sigma_{\log}, g_{\log}$ | 1,287; 0,242; 0,263 | 7.3 |
| **$Q_{7,10}$** | **2,68 m³/s** | 7.3 |
| KS p-valor | 0,490 | 7.3 |
| **Eventos chuva–vazão** | | |
| Eventos isolados | 457 | 8.2 |
| Método de chuva efetiva | $\phi$-index | 8.3 |
| **HU SCS triangular (Kirpich)** | | |
| $T_p$ | 3,62 h | 8.5 |
| $Q_p$ | 23,59 m³/s/mm | 8.5 |
| $t_b$ | 9,65 h | 8.5 |
| **Frequência de cheias** | | |
| AMS retida | 44 anos | 9.1 |
| Distribuição recomendada | GEV (AIC = 353,87; KS p = 0,877) | 9.3 |
| $Q_{\text{TR}=10}$ | 57,8 m³/s [IC 90%: 52,3 – 63,7] | 9.4 |
| **$Q_{\text{TR}=100}$** | **75,3 m³/s [IC 90%: 64,0 – 93,7]** | 9.4 |
| **IDF — São José dos Campos** | | |
| Fonte | Ferreira & Waltz (2001) | 9.5 |
| Forma | $i = 5710 \cdot \text{TR}^{0{,}1263} / (t_d + 38{,}21)^{1{,}0766}$ | 9.5 |
| Validação | 5 pontos contra Tabela 6 do paper (desvio < 1%) | 9.5 |
| **Chuva de projeto (blocos alternados, $t_d = 360$ min)** | | |
| TR = 10 anos | 72,7 mm | 9.6 |
| **TR = 100 anos** | **97,3 mm** | 9.6 |
| **Validação cruzada vs Parte 1 (Excel)** | | |
| Janela comparada | 1980-10-01 a 2010-09-30 (30 anos hidrol.) | 10.1 |
| Desvio máximo em quantis Q5–Q95 | $< 2\%$ | 10.3 |
| Desvio em BFI Eckhardt | $-1{,}23$ p.p. | 10.3 |

---

## 13. Referências bibliográficas

- **Almeida, A. C.; Souza, V. C.; Genz, F. et al.** (2021). The CABra
  dataset: a comprehensive catchment attributes and rainfall-runoff dataset
  for Brazil. *Hydrology and Earth System Sciences*, 25(6), 3105–3125.
- **ANA — Agência Nacional de Águas e Saneamento Básico**. Inventário das
  estações pluviométricas e fluviométricas. Disponível em
  *hidroweb.ana.gov.br*.
- **Bertoni, J. C. & Tucci, C. E. M.** (2007). *Hidrologia: Ciência e
  Aplicação*. Editora da UFRGS, Porto Alegre.
- **Collischonn, W. & Dornelles, F.** (2013). *Hidrologia para Engenharia
  e Ciências Ambientais*. ABRH, Porto Alegre. Capítulos 14, 15 e 18.
- **Eckhardt, K.** (2005). How to construct recursive digital filters for
  baseflow separation. *Hydrological Processes*, 19(2), 507–515.
- **Ferreira, M. E. & Waltz, R. C.** (2001). Obtenção de uma equação de
  chuvas intensas para São José dos Campos-SP. *XIV Simpósio Brasileiro de
  Recursos Hídricos*, ABRH.
- **Kirpich, Z. P.** (1940). Time of concentration of small agricultural
  watersheds. *Civil Engineering*, 10(6), 362.
- **Naghettini, M. C. & Pinto, E. J. A.** (2007). *Hidrologia Estatística*.
  CPRM, Belo Horizonte. 552 p.
- **NRCS — Natural Resources Conservation Service** (1986). *Urban
  Hydrology for Small Watersheds — Technical Release 55 (TR-55)*. United
  States Department of Agriculture.
- **Pfafstetter, O.** (1957). *Chuvas Intensas no Brasil — Relação entre
  Precipitação, Duração e Frequência de chuvas em 98 postos com
  pluviógrafos*. Departamento Nacional de Obras de Saneamento.
- **Tucci, C. E. M.** (org.) (1993). *Hidrologia: Ciência e Aplicação*.
  Editora da UFRGS, Porto Alegre.
- **Watt, W. E. & Chow, K. C. A.** (1985). A general expression for basin
  lag time. *Canadian Journal of Civil Engineering*, 12(2), 294–300.

---

## 14. Apêndices

### Apêndice A — Nomenclatura e unidades

| Símbolo | Grandeza | Unidade |
|---|---|---|
| $A$ | Área de drenagem | km² |
| $L$ | Comprimento do talvegue principal | km |
| $\Delta h$ | Desnível do talvegue (entre cabeceira e exutório) | m |
| $S$ | Declividade do canal | adimensional (m/m) |
| $t_c$ | Tempo de concentração | h ou min |
| $t_p$ | Tempo de retardo (lag time) | h |
| $T_p$ | Tempo de ascensão (tempo até o pico) | h |
| $t_b$ | Tempo de base do hidrograma unitário | h |
| $Q$ | Vazão | m³/s |
| $h$ | Cota linimétrica | m |
| $h_0$ | Cota correspondente a vazão nula | m |
| $a, b$ | Parâmetros da curva-chave de potência | adimensional |
| $Q_p$ | Vazão de pico (do HU unitário, em m³/s/mm) | m³/s/mm |
| $P$ | Precipitação | mm |
| $i$ | Intensidade de chuva | mm/h |
| $t_d$ | Duração de chuva | min |
| $\text{TR}$ | Tempo de retorno | anos |
| $\bar{P}$ | Chuva média na bacia | mm |
| $\phi$ | Taxa de infiltração constante ($\phi$-index) | mm/dia |
| $CN$ | Curve Number do NRCS | adimensional |
| $S_{\text{SCS}}$ | Capacidade máxima de retenção do solo (SCS-CN) | mm |
| $u_i$ | Ordenadas do hidrograma unitário | m³/s/mm |
| $\text{BFI}$ | Base Flow Index | adimensional |
| $\alpha$ | Parâmetro de recessão do filtro de Eckhardt | adimensional |
| $k$ | Constante de recessão | dias |
| $\beta_i$ | Coeficientes da regressão linear múltipla | adimensional |
| $d_i$ | Distância haversine | km |
| $p$ | Expoente do IDW | adimensional |
| $Q_{7,10}$ | Vazão mínima ecológica (média de 7 dias, TR = 10 anos) | m³/s |
| $Q_p$ (curva de permanência) | Vazão excedida em $p\%$ do tempo | m³/s |

### Apêndice B — Identificadores das tabelas Supabase

O banco de dados PostgreSQL/Supabase contém as seguintes tabelas-chave:

- `estacoes` — Estações pluviométricas (Projetos 1 e 2)
- `precipitacao_diaria`, `precipitacao_mensal`, `precipitacao_anual` — Séries
- `preenchimento_resultado`, `preenchimento_diario` — Comparação Regressão × IDW
- `estacoes_fluvio` — Estações fluviométricas (apenas exutório)
- `fluviometria_diaria`, `fluviometria_mensal`, `fluviometria_anual` — Séries
- `curva_chave_medicoes`, `curva_chave_ajuste` — Curva-chave
- `curva_permanencia`, `quantis_permanencia` — Permanência
- `eckhardt_serie`, `eckhardt_params` — Eckhardt
- `q7_minimos_anuais`, `q7_10_ajuste` — Q7,10
- `eventos_chuva_vazao` — Eventos isolados
- `hidrograma_unitario_observado`, `hidrograma_unitario_scs`, `comparacao_uh` — HUs
- `max_anual_vazao` — Série AMS
- `frequencia_ajuste`, `frequencia_quantis` — Distribuições + Q(TR)
- `idf_parametros`, `idf_curva` — IDF
- `chuva_projeto` — Hietogramas de projeto
- `config_pluviometros_p2`, `estacoes_candidatas_pluvio_p2` — Pluvios P2

### Apêndice C — Comandos do pipeline

A ordem de execução padrão para reproduzir todos os resultados é:

```bash
cd pipeline
.venv/Scripts/python.exe pipeline.py
.venv/Scripts/python.exe download_pluvio_p2.py baixar --do-config
.venv/Scripts/python.exe pipeline_fluvio.py
.venv/Scripts/python.exe gerar_figuras_relatorio.py
```

Cada script é idempotente; reexecuções não duplicam dados (operações de
`upsert` no banco). O `pipeline_fluvio.py` inclui purga automática de
estações fluviométricas residuais via `_purgar_outras_estacoes`.

---

**Fim do documento mestre.**
