# API REST HidroWebService — ANA (referência de uso)

Documento de apoio para a migração SOAP → REST do pipeline HID-41.
Conteúdo extraído do **Manual Oficial da ANA versão 20.02.2026**
(`manual-hidrowebservice_publica.pdf`) e validado em campo durante o spike.

---

## 1. Endpoint base e cadastro

- **Base URL:** `https://www.ana.gov.br/hidrowebservice`
- **Swagger UI:** `https://www.ana.gov.br/hidrowebservice/swagger-ui/index.html`
- **Cadastro:** e-mail para `hidro@ana.gov.br` com o assunto
  `[CPF/CNPJ] - Solicitação de acesso à API HidroWebService para consumo de dados`.
  O acesso é liberado após análise; a senha chega no e-mail informado.

Credenciais usadas neste projeto ficam em `pipeline/.env` (gitignored):

```
ANA_API_USER=<cpf-sem-formatacao>
ANA_API_PASS=<senha-recebida-por-email>
ANA_API_BASE_URL=https://www.ana.gov.br/hidrowebservice
```

---

## 2. Autenticação (OAuth simplificado / Bearer token)

| Item            | Valor                                                              |
|-----------------|--------------------------------------------------------------------|
| **Endpoint**    | `GET /EstacoesTelemetricas/OAUth/v1`                               |
| **Headers**     | `Identificador: <CPF/CNPJ>` &nbsp;·&nbsp; `Senha: <senha>`         |
| **Resposta**    | JSON `{status, code, message, items: {tokenautenticacao, ...}}`    |
| **Token TTL**   | **60 minutos** (após esse período, refazer a autenticação)         |
| **Uso do token**| Header `Authorization: Bearer <tokenautenticacao>` nas demais rotas |

> ⚠️ Requisições de autenticação em alta frequência são monitoradas e podem
> resultar em **bloqueio automático do IP**. A aplicação cliente DEVE gerenciar
> o ciclo de vida do token — recomenda-se cachear em disco e só renovar
> quando faltar < 5 min para expirar.

### Exemplo de resposta (autenticação)

```json
{
  "status": "OK",
  "code": 200,
  "message": "Sucesso",
  "items": {
    "sucesso": true,
    "token": "...",
    "validade": "Thu Feb 20 15:07:00 GMT-03:00 2025",
    "tokenautenticacao": "eyJhb...",
    "respostaautenticacao": "Sucesso"
  }
}
```

O campo a copiar para o header `Authorization` é **`items.tokenautenticacao`**
(sem aspas, prefixado com `Bearer `).

### Códigos de retorno padrão

| Código | Significado            | Ação                                                       |
|--------|------------------------|------------------------------------------------------------|
| 200    | Sucesso                | Processar `items[]`                                        |
| 400    | Requisição inválida    | Revisar parâmetros (tipos, formato de data)                |
| 401    | Não autorizado         | Renovar token (ou conferir credenciais)                    |
| 500    | Erro interno do servidor | Retry com backoff; se persistir, escrever para `hidro@ana.gov.br` |

---

## 3. Rotas disponíveis (controller `WSEstacoesTelemetricasController`)

Todas são **GET**, autenticadas via `Bearer`, e retornam JSON com o envelope
padrão `{status, code, message, items: [...]}`.

| Rota                                                                | Propósito                                                                                       |
|---------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| `/EstacoesTelemetricas/OAUth/v1`                                    | Autenticação (item 2)                                                                           |
| `/EstacoesTelemetricas/OAUthPermissoes/v1`                          | Retorna permissões via accessToken SSO                                                          |
| `/EstacoesTelemetricas/HidroInventarioEstacoes/v1`                  | Inventário completo das estações. Filtros: código, UF, bacia (1–9). Sem limite por requisição. |
| `/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaDetalhada/v1`    | Série telemétrica detalhada (adotado + bruto). Limite **30 dias**.                              |
| `/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1`      | Série telemétrica adotada (chuva, nível, vazão). Limite **30 dias**.                            |
| `/EstacoesTelemetricas/HidrosatSerieDados/v1`                       | Séries de estações virtuais HidroSat. Limite **366 dias**.                                      |
| `/EstacoesTelemetricas/HidrosatInventarioEstacoes/v1`               | Inventário das estações virtuais por satélite (HidroSat).                                       |
| `/EstacoesTelemetricas/HidroSerieVazao/v1`                          | **Série diária de vazão** (coleta manual). Limite **366 dias**.                                 |
| `/EstacoesTelemetricas/HidroSerieCotas/v1`                          | **Série diária de cotas** (coleta manual). Limite **366 dias**.                                 |
| `/EstacoesTelemetricas/HidroSerieChuva/v1`                          | **Série diária de chuva** (coleta manual). Limite **366 dias**.                                 |
| `/EstacoesTelemetricas/HidroSerieResumoDescarga/v1`                 | **Medições de descarga líquida** (curva-chave). Limite **366 dias**.                            |
| `/EstacoesTelemetricas/HidroSerieCurvaDescarga/v1`                  | **Curvas de descarga ajustadas** (rating curves vigentes). Limite **366 dias**.                 |
| `/EstacoesTelemetricas/HidroSeriePerfilTransversal/v1`              | Medições de perfil transversal. Limite **366 dias**.                                            |
| `/EstacoesTelemetricas/HidroSerieSedimentos/v1`                     | Séries de sedimentos. Limite **366 dias**.                                                      |
| `/EstacoesTelemetricas/HidroSerieQA/v1`                             | Séries de qualidade da água. Limite **366 dias**.                                               |
| `/EstacoesTelemetricas/HidroBacia/v1`                               | Lista de bacias hidrográficas (regiões macro 1–9).                                              |
| `/EstacoesTelemetricas/HidroSubBacia/v1`                            | Lista de sub-bacias (códigos 10–99).                                                            |
| `/EstacoesTelemetricas/HidroUF/v1`                                  | Lista de unidades federativas.                                                                  |
| `/EstacoesTelemetricas/HidroMunicipio/v1`                           | Lista de municípios (código HIDRO, **diferente do IBGE**).                                      |
| `/EstacoesTelemetricas/HidroRio/v1`                                 | Lista de rios cadastrados.                                                                      |
| `/EstacoesTelemetricas/HidroEntidade/v1`                            | Lista de entidades operadoras/responsáveis.                                                     |

