# Medir o comprimento do talvegue (L) no QGIS — bacia 318 / estação 58142200

Objetivo: obter **L** (comprimento do rio principal, da nascente mais distante até
o exutório) usando o **contorno da bacia já delineado pelo CABra** + um basemap de
satélite. Sem precisar delinear nada do zero.

- Exutório (estação 58142200): **lat −23,125 ; lon −45,907**
- Área esperada da bacia (validação): **≈ 410 km²**
- L esperado (validação): **~44–52 km** — se der muito fora, algo está errado.

---

## 0. Pré-requisitos
- **QGIS instalado** (versão LTR, ex.: 3.34+). Baixe em https://qgis.org se ainda não tiver.

## 1. Baixar os shapefiles no Zenodo
A app do CABra **não** baixa shapefile — ele está no Zenodo:
https://zenodo.org/records/7612350 → seção **Files** → baixe **dois** arquivos:

- **`CABra_drainage.zip`** (50 MB) — a **rede de drenagem** (linhas dos rios). É
  onde você mede o L.
- **`CABra_boundaries.zip`** (48 MB) — o **contorno** das bacias (pra validar a
  área ≈ 410 km²).

Descompacte os dois. Cada um traz as 735 bacias num shapefile (`.shp` + `.shx` +
`.dbf` + `.prj` juntos); você filtra a 318 no passo 4.

## 2. Abrir o QGIS e deixar o projeto em metros
1. Abra o QGIS → **Projeto novo**.
2. Canto inferior direito, clique no CRS atual → defina **SIRGAS 2000 / UTM 23S —
   EPSG:31983**. (Isso faz os comprimentos saírem em metros, não em graus. É o
   passo que mais gente erra.)

## 3. Adicionar um basemap de satélite (pra enxergar o rio)
1. Menu **Complementos → Gerenciar e instalar complementos** → instale
   **QuickMapServices**.
2. Menu **Web → QuickMapServices → Google → Google Satellite**
   (ou **Web → QuickMapServices → Settings → More services** se o Google não
   aparecer; alternativa: Esri Satellite).

## 4. Carregar as camadas e isolar a 318
1. Arraste para o QGIS os dois `.shp` (drenagem e contorno) — ou **Camada →
   Adicionar Camada Vetorial**.
2. Na camada de **contorno**: botão direito → **Abrir Tabela de Atributos**, ache
   a linha **CABra ID 318** (ou ANA 58142200) e veja o **nome do campo** do ID.
3. Botão direito na camada → **Filtrar…** e aplique `"<campo_id>" = 318`
   (ex.: `"CABra_ID" = 318`). Faça o mesmo na camada de **drenagem**. Agora só a
   sua bacia e os rios dela ficam visíveis.
4. **Validação da área:** na camada de contorno, **Calculadora de Campo** →
   `$area/1000000` → deve dar **≈ 410**. Se bater, é a bacia certa.

## 5. (opcional) Satélite de fundo
Se quiser conferir visualmente, adicione o **Google Satellite** (Complementos →
QuickMapServices). Não é obrigatório — a drenagem do CABra já é a linha do rio.

## 6. Medir o L
A camada de drenagem do CABra já é a rede de rios da sua bacia. Há duas formas:

**Forma A — régua (rápida):**
1. **Projeto → barra de ferramentas → Medir Linha** (ícone de régua). Confirme a
   unidade em **km**.
2. Clique seguindo a linha do rio, da **cabeceira mais distante** (a NE, lado de
   Monteiro Lobato/Mantiqueira) **até o ponto do exutório** (−45,907 ; −23,125).
   Dois cliques para fechar. Leia o total → **L**.

**Forma B — somar comprimentos (mais precisa):**
1. Use a ferramenta **Selecionar Feições** e clique nas linhas que formam o
   **caminho principal** (do rio mais longo), da nascente mais distante ao exutório.
2. **Calculadora de Campo** → `$length` (ou *Vetor → Ferramentas de Geometria →
   Somar comprimentos das linhas*) → divida por 1000 → **L em km**.
   - Dica: se a camada tiver um campo de **ordem de Strahler** ou de **comprimento**,
     ele ajuda a identificar o tronco principal.

## 7. Conferir e me mandar
- L deve cair em **~44–52 km**. Se deu muito diferente, provavelmente você traçou
  um afluente curto em vez do braço mais longo, ou o projeto não está em UTM.
- Me diga o valor (ou mande um **print da medição**) que eu atualizo o
  `config.yaml` e o `DADOS_BACIA_BUQUIRA.md`, e recalculo **S = Δh/L** e o **tc**.

---

### Dica
Se em qualquer passo travar, tira um print da tela do QGIS e me manda — eu te digo
o próximo clique.
