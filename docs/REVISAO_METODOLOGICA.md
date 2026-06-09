# Revisão metodológica e de código — Projeto 2 (HID-41)

Auditoria de corretude hidrológica das Fases 1–4 do pipeline fluviométrico,
confrontando o código (`pipeline/src/*.py`, `pipeline_fluvio.py`) com
`HID41_Projeto2_Metodologia.md` e `docs/METHODOLOGY.md`.

**Veredito geral:** o núcleo estatístico está sólido. As equações da curva-chave,
curva de permanência, filtro de Eckhardt, Q7,10 (LP3) e ajuste de distribuições de
cheia (Gumbel/GEV/LogNormal/P3/LP3) estão implementadas corretamente — inclusive
detalhes sutis que costumam estar errados, como o jacobiano `−Σ ln(x)` na
log-verossimilhança da LP3 (para tornar o AIC comparável entre espaços natural e
log) e a parametrização do `scipy.stats.pearson3` (loc=média, scale=desvio, skew),
que verifiquei numericamente. Há **2 bugs concretos** e um conjunto de
inconsistências metodológicas que valem correção ou justificativa explícita no
relatório.

---

## 🔴 Bugs (produzem números errados)

### B1 — Chuva efetiva do φ-index calculada de forma inconsistente
`pipeline_fluvio.py:460`

```python
ev.p_efetiva_mm = max(0.0, ev.p_total_mm - ev.phi_index_mm_dia * len(ev.hietograma))
```

O φ-index é resolvido (`event_isolation.calcular_phi_index`) justamente para que
`Σ max(Pᵢ − φ, 0) = lâmina escoada`. Logo, por construção, a chuva efetiva **é**
a `lamina_mm`. A linha acima recalcula `P_total − φ·n_dias`, que só coincide
quando **todos** os dias têm `Pᵢ > φ`. Em qualquer evento com dias de chuva baixa,
isso subtrai φ até de dias secos e **subestima** a chuva efetiva.

Verificação numérica (`P = [5, 40, 8]`, lâmina-alvo = 30 mm): φ = 10 mm/dia →
`Σ max(P−φ,0) = 30` (correto), mas `P_total − φ·n = 53 − 30 = 23 mm` (−23%).

**Correção:** `ev.p_efetiva_mm = ev.lamina_mm` (ou
`float(np.maximum(chuvas - phi, 0).sum())`).

### B2 — Série de máximas anuais não filtra anos incompletos
`flood_frequency.py:31` (`serie_max_anual_q`)

Toma o máximo diário de **cada ano-calendário** sem exigir um mínimo de dias
válidos. Os anos de borda do registro (primeiro/último, muitas vezes com poucos
meses) entram na AMS com um máximo espúrio e **puxam a distribuição de cheias para
baixo**, afetando todos os Q(TR). A Fase 2 (Q7,10) já faz esse filtro (`≥ 300
dias`); a Fase 4 deveria ser simétrica.

**Correção:** descartar anos com menos de ~330 dias válidos (ou exigir cobertura
da estação chuvosa) antes de extrair o máximo.

---

## 🟠 Inconsistências metodológicas (defensáveis, mas justifique ou corrija)

### M1 — Comparação HU observado × HU SCS mistura passos de tempo
`scs_uh.comparar_obs_vs_scs`

O HU observado é diário (`dt_dias = 1`) e o HU SCS é horário (`dt_min = 60`). A
função interpola o HU diário na malha horária e calcula NSE/erro de pico. Mas um
HU diário **achata o pico** por média de 24 h — comparar seu pico com o pico
horário do SCS é maçã com laranja, e o NSE resultante não é interpretável.
**Correção:** gerar o HU SCS no **mesmo Δt** do observado (p.ex. `dt_min = 1440`)
para a comparação, ou re-derivar o HU observado em passo sub-diário via Curva-S.
Para A ≈ 9.600 km² o tc provavelmente passa de 24 h, então um HU SCS *diário*
para a comparação é o caminho mais simples e honesto.

### M2 — Chuva da bacia = média simples de 3 pluviômetros de cabeceira
`pipeline_fluvio._carregar_chuva_media_bacia` + `event_isolation`

A lâmina precipitada sobre o exutório (Pindamonhangaba, A ≈ 9.600 km²) é estimada
pela média aritmética de 3 postos de cabeceira do projeto. Esses postos não
representam 9.600 km² de área de drenagem — isso contamina φ-index, lâmina escoada
e, por consequência, todo o HU observado. A metodologia reconhece (Thiessen
"fase futura"), mas como isso afeta números do relatório, no mínimo registre a
limitação; idealmente pondere por Thiessen/inverso da distância sobre a área real.

### M3 — Watt & Chow aplicado fora da faixa de calibração
`scs_uh.tc_watt_chow` + `config.yaml → bacia.tc_metodo`