---

## 4. Endpoints que usamos no projeto

> ⚠️ **Atenção — nomes dos parâmetros são strings literais em português**, com
> acentos e espaços (extraídos do OpenAPI spec em
> `/hidrowebservice/api-docs/Versão - v1.0.3984.2`). O cliente Python usa
> `requests` que faz URL-encoding automaticamente.

### 4.1. Inventário — `/HidroInventarioEstacoes/v1`

| Parâmetro literal                            | Tipo                    | Obrigatório? | Observação                                                                                                |
|----------------------------------------------|-------------------------|--------------|----------------------------------------------------------------------------------------------------------|
| `Código da Estação`                          | int32 (query)           | não          | Filtra um código específico.                                                                              |
| `Data Atualização Inicial (yyyy-MM-dd)`      | string `yyyy-MM-dd` (q.)| não          | Filtra estações cuja atualização ocorreu a partir desta data.                                              |
| `Data Atualização Final (yyyy-MM-dd)`        | string `yyyy-MM-dd` (q.)| não          | Filtra estações cuja atualização ocorreu até esta data.                                                    |
| `Unidade Federativa`                         | string (query)          | não          | AC, AL, AM, AP, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO. |
| `Código da Bacia`                            | int32 (query)           | não          | 1 = Amazonas, 2 = Tocantins/Araguaia, 3 = Atlântico N/NE, …, **8 = Atlântico Sudeste** (Paraíba do Sul), 9 = Atlântico Sul/Uruguai. |

> Pelo menos **um** filtro deve ser fornecido — caso contrário a API retorna
> `406 Not Acceptable` com a mensagem "É Necessário Informar Código da
> Estação, UF ou Código da Bacia".

**Campos relevantes do item retornado** (exemplo Porto Velho, AM):

```jsonc
{
  "Altitude": "42.88",
  "Area_Drenagem": "976000.0",          // km², útil para HU SCS
  "Bacia_Nome": "RIO AMAZONAS",
  "Codigo_Adicional": "ANA",
  "Codigo_Operadora_Unidade_UF": "1",
  "Data_Periodo_Climatologica_Fim":    null,
  "Data_Periodo_Climatologica_Inicio": null,
  "Data_Periodo_Desc_Liquida_Fim":     null,
  "Data_Periodo_Desc_liquida_Inicio":  "1964-01-01 00:00:00.0",
  "Data_Periodo_Telemetrica_Inicio":   "2001-06-01 00:00:00.0",
  "Data_Ultima_Atualizacao":           "2023-12-19 00:00:00.0",
  "Estacao_Nome":      "PORTO VELHO",
  "Latitude":          "-8.7483",
  "Longitude":         "-63.9169",
  "Municipio_Codigo":  "1010000",
  "Municipio_Nome":    "PORTO VELHO",
  "Operadora_Codigo":  "82",            // CPRM
  "Operadora_Sigla":   "CPRM",
  "Responsavel_Sigla": "ANA",
  "UF_Estacao":        "RO",
  "UF_Nome_Estacao":   "RONDÔNIA",
  "codigobacia":       "1",
  "codigoestacao":     "15400000",
  "Operando":          "1",             // 1 = ativo, 0 = desativado
  "Tipo_Estacao":      "Fluviometrica"  // "Fluviometrica" | "Pluviometrica"
}
```

### 4.2. Série diária — `/HidroSerieVazao/v1`, `/HidroSerieCotas/v1`, `/HidroSerieChuva/v1`, `/HidroSerieResumoDescarga/v1`

