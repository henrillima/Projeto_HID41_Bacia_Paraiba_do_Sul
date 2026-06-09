# QGIS — passo a passo clique a clique para medir o L

Para a bacia CABra **318 / ANA 58142200** (Rio Buquira). Exutório:
**lon −45,907 ; lat −23,125**. Alvos de conferência: área **≈ 410 km²**, L
**~44–52 km**.

> Os menus aparecem em **português** e (entre parênteses) em **inglês**, porque o
> QGIS pode estar em qualquer um dos dois.

---

## Antes: descompactar
1. Descompacte `CABra_drainage.zip` e `CABra_boundaries.zip`.
2. Anote a pasta onde ficaram. Dentro de cada uma há um arquivo terminado em
   **`.shp`** (é esse que você vai abrir; os `.dbf/.shx/.prj` ficam junto, não
   precisa abrir).

---

## Parte 1 — Abrir o QGIS e ajustar a unidade (metros)
1. Abra o **QGIS Desktop**. Ele já abre com um projeto novo vazio.
2. No **canto inferior direito** da janela há um texto tipo `EPSG:4326`. **Clique
   nele**.
3. Abre a janela **Propriedades do Projeto → SRC (Project Properties → CRS)**.
4. No campo **Filtro (Filter)** digite: `31983`.
5. Na lista de baixo, clique em **SIRGAS 2000 / UTM zone 23S** (EPSG:31983).
6. Clique **OK**.
   - ✅ Pronto: agora medições saem em metros/km, não em graus.

## Parte 2 — Adicionar os dois shapefiles
1. Menu **Camada → Adicionar Camada → Adicionar Camada Vetorial…**
   (Layer → Add Layer → Add Vector Layer). Atalho: **Ctrl+Shift+V**.
2. No campo **Fonte (Source) → Conjunto de dados vetoriais**, clique no botão
   **…** e navegue até o `.shp` da **drenagem** (CABra_drainage). Selecione → **Abrir**.
3. Clique em **Adicionar (Add)**. Feche a janela (**Fechar/Close**).
4. Repita os passos 1–3 para o `.shp` do **contorno** (CABra_boundaries).
   - Você verá no painel **Camadas (Layers)**, à esquerda, as duas camadas.
   - Vai aparecer um monte de bacias/rios do Brasil inteiro — normal. Vamos filtrar.

## Parte 3 — Descobrir o nome do campo do ID
1. No painel **Camadas**, clique com o **botão direito** na camada de **contorno**
   → **Abrir Tabela de Atributos (Open Attribute Table)**. (Atalho: **F6**.)
2. Olhe os **nomes das colunas** no topo. Procure a que tem o número da bacia —
   provavelmente **`CABra_ID`** (ou `cabra_id`, `id`, `gauge`/`ANA_ID` com 58142200).
3. Para achar a bacia: no canto da tabela há uma caixa de busca; digite **318**
   (ou **58142200**) e veja em qual coluna ele aparece. **Anote o nome exato dessa
   coluna.** Feche a tabela.

## Parte 4 — Filtrar só a bacia 318
1. Botão **direito** na camada de **contorno** → **Filtrar… (Filter…)**.
2. Abre o **Construtor de consultas (Query Builder)**. Na caixa grande de baixo,
   escreva (trocando o nome do campo pelo que você anotou):

   ```
   "CABra_ID" = 318
   ```
   (se o ID for a coluna do código ANA, use `"ANA_ID" = 58142200`).
3. Clique **OK**. Agora só a sua bacia aparece.
4. **Repita** o filtro na camada de **drenagem** (mesmo botão direito → Filtrar),
   com a mesma expressão. Agora só os rios da sua bacia aparecem.
5. Botão direito na camada de contorno → **Aproximar para a Camada (Zoom to
   Layer)**. A tela centraliza na sua bacia.

## Parte 5 — Validar a área (≈ 410 km²)
1. Botão direito na camada de **contorno** → **Abrir Tabela de Atributos**.
2. Veja se há uma coluna de **área** (ex.: `catch_area` ou `area_km2`) → deve
   mostrar **≈ 410**.
3. Se **não** houver coluna de área, pule — é só uma conferência. (Se quiser
   mesmo assim: tabela aberta → ícone do **ábaco (Calculadora de Campo)** →
   marque **Criar campo virtual**, nome `area_chk`, expressão `$area/1000000` →
   OK; vai aparecer ~410.)

## Parte 6 — Ligar o "imã" (snap) para traçar certo
1. Menu **Projeto → Opções de Aderência (Project → Snapping Options)**.
2. Clique no ícone do **imã (magnet)** para **ativar**. Deixe "Tipo: Vértice e
   Segmento" e tolerância ~12 px. Feche.
   - Isso faz o clique "grudar" na linha do rio na hora de medir.

## Parte 7 — Medir o L (régua)
1. Na barra de ferramentas do topo, ache o ícone de **régua** (**Medir Linha /
   Measure Line**). Se não achar: menu **Ver → Barras de ferramentas → Barra de
   Atributos** para exibi-la; a régua fica nela.
2. Clique na régua. Abre uma janelinha **Medir (Measure)**. Confirme que a unidade
   está em **metros** ou **quilômetros** (se estiver em graus, o CRS não ficou em
   UTM — refaça a Parte 1).
3. Localize na tela:
   - O **exutório** (sul/sudoeste, lado de São José dos Campos), e
   - A **nascente mais distante** do rio (norte/nordeste, lado de Monteiro Lobato).
4. **Clique** na ponta da nascente mais distante e vá **clicando ao longo da linha
   do rio** (o imã ajuda a grudar), seguindo sempre o **braço principal** (o mais
   comprido), até chegar no **exutório**.
5. **Duplo-clique** para encerrar. Leia o valor em **Total** → esse é o **L**.
   Anote em km.

> Se o rio tiver muitas curvas, clique bastante (de curva em curva) para
> acompanhar o traçado — quanto mais pontos, mais fiel.

## Parte 8 — (alternativa mais precisa) somar o comprimento
Se preferir não traçar à mão:
1. Ferramenta **Selecionar Feições (Select Features)** (ícone de seta com quadrado
   amarelo).
2. **Clique** em cada segmento que forma o **rio principal**, da nascente mais
   distante ao exutório, segurando **Ctrl** para ir somando à seleção.
3. Menu **Ver → Painéis → Resumo Estatístico (View → Panels → Statistics)**.
4. No painel, escolha a **camada de drenagem** e o campo **comprimento** (se
   existir) ou a função **$length**; veja a **Soma (Sum)** dos selecionados.
   Divida por 1000 → **L em km**.

---

## Pronto — me manda
- O **valor do L** (em km), ou
- Um **print** da tela com a medição/Total aparecendo.

Eu confiro se está coerente (~44–52 km), atualizo o `config.yaml` e o
`DADOS_BACIA_BUQUIRA.md`, e recalculo **S = Δh/L** e o **tempo de concentração tc**.

> Travou em algum passo? Manda um print da tela do QGIS que eu te digo o próximo
> clique exato.