A própria metodologia limita Watt & Chow a "~5.840 km²"; a bacia tem ≈ 9.600 km².
Tanto Kirpich (bacias pequenas/rurais) quanto Watt & Chow estão sendo esticados
para uma bacia muito grande, onde tc é intrinsecamente incerto. Reporte tc com
essa ressalva e, se possível, compare com um terceiro método (NRCS lag / método
da velocidade) como sensibilidade.

### M4 — AIC compara ajustes por momentos com ajuste por MLE
`flood_frequency.ajustar_distribuicoes`

Gumbel, LogNormal, P3 e LP3 são ajustadas por **momentos**; só a GEV usa **MLE**
(`genextreme.fit`). O AIC pressupõe verossimilhança maximizada (MLE); usá-lo sobre
log-verossimilhanças de ajustes por momentos penaliza injustamente essas
distribuições e **enviesa a seleção a favor da GEV**. **Correção:** ajustar todas
por MLE (`scipy ...fit`) para a seleção por AIC/BIC, ou abandonar o AIC e
selecionar por KS/inspeção do papel de probabilidade (como sugere a metodologia).

### M5 — KS com parâmetros estimados da própria amostra
`flood_frequency.py` e `low_flow.py`

O teste KS clássico assume distribuição totalmente especificada. Estimando os
parâmetros da mesma amostra, os p-valores ficam **inflados** (teste conservador) —
ou seja, o filtro "passou no KS se p ≥ 0,05" aceita fácil demais. Use Anderson–
Darling ou a correção de Lilliefors, ou apenas trate o KS como diagnóstico
qualitativo (não como gate de aprovação).

### M6 — Ano-calendário na Fase 4 vs ano hidrológico na Fase 2
A AMS de cheias usa ano-calendário; o Q7,10 usa ano hidrológico (out→set). Num
regime de chuvas de verão (DJF), o pico da estação chuvosa atravessa a virada do
ano e o ano-calendário pode fatiar a mesma estação úmida. Considere ano
hidrológico também para as máximas, por coerência.

### M7 — Δt incompatível latente no acoplamento chuva-projeto → HU
`design_storm.hidrograma_projeto_via_hu` (não chamado pelo pipeline)

A chuva de projeto sai em blocos de 10 min (`config: dt_min = 10`) e o HU SCS é
horário. A convolução `Q_n = Σ Pⱼ·u_{n−j+1}` só conserva volume com **o mesmo Δt**
nos dois. O pipeline não executa esse acoplamento (é "notebook-only"), mas se você
gerar o hidrograma de projeto para o relatório, construa hietograma e HU no mesmo
Δt.

### M8 — k de recessão (Eckhardt) estimado sem máscara de chuva
`pipeline_fluvio.py:386` chama `estimar_constante_recessao(s)` sem `serie_chuva`

Sem a série de chuva, "recessão" vira "qualquer queda monotônica ≥ 5 dias", o que
inclui trechos que não são depleção de aquífero e enviesa k (e α). A função já
aceita `serie_chuva`; basta passar a chuva média da bacia para restringir às
janelas realmente sem chuva.

---

## 🟡 Menores / cosméticos

- **C1** `event_isolation.calcular_phi_index`: docstring diz "φ (mm/h)", mas o
  valor é mm/dia (a chuva é diária e φ é subtraído direto). Fator 24 de diferença
  na rotulagem — alinhe o texto (o atributo já é `phi_index_mm_dia`).
- **C2** `low_flow.serie_q7`: docstring diz "média móvel central", mas
  `pandas.rolling` é trailing. Para o **mínimo** de 7 dias o resultado é o mesmo;
  é só o texto.
- **C3** `rating_curve`: o KS dos resíduos contra N(0,1) assume resíduos de média
  zero, o que mínimos quadrados não-lineares não garantem. É só diagnóstico.
- **C4** `METHODOLOGY.md §11.4` chama o bootstrap de "paramétrico", mas o código
  reamostra a série observada (bootstrap **não-paramétrico**). Ajuste o termo.

---

## Itens já bem resolvidos (não mexer)
- Curva-chave `Q = a(h−h₀)^b`: grid-search de h₀ + refino `curve_fit`, faixa de
  validade [h_min,h_max] sem extrapolar. ✔
- Curva de permanência: Weibull `m/(n+1)`, ordem decrescente, interpolação. ✔
- Eckhardt: recursão e restrição `bᵢ ≤ yᵢ` corretas; k pela mediana das
  recessões (robusto). ✔
- LP3 (Q7,10) e família de cheias: parametrização scipy correta; jacobiano da
  log-verossimilhança LP3/LogNormal deixando o AIC no espaço natural. ✔
- HU SCS triangular: constante 0,208 + tb = 2,67·Tp conservam volume (verifiquei:
  área do triângulo ≈ 1.000·A m³ = 1 mm sobre A). ✔
- Blocos alternados: acumulada→incrementos→reordenação central correta. ✔

---

