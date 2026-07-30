# magalu-snapshot-manager

Automação em Node.js (JavaScript puro, sem dependências) que cria snapshots diários de todas as VMs do Magalu Cloud e remove os snapshots antigos.

Dois scripts executados pelo GitHub Actions:

| Script | Função | Agendamento |
| --- | --- | --- |
| `src/create-snapshots.js` | Lista as VMs e cria um snapshot de cada uma | Todos os dias às **3h00** (BRT) |
| `src/cleanup-snapshots.js` | Apaga snapshots com mais de **7 dias** | Todos os dias às **4h00** (BRT) |

---

## Como funciona

### Criação (`create-snapshots.js`)

1. Lista todas as instâncias (VMs) do tenant via `GET /v1/instances`, paginando automaticamente.
2. Para cada VM, cria um snapshot via `POST /v1/snapshots` com o nome **`auto-<nome-da-vm>-<YYYY-MM-DD>`**.
   - A data é em UTC, garantindo o mesmo nome entre execução local e no CI.
3. Se a API retornar `409` (nome já existe — ex.: o job rodou duas vezes no mesmo dia), o snapshot é pulado.
4. Falhas individuais não interrompem o lote. Ao final, o script imprime um resumo (`X criados, Y pulados, Z falhas`) e sai com código `1` se houve alguma falha — assim o GitHub Actions marca o job como falho e você é notificado.

### Limpeza (`cleanup-snapshots.js`)

1. Lista todos os snapshots via `GET /v1/snapshots`, paginando automaticamente.
2. Apaga **somente** os snapshots cujo nome começa com `auto-` **e** cuja data `created_at` é mais antiga que **7 dias**.
3. Cada um é removido via `DELETE /v1/snapshots/{id}`.
4. Mesma política de resumo e código de saída da criação.

> **Segurança:** snapshots criados manualmente (sem o prefixo `auto-`) **nunca** são tocados pelo script de limpeza.

---

## Pré-requisitos

- **Node.js ≥ 20.6** (usa `fetch` nativo e `--env-file` nativo — nenhuma dependência é instalada).
- Uma **API Key** da Magalu Cloud com permissões para:
  - Listar instâncias
  - Criar, listar e deletar snapshots
  - Crie em: https://docs.magalu.cloud/docs/devops-tools/api-keys/how-to/other-products/create-api-key

A região da API está fixa em **`br-se1`** (base: `https://api.magalu.cloud/br-se1/compute`).

---

## Configuração

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `X_API_KEY` | API Key da Magalu Cloud, enviada no header `x-api-key` |

### Localmente

1. Copie o exemplo e preencha sua key:
   ```bash
   cp .env.example .env
   # edite .env e coloque sua X_API_KEY
   ```
2. Rode com o `.env` carregado nativamente pelo Node:
   ```bash
   npm run create
   # ou: node --env-file=.env src/create-snapshots.js
   ```
   ```bash
   npm run cleanup
   # ou: node --env-file=.env src/cleanup-snapshots.js
   ```

---

## GitHub Actions

Os dois workflows ficam em `.github/workflows/`. O cron do GitHub Actions é em **UTC**, então os horários BRT (UTC-3) foram convertidos:

| Workflow | Cron (UTC) | Horário BRT |
| --- | --- | --- |
| `create-snapshots.yml` | `0 6 * * *` | 3h00 |
| `cleanup-snapshots.yml` | `0 7 * * *` | 4h00 |

Ambos também aceitam `workflow_dispatch`, ou seja, podem ser disparados **manualmente** na aba *Actions* do repositório.

### Configurando o secret

1. No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret**.
2. Nome: `X_API_KEY`
3. Valor: sua API Key da Magalu Cloud.

O secret é injetado como variável de ambiente `X_API_KEY` durante a execução dos scripts.

---

## Estrutura do projeto

```
magalu-snapshot-manager/
├── .github/workflows/
│   ├── create-snapshots.yml    # cron 3h00 BRT + workflow_dispatch
│   └── cleanup-snapshots.yml   # cron 4h00 BRT + workflow_dispatch
├── src/
│   ├── magalu-api.js           # cliente HTTP compartilhado (fetch nativo + paginação)
│   ├── create-snapshots.js     # script de criação
│   └── cleanup-snapshots.js    # script de limpeza
├── .env                        # X_API_KEY (local, ignorado pelo git)
├── .env.example                # modelo do .env
├── .gitignore
├── package.json                # sem dependências
└── README.md
```

### `magalu-api.js`

Cliente compartilhado por ambos os scripts. Centraliza:

- URL base (`https://api.magalu.cloud/br-se1/compute`)
- Header de autenticação `x-api-key`
- Paginação automática (`_limit=200`, loop por `_offset`)
- Funções: `listInstances()`, `listSnapshots()`, `createSnapshot(id, nome)`, `deleteSnapshot(id)`

---

## Comportamento de erros

- Falta de `X_API_KEY` → erro fatal e exit `1` imediatamente.
- Falha em uma VM/snapshot específica → logado e contado como falha; o restante continua.
- Ao final, se houve **qualquer** falha, o exit code é `1` (o job do GitHub Actions fica vermelho e gera notificação).