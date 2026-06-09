# Revisão conceitual do Projeto 2 — coerência e validade

Confronto entre os **requisitos do trabalho**, a **implementação no código** e a
**coerência hidrológica** das escolhas (bacia, pluviômetros, metodologias, IDF).

---

## 1. Cobertura dos requisitos (tudo implementado)

| Requisito | Onde está no código | Status |
|-----------|---------------------|--------|
| Baixar vazão no exutório | `pipeline_fluvio.py` (REST `HidroSerieVazao`) | ✅ |
| Curva de permanência + Q90/Q50/Q10 | `src/flow_duration.py` | ✅ |
| Filtro de Eckhardt (separação de escoamentos) | `src/eckhardt.py` | ✅ |
| HU observado (dados observados) | `src/event_isolation.py` + `src/unit_hydrograph.py` | ✅ ⚠️ (ver §2.1) |
| HU sintético SCS | `src/scs_uh.py` | ✅ |
| Aplicar a diferentes eventos de precipitação | `unit_hydrograph.aplicar_huo` / `scs_uh.aplicar_scs` | ✅ ⚠️ (ver §2.1) |
| Q7,10 | `src/low_flow.py` | ✅ |
| Ajustar/refazer curva-chave | `src/rating_curve.py` | ✅ |
| PDF de vazões máximas + TR 5,10,25,50,100,500,1000 | `src/flood_frequency.py` (config TRs cobrem todos) | ✅ |
| Curvas IDF | `src/idf.py` | ⚠️ **parâmetros não validados (ver §2.2)** |
| Chuva de projeto TR 10 e 100 | `src/design_storm.py` | ✅ |

As correções de implementação da auditoria (B1, B2, M1, M4, M8) estão aplicadas e
verificadas — ver `REVISAO_METODOLOGICA.md`. As **fórmulas** de cálculo estão
corretas (curva-chave, Eckhardt, LP3, distribuições de cheia, HU SCS, blocos
alternados foram conferidas, inclusive numericamente).

**Conclusão da parte de implementação:** está coerente e completa. Os problemas
abaixo são **conceituais/de dados**, não de código.

---

## 2. Coerência conceitual — 3 pontos de atenção

### 2.1 🔴 A bacia escolhida NÃO contém os pluviômetros do projeto (problema central)

A bacia de estudo do Projeto 2 é a da estação **58142200 — Buquirinha II** (Rio
Buquira, 410 km², Monteiro Lobato→SJC). Mas os **3 pluviômetros do Projeto 1**
estão **fora** dela:

| Pluviômetro (Projeto 1) | Dentro da bacia? | Distância ao exutório |
|-------------------------|------------------|-----------------------|
| Pindamonhangaba (2245048) | ❌ Não | 51 km |
| Estrada do Cunha (2245055) | ❌ Não | 90 km |
| São Luís do Paraitinga (2345065) | ❌ Não | 63 km |

**Por que isso importa:** as etapas de **chuva-vazão** (HU observado, isolamento
de eventos, φ-index, aplicação a diferentes eventos) usam a **chuva média da
bacia** — que o pipeline calcula como a média desses 3 postos. Chuva medida a
50–90 km, no fundo do vale, **não representa** a precipitação que gerou as cheias
na bacia do Buquira (que é serrana, na Mantiqueira, com efeito orográfico). O HU
observado e a chuva efetiva ficam fisicamente inconsistentes.

> Para as etapas que usam **só vazão** (permanência, Eckhardt, Q7,10, curva-chave,
> frequência de cheias), não há problema — a Buquirinha II tem série longa
> (1979–2023) e é uma escolha boa.

**Como resolver (sua proposta de "pontos mais próximos" — correta):**

- **Opção A (recomendada):** trocar os pluviômetros por **1–3 estações dentro/junto
  da bacia do Buquira** (região de Monteiro Lobato / São Francisco Xavier / SJC).
  Isso torna a chuva representativa e alinha tudo. Implica re-rodar `pipeline.py`.
- **Opção B:** trocar o exutório fluviométrico por uma estação cuja bacia
  **contenha** os 3 pluviômetros (ex.: uma estação no alto Paraíba / Paraitinga).
  Restaura a coerência Projeto 1 ↔ Projeto 2, mas descarta a análise de vazão já
  feita na Buquirinha.
- **Opção C (fraca):** manter e documentar como limitação. Não recomendado.

Como passo prático da Opção A, ver §3.

### 2.2 🟠 IDF — parâmetros não validados e possivelmente no formato errado

O `config.yaml → idf` usa a forma **Pfafstetter** `i = a·TR^b/(t_d+c)^d` com
parâmetros **placeholder** para SJC (a=1239,7; b=0,181; c=22; d=0,890), já marcados
como "confirmar com fonte oficial". Dois problemas:

1. **São placeholders** — não saem de fonte publicada; não podem ir no relatório
   como estão.
2. **Forma provavelmente incorreta:** a referência oficial de São Paulo é a do
   **DAEE / Martinez & Magni (1999, atual. 2018)**, que usa um modelo **tipo LnLn**,
   não a forma Pfafstetter do código.

**A região (SJC) é coerente** com a bacia do Buquira (que deságua em SJC) — então
o problema é só obter a **equação oficial de SJC** (DAEE) e usá-la. Se ela for
LnLn, é preciso adaptar `idf.py` para essa forma (ou construir a IDF desagregando
a chuva diária máxima da estação escolhida, como manda a Opção B do enunciado).

⚠️ Nota: a bacia é serrana (Mantiqueira); a IDF de SJC (vale) pode **subestimar**
as intensidades nas cabeceiras. Vale comentar no relatório.

### 2.3 🟡 Tempo de concentração — métodos divergem muito

Para A ≈ 410 km², Kirpich dá tc ≈ 4,7 h e Watt & Chow ≈ 10,2 h. A bacia fica no
limite "pequena/média". **Recomendação:** rodar com Kirpich, mas **comparar o
tempo de pico do HU SCS com o do HU observado** (a Fase 3 já calcula) e reportar
os dois como sensibilidade, justificando a escolha.

---

## 3. Plano para os "pontos mais próximos" (Opção A)

1. **Encontrar pluviômetros na bacia do Buquira.** No QGIS (você já tem o
   contorno da bacia 318), sobreponha a camada de estações pluviométricas da ANA
   (HidroWeb) e veja quais caem **dentro/junto** da bacia (região de Monteiro
   Lobato, São Francisco Xavier, norte de SJC). Escolha 1–3 com série longa e
   poucas falhas.
2. **Atualizar `config.yaml → estacoes`** com os códigos/coordenadas escolhidos
   (uma como `is_referencia: true`).
3. **Re-rodar** `python pipeline.py` (ingere a nova chuva → `precipitacao_diaria`)
   e depois `python pipeline_fluvio.py` (a Fase 3 passa a usar a chuva
   representativa).
4. **Conferir** no BI: as páginas de eventos/HU agora refletem chuva da própria
   bacia.

> Implicação: trocar os pluviômetros muda também as páginas **pluviométricas** do
> BI (Projeto 1). Se o relatório do Projeto 1 já foi entregue com os 3 postos
> originais, decida com o grupo se o BI passa a refletir o conjunto novo (mais
> coerente) ou se mantém os dois conjuntos documentados.

---

## 4. Prioridades
1. **§2.1** — alinhar pluviômetros à bacia (define a validade de toda a Fase 3).
2. **§2.2** — obter a IDF oficial de SJC (DAEE) e ajustar a forma se necessário.
3. **§2.3** — reportar tc com sensibilidade Kirpich × Watt&Chow.
