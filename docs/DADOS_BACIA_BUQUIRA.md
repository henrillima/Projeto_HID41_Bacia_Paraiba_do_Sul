# Parâmetros físicos da bacia — exutório 58142200 (Rio Buquira)

Dados de entrada da **Fase 3** do Projeto 2 (tempo de concentração, HU sintético
SCS, chuva efetiva por SCS-CN), para o exutório fluviométrico **58142200 —
Buquirinha II**, no **Rio Buquira**, afluente do Paraíba do Sul.

> ✅ **Status:** Todos os parâmetros vêm do **CABra** (catchment 318). Área,
> elevações (→ Δh) e CN são atributos diretos; o **L foi medido** sobre a rede
> `CABra_drainage` recortada à bacia (caminho de fluxo mais longo até o exutório),
> via o script `Projeto 2/medir_L_qgis.py`. **L = 42,1 km.**

### Atributos brutos do CABra (catchment 318 / ANA 58142200)

```
Topografia : catch_area 410,076 km² | elev_mean 853,39 m | elev_min 562,81 m
             elev_max 1725,54 m | elev_gauge 562,81 m | catch_slope 23,99 % | ordem 2
Uso (%)    : floresta 70,0 | pasto/grass 20,9 | arbustivo 6,9 | agric 1,3
             urbano 0,6 | solo exposto 0,2 | água 0,08
Solo       : Haplic Ferralsols (Latossolo) | textura SANDY CLAY LOAM
             areia 49,1 % | silte 18,7 % | argila 32,1 % | profundidade ~173 cm
```

---

## A bacia

| Item | Valor | Fonte |
|------|-------|-------|
| Estação | 58142200 — BUQUIRINHA II | ANA / CABra (ID 318) |
| Rio | Buquira (afluente do Paraíba do Sul) | — |
| Nascente | Monteiro Lobato/SP, vertentes da Serra da Mantiqueira (22°56′04″S, 45°40′52″O) | Wikipédia / UNIVAP |
| Exutório | próximo à foz no Paraíba, em São José dos Campos (−23,125; −45,907) | ANA |
| Elevação do exutório | ~580 m | ANA (altitude do gauge) |
| Cabeceiras | Serra da Mantiqueira, > 900 m (até ~1500–1700 m) | IBGE/relevo regional |

---

## Parâmetros adotados

| Parâmetro | Símbolo | Valor | Origem |
|-----------|---------|-------|--------|
| Área de drenagem | A | **410,08 km²** | CABra `catch_area` (ANA: 407). ✅ |
| Desnível do talvegue | Δh | **1163 m** | CABra: `elev_max` 1725,54 − `elev_gauge` 562,81. ✅ |
| Comprimento do talvegue | L | **42,1 km** | **Medido** na rede `CABra_drainage` recortada à bacia 318 (caminho de fluxo mais longo até o exutório). Coerente com a estimativa Hack/distância (~47 km). |
| Declividade do canal | S = Δh/L | **~2,76 %** (0,0276 m/m) | Calculado. ≠ `catch_slope` 23,99 % do CABra (declive de **terreno**). |
| Curve Number (AMC-II) | CN | **60** (faixa 56–62) | CABra uso+solo (ver abaixo). |

### Tempo de concentração resultante

| Método | tc | Observação |
|--------|----|-----------| 
| **Kirpich (1940)** | **~4,7 h** (283 min) | `tc = 57·(L³/Δh)^0,385`. |
| **Watt & Chow (1985)** | ~10,2 h (609 min) | `tc = 7,68·(L/√S)^0,79`. Faixa de calibração até ~5840 km². |

> O L foi obtido com o script **`Projeto 2/medir_L_qgis.py`** (rodável no Console
> Python do QGIS): ele recorta a drenagem do CABra à bacia 318, monta o grafo da
> rede e acha o caminho de fluxo mais longo até o exutório, desenhando o talvegue
> no mapa para a figura.

Os dois divergem (bacia de ~410 km² fica no limite "pequena/média"). **Recomendação:**
rodar com Kirpich e **comparar o Tp do HU SCS com o do HU observado** (a Fase 3 já
faz isso) para decidir, ou reportar os dois como sensibilidade.