| Parâmetro literal                          | Tipo                       | Obrigatório | Observação                                                                                          |
|--------------------------------------------|----------------------------|-------------|----------------------------------------------------------------------------------------------------|
| `Código da Estação`                        | int32 (query)              | sim         | 8 dígitos do código HIDRO.                                                                          |
| `Tipo Filtro Data`                         | string enum (query)        | sim         | `DATA_LEITURA` (data do evento) ou `DATA_ULTIMA_ATUALIZACAO` (data da última edição no banco).      |
| `Data Inicial (yyyy-MM-dd)`                | string `yyyy-MM-dd` (q.)   | sim         | Início da janela.                                                                                   |
| `Data Final (yyyy-MM-dd)`                  | string `yyyy-MM-dd` (q.)   | sim         | Limite da janela. **Máx. 366 dias por requisição.**                                                  |
| `Horário Inicial (00:00:00)`               | string `HH:mm:ss` (q.)     | não         | Refinamento opcional do início.                                                                     |
| `Horário Final (23:59:59)`                 | string `HH:mm:ss` (q.)     | não         | Refinamento opcional do fim.                                                                        |

> Para séries longas, o cliente deve fatiar em janelas anuais e concatenar
> (implementado em [`HidroWebClient._slice_dates`](../pipeline/src/ana_client.py)).

### 4.3. Telemetria — `/HidroinfoanaSerieTelemetricaAdotada/v1`

Reservado para análises em quase-tempo-real; **não usamos no projeto principal**.
Parâmetros: `CodigoDaEstacao`, `TipoFiltroData` (`DATA_LEITURA` | `DATA_ULTIMA_ATUALIZACAO`),
`DataDeBusca`, `RangeIntervaloDeBusca` (`MINUTO_5..MINUTO_30`, `HORA_1..HORA_24`,
`DIAS_2 | DIAS_7 | DIAS_14 | DIAS_21 | DIAS_30`).

Estrutura de um item (telemétrica):

```jsonc
{
  "Chuva_Adotada":         "0.00",            // mm
  "Chuva_Adotada_Status":  "0",                // 0=ok, 1=suspeito, 2=ruim
  "Cota_Adotada":          "781.00",          // cm
  "Cota_Adotada_Status":   "0",
  "Data_Atualizacao":      "2024-01-02 00:28:03.307",
  "Data_Hora_Medicao":     "2024-01-01 23:00:00.0",
  "Vazao_Adotada":         "13225.42",        // m³/s
  "Vazao_Adotada_Status":  "0",
  "codigoestacao":         "15400000"
}
```

### 4.4. Medições de descarga — `/HidroSerieResumoDescarga/v1`

Para o ajuste da **curva-chave**. Parâmetros idênticos ao da série diária
(`CodigoEstacao`, `DataInicial`, `DataFinal`); janela máx. 366 dias.
Cada item traz cota, vazão medida, área molhada, velocidade média e método.

### 4.5. Curva de descarga vigente — `/HidroSerieCurvaDescarga/v1`

Retorna as curvas-chave **ajustadas pela ANA** (forma, parâmetros, faixa de
validade, data de início). Útil como referência para comparar com nosso ajuste
próprio (potência via NLS).

Parâmetros: `Código da Estação`, `Tipo Filtro Data`, `Data Inicial (yyyy-MM-dd)`
e `Data Final (yyyy-MM-dd)` obrigatórios (apesar do OpenAPI spec marcar `Tipo
Filtro Data` como opcional para esta rota, ela retorna 406 sem o parâmetro
— validado empiricamente).

### 4.6. Outros endpoints auxiliares

| Rota                                                | Parâmetros (todos `query`, opcionais)                                                                 |
|-----------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `/HidroBacia/v1`                                    | `Código da Bacia`, `Data Atualização Inicial`, `Data Atualização Final`                                |
| `/HidroSubBacia/v1`                                 | `Código da Sub-Bacia`, datas de atualização                                                            |
| `/HidroUF/v1`                                       | `Código da UF`, datas                                                                                  |
| `/HidroRio/v1`                                      | `Código do Rio`, datas                                                                                 |
| `/HidroMunicipio/v1`                                | `Código do Município`, datas                                                                           |
| `/HidroEntidade/v1`                                 | `Código da Entidade`, datas                                                                            |

---

## 5. Boas práticas adotadas neste projeto

1. **Cache de token** em `pipeline/.cache/hidroweb_token.json`, TTL local de
   55 minutos (margem de segurança vs. TTL real de 60 min).
2. **Rate limit** de 2 req/s no cliente, com backoff exponencial em 429 e 5xx.
3. **Refresh automático** em 401 — uma única tentativa de renovação por
   chamada, para não disparar o detector de abuso.
4. **Idempotência local** — cada chamada de série salva o JSON em
   `pipeline/data/raw_v2/{tipo}/{codigo}_{ini}_{fim}.json` para permitir replay
   sem novas chamadas à ANA.
5. **Fatiamento em janelas** de 365 dias para séries longas; concatenação no
   cliente respeitando duplicatas de meses fronteiriços (último valor vence).

---

## 6. Fontes

- Manual oficial: `https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/monitoramento-hidrologico/orientacoes-manuais/manuais/manual-hidrowebservice_publica.pdf` (versão 20.02.2026).
- Swagger UI: `https://www.ana.gov.br/hidrowebservice/swagger-ui/index.html`.
- Suporte: `hidro@ana.gov.br`.
