# Pipeline Python — Análise Pluviométrica

## Pré-requisitos

- Python 3.11+
- Conta no [Supabase](https://supabase.com) com o schema já criado (`supabase/migrations/001_initial.sql`)

## Setup

```bash
cd pipeline
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edite .env com suas credenciais Supabase
```

## 1. Criar o schema no Supabase

1. Acesse **Supabase → SQL Editor**
2. Cole o conteúdo de `../supabase/migrations/001_initial.sql`
3. Execute

## 2. Baixar os dados das estações

### Opção A — Download automático via API (recomendado)

A ANA disponibiliza uma API SOAP pública **sem autenticação** em
`telemetriaws1.ana.gov.br`. O script baixa todas as estações e salva
ZIPs compatíveis com o pipeline:

```bash
# Lista estações pluviométricas de SP sem baixar (para ver o que existe)
python download_stations.py --listar --estado SP

# Baixa todas as pluviométricas de SP (pode demorar ~30 min dependendo da conexão)
python download_stations.py --estado SP

# Baixa apenas estações em uma faixa de códigos (bacia do Paraíba do Sul)
python download_stations.py --estado SP --codigo-de 02240000 --codigo-ate 02249999

# Baixa estações específicas por código
python download_stations.py --codigos 02244006 02244008 02245000
```

Os ZIPs são salvos em `data/raw/`. Estações já baixadas são puladas automaticamente.

### Opção B — Download manual pelo portal

1. Acesse [hidroweb.ana.gov.br](https://hidroweb.ana.gov.br)
2. Filtre por Tipo=Pluviométrica, Estado=SP, Bacia=Paraíba do Sul
3. Baixe os ZIPs e coloque em `data/raw/`

> **Nota:** A nova API REST do SNIRH (snirh.gov.br) exige credenciais cadastradas
> via e-mail para `hidro@ana.gov.br`. A API SOAP usada na Opção A não tem essa restrição.

## 3. Descobrir e avaliar as estações

```bash
python discover.py
```

Exibe uma tabela ranqueada por qualidade de dados. Repita com filtros se quiser:

```bash
python discover.py --min-anos 20 --csv resumo_estacoes.csv
```

**Critérios de escolha das 3 estações:**
- Máximo de anos bons (≥300 dias com dado por ano)
- Menor percentual de falhas
- Período comum entre as 3 (anos simultâneos com dado)
- Distribuição espacial razoável (evite estações muito próximas entre si)
- A estação com mais dados deve ser a **referência**

## 4. Preencher config.yaml

Edite `config.yaml` com os códigos e coordenadas das 3 estações escolhidas:

```yaml
estacoes:
  - codigo: "02244006"    # código de 8 dígitos da ANA
    nome: "Nome da Estação"
    lat: -22.5890
    lon: -45.2340
    altitude: 580
    is_referencia: true   # apenas UMA estação recebe true
  - ...
```

As coordenadas estão disponíveis na página de cada estação no Hidroweb.

## 5. Rodar o pipeline

```bash
python pipeline.py
```

O pipeline é **idempotente** — pode ser rodado múltiplas vezes sem duplicar dados.

O que acontece:
1. Parseia os 3 ZIPs e constrói séries diárias
2. Aplica regressão múltipla e IDW para preencher falhas da referência
3. Compara os métodos pelo RMSE em holdout de 10%
4. Constrói séries mensais, anuais e de máx. diária anual
5. Calcula histogramas e estatísticas descritivas
6. Carrega tudo no Supabase

## 6. Validar no Supabase

Acesse **Supabase → Table Editor** e verifique:
- `estacoes`: 3 linhas
- `precipitacao_diaria`: ~20.000+ linhas por estação
- `precipitacao_mensal`, `precipitacao_anual`, `max_diaria_anual`: populadas
- `histogramas`: 4 linhas por estação (diaria, mensal, anual, max_diaria_anual)
- `preenchimento_resultado`: 2 linhas (regressao + idw)

## Troubleshooting

| Erro | Causa provável |
|------|---------------|
| `ZIP não encontrado` | Nome do arquivo não contém o código — renomeie para `{codigo}.zip` ou use `--codigos` no download_stations.py |
| `Período comum insuficiente` | As 3 estações não têm anos simultâneos com dado — escolha estações com maior sobreposição |
| `Colunas obrigatórias ausentes` | CSV em formato diferente do esperado — verifique o encoding do ZIP |
| `SUPABASE_URL não definido` | Faltou copiar `.env.example` para `.env` |