### Como o CN foi estimado (NRCS / TR-55)

- **Solo** = *Haplic Ferralsols* (Latossolo), profundo (~173 cm) e bem drenado →
  **grupo hidrológico B** (escolha conservadora para cheia; Latossolos podem ser A).
- **Uso ponderado** (grupo B, AMC-II): floresta 70 % (CN≈55–60), pasto 21 %
  (CN≈61–69), arbustivo 7 % (CN≈48–56), agric. 1,3 %, urbano 0,6 % →
  **CN ≈ 56 (boa cobertura) a 62 (regular); adotado 60.**
- ⚠️ **Sensibilidade ao grupo de solo:** se o Latossolo for classificado como
  **grupo A**, o CN cai para **~33**. O SCS-CN é muito sensível a isso — vale
  citar a faixa no relatório.

Os dois divergem bastante (bacia de ~410 km² fica no limite entre "pequena" e
"média"). **Recomendação:** rodar com Kirpich, mas **comparar o tempo de pico do
HU SCS com o do HU observado** dos eventos reais (a Fase 3 já calcula isso) e usar
isso para decidir qual tc é mais realista — ou reportar os dois como sensibilidade.

---

## Como obter os valores **definitivos** (recomendado para o relatório)

São duas rotas; qualquer uma substitui as estimativas acima.

### Rota A — CABra (mais rápida, ~10 min)
A vazão do Excel veio do CABra (catchment ID 318). Os atributos físicos estão no
mesmo dataset:

1. Abrir **https://thecabradataset.shinyapps.io/CABra/** (ou baixar de
   https://zenodo.org/records/4070146).
2. Selecionar o catchment **318** (gauge ANA 58142200).
3. Ler/baixar os atributos:
   - *Topography*: área, **elevação média/máx/mín** (→ Δh), **declividade média**.
   - *Land cover*: % de cada classe de uso → para o CN.
   - *Soil*: tipo/grupo hidrológico de solo → para o CN.
4. O **comprimento do rio principal (L)** pode não vir como número — meça-o sobre
   o **shapefile de drenagem** que o CABra fornece (ferramenta "medir linha" no
   QGIS), ou use a Lei de Hack como fizemos.

### Rota B — QGIS sobre o MDE (mais trabalhosa, mas é o "padrão-ouro")
Mesmo fluxo do Relatório 1, **fechando a bacia no ponto da estação 58142200**
(−23,125; −45,907) em vez da foz:

1. Delinear a sub-bacia até esse exutório (SRTM/MERIT).
2. Extrair: área, **L** (comprimento do talvegem mais longo), **Δh** (cota da
   nascente do talvegue − cota no exutório).
3. Cruzar com MapBiomas (uso) + EMBRAPA (solo) → **CN** ponderado pela TR-55.

---

## Onde esses números entram no projeto

- **L, Δh** → tempo de concentração `tc` → tempos e pico do **HU SCS triangular**
  (`tp = 0,6·tc`, `Tp = tp + d/2`, `Qp = 0,208·A/Tp`, `tb = 2,67·Tp`).
- **A** → vazão de pico do HU (`Qp`) e conversão volume→lâmina.
- **CN** → chuva efetiva pelo SCS-CN (`S = 25400/CN − 254`; `Q = (P−Ia)²/(P−Ia+S)`),
  usada na convolução com o HU para gerar o hidrograma de cheia.

Já estão preenchidos em `pipeline/config.yaml → bacia:` (marcados como provisórios).

---

### Fontes
- Estação/área: inventário ANA-SNIRH; CABra (Almeida et al., *HESS* 25, 3105–3125, 2021).
- Rio Buquira (nascente, percurso): Wikipédia — Rio Buquira; UNIVAP (caracterização da microbacia).
- CN: NRCS *TR-55 — Urban Hydrology for Small Watersheds* (tabelas de Curve Number).
- L: Lei de Hack (`L = 1,4·A^0,6`) e distância × sinuosidade.