## Prioridade sugerida
1. B1 e B2 (bugs numéricos) — rápidos e mudam resultados do relatório.
2. M4/M5 (seleção de distribuição de cheias) — afeta qual PDF você defende.
3. M1/M2/M3 (Fase 3) — registre as limitações mesmo que não recalcule.
4. M8 e cosméticos — melhoria de qualidade.

---

## Status das correções aplicadas (2026-06-08)

| Item | O que foi feito | Arquivo |
|------|-----------------|---------|
| **B1** ✅ | `p_efetiva_mm = lamina_mm` (consistente com o φ-index). Testado: 30 mm vs 23 mm do bug. | `pipeline_fluvio.py` |
| **B2** ✅ | `serie_max_anual_q` descarta anos com < 330 dias válidos. Testado. | `flood_frequency.py` |
| **M1** ✅ | Comparação HU obs × SCS agora na malha diária (agrega o SCS por médias diárias). | `scs_uh.py` |
| **M4/M5** ✅ | Cada ajuste recebe tag `metodo` (momentos/mle); aviso ao usar AIC/BIC entre métodos; desempate por KS-D. Estimação e critério **não** alterados (decisão do grupo). | `flood_frequency.py` |
| **M8** ✅ | Eckhardt recebe a chuva da bacia para restringir as janelas de recessão. | `pipeline_fluvio.py` |
| **C1** ✅ | Docstring do φ-index corrigida (mm/dia). | `event_isolation.py` |
| **C4** ✅ | "bootstrap paramétrico" → "não-paramétrico". | `METHODOLOGY.md` |
| M2, M3, M6, M7, C2, C3 | Não alterados — são ressalvas a documentar no relatório, não bugs. | — |

Decisões deixadas para o grupo: **M4** (manter momentos do livro-texto vs. migrar
tudo para MLE) e o **critério de seleção** (`config.yaml → frequencia.criterio_selecao`).
O código agora é transparente sobre o trade-off; a escolha do número final é de vocês.

---

## Dados da bacia — o que o Relatório Parte 1 tem (e o que falta)

**Conclusão: os parâmetros físicos de que o Projeto 2 precisa NÃO estão no
relatório.** O relatório caracteriza a **bacia inteira do Paraíba do Sul até a
foz** (A = 55.653,9 km²), enquanto o exutório do Projeto 2 é a estação
fluviométrica **58183000 – Pindamonhangaba**, cuja sub-bacia drena **≈ 9.600 km²**
(cabeceira). São áreas 5,8× diferentes; os números do relatório não podem ser
plugados no `config.yaml`.

O que o relatório fornece (tudo para a bacia inteira):

| Parâmetro (bacia inteira) | Valor | Serve para o Projeto 2? |
|---------------------------|-------|--------------------------|
| Área | 55.653,9 km² | ❌ é a bacia toda, não a sub-bacia de 58183000 |
| Comprimento axial | 579,3 km | ❌ é eixo da bacia toda, não o talvegue até Pinda |
| Declividade média (encosta) | 20,1% (11,3°) | ⚠️ é declividade **de terreno**, não do **canal** — não usar como S para tc |
| Altitude média / máx. | 625 m / ~2775 m | ℹ️ referência qualitativa |
| Uso do solo | 50,7% pastagem, 27,4% floresta | ℹ️ ajuda a estimar CN (mas da bacia toda) |
| Solos | Latossolos, Argissolos, Cambissolos | ℹ️ idem |

O que já dá para preencher e o que falta no `bacia:`:

- **`area_km2 = 9600`** ✅ — preenchido. Fonte: **inventário ANA** (já está em
  `data/fluvio_candidatas.csv`: 58183000, A = 9.600 km²), não o relatório.
- **`comprimento_talvegue_km` (L)** ❌ FALTA — exige delinear a **sub-bacia até
  58183000** no QGIS/SRTM e medir o talvegue. (Você já tem o fluxo QGIS da Parte 1;
  basta refazer com o exutório em Pindamonhangaba.)
- **`delta_h_m` (Δh)** ❌ FALTA — cota da nascente menos cota no exutório, ao longo
  do talvegue, via SRTM.
- **`declividade_media` (S do canal)** ❌ FALTA — calcula-se de Δh/L (o código faz
  isso automaticamente se Δh e L forem dados). **Não** usar os 20,1% do relatório.
- **`cn_amc2`** ❌ FALTA (estimável) — cruzar uso do solo × grupo hidrológico de
  solo **da sub-bacia**. Os percentuais da bacia toda só servem de ponto de partida.

**Próximo passo recomendado:** redelinear a sub-bacia até o exutório 58183000 no
QGIS (mesmo procedimento da Parte 1, trocando o ponto de exutório) e extrair L, Δh
e o CN dessa área de ≈ 9.600 km². Sem isso, a Fase 3 (HU SCS, tc) é pulada pelo
pipeline com aviso; as Fases 1, 2 e 4 rodam normalmente (não dependem desses
parâmetros).
