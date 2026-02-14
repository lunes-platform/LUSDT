# LUSDT Bridge Service

Bridge cross-chain entre **LUSDT** (Lunes) e **USDT** (Solana) com multisig vault, circuit breaker e bots de aprovacao.

## Indice

- [Arquitetura](#arquitetura)
- [Pre-requisitos](#pre-requisitos)
- [Build e Instalacao](#build-e-instalacao)
- [Deploy Contratos Lunes (ink!)](#deploy-contratos-lunes-ink)
- [Deploy Solana (Treasury Multisig)](#deploy-solana-treasury-multisig)
- [Configuracao](#configuracao)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Sistema Multisig](#sistema-multisig)
- [Fluxos de Operacao](#fluxos-de-operacao)
- [Testes](#testes)
- [Deploy Local (Docker)](#deploy-local-docker)
- [Deploy VPS (Producao)](#deploy-vps-producao)
- [Endpoints da API](#endpoints-da-api)
- [Monitoramento](#monitoramento)
- [Troubleshooting](#troubleshooting)
- [Contribuicao](#contribuicao)

## Arquitetura

```text
                          LUSDT Bridge Service
                          ====================

  Solana                       Off-chain                         Lunes
 --------                     -----------                       ------

 Deposito USDT ───────▶  BridgeProcessor  ──────────▶  LUSDT.mint()
 (SPL Transfer)         │                │             (ink! PSP22)
                        │  VaultExecutor │
 Recebe USDT   ◀───────│  (multisig)    │◀──────────  LUSDT.burn()
 (SPL Transfer)         │                │             (RedemptionRequested)
                        └───────┬────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
        OriginValidator   RiskValidator   BackupValidator
        (Bot 1)           (Bot 2)         (Bot 3)
               │                │                │
               └───────── Quorum 2/3 ────────────┘
                                │
                         ┌──────┴──────┐
                         │ HSM Signer  │
                         │ (KMS/Vault) │
                         └──────┬──────┘
                                ▼
                    Solana Transaction (finalized)
```

**Componentes principais:**

- **BridgeProcessor** — detecta eventos nas duas chains e coordena transferencias
- **VaultExecutor** — orquestra o fluxo multisig: proposta, bots, execucao
- **Approval Bots (3x)** — validam independentemente cada transferencia
- **HSM Signer** — chaves protegidas via AWS KMS ou HashiCorp Vault
- **Circuit Breaker** — pausa automatica se falhas consecutivas ocorrem
- **Redis Store** — persiste propostas, spending counters, audit log

## Pre-requisitos

| Ferramenta | Versao minima | Notas |
|---|---|---|
| **Node.js** | 18.x | LTS recomendado |
| **pnpm** | 9.x | Gerenciador de pacotes do monorepo |
| **TypeScript** | 5.2+ | Instalado como devDependency |
| **Docker** | 24+ | Para ambiente local e producao |
| **Docker Compose** | 2.20+ | Plugin do Docker |
| **PostgreSQL** | 15+ | Banco de dados principal |
| **Redis** | 7+ | Cache e persistencia multisig |

**Opcional (producao):**

- **HashiCorp Vault** 1.15+ — gerenciamento de chaves ed25519
- **AWS KMS** — envelope encryption para chaves Solana

## Build e Instalacao

### 1. Clone o repositorio

```bash
git clone https://github.com/lunes-platform/LUSDT.git
cd LUSDT
```

### 2. Instale dependencias

O projeto usa **pnpm workspaces**. Na raiz do monorepo:

```bash
pnpm install
```

Ou, se quiser instalar somente o bridge-service:

```bash
cd bridge-service
pnpm install
```

### 3. Compile o TypeScript

```bash
cd bridge-service
pnpm build
```

Esse comando executa `tsc` e gera os arquivos JavaScript em `dist/`.

**Configuracao do compilador** (`tsconfig.json`):

- **target**: ES2022
- **module**: commonjs
- **strict**: true (todas as checagens habilitadas)
- **outDir**: `./dist`
- **rootDir**: `./src`

### 4. Verifique o build

```bash
# Deve sair sem erros
pnpm build

# Verifique que dist/ foi gerado
ls dist/
```

Se houver erros de compilacao, verifique:

- `pnpm install` foi executado (dependencias presentes)
- Node.js >= 18 esta no PATH
- O arquivo `src/contracts/tax_manager.json` existe (copiado do build do contrato ink!)

### 5. Configure o ambiente

```bash
# Copie o template de ambiente
cp env-vps.example .env

# Edite com suas configuracoes
nano .env
```

### 6. Execute

```bash
# Desenvolvimento (hot-reload)
pnpm dev

# Producao
pnpm start
```

## Deploy Contratos Lunes (ink!)

Antes de configurar o bridge-service, os smart contracts devem estar deployados na Lunes Chain.

### Ordem de deploy

```text
1. BurnEngine       (sem dependencias)
2. Tax Manager      (precisa do endereco do BurnEngine)
3. LUSDT Token      (precisa do endereco do Tax Manager)
4. Configuracao     (conectar contratos entre si)
```

### Deploy local (automatizado)

```bash
# Iniciar no Lunes local
docker start node-lunes    # ws://localhost:9944

# Opcao A: via cargo-contract (shell)
../contracts/scripts/deploy_local.sh

# Opcao B: via polkadot-js (Node.js)
node ../contracts/scripts/deploy_polkadotjs.mjs
```

Ambos os scripts fazem:
1. Upload e instantiate do Tax Manager
2. Upload e instantiate do LUSDT Token (com endereco do Tax Manager)
3. Salvam enderecos em `contracts/deployments/`

### Deploy manual (passo a passo)

```bash
# Pre-requisitos
cargo-contract --version   # 3.2.0
rustc +1.85.0 --version    # 1.85.0

# === 1. BurnEngine ===
cd ../contracts/burn_engine
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000
# Anotar: BURN_ENGINE_ADDRESS=<endereco>

# === 2. Tax Manager ===
cd ../tax_manager
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --args \
    "<LUNES_TOKEN_ADDRESS>" \
    "<LUSDT_TOKEN_PLACEHOLDER>" \
    '{"dev_solana":"<DEV_WALLET>","dev_lunes":"<DEV_LUNES>","insurance_fund":"<INSURANCE>"}' \
    500000 \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000
# Anotar: TAX_MANAGER_ADDRESS=<endereco>

# === 3. LUSDT Token ===
cd ../lusdt_token
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --args \
    "<TAX_MANAGER_ADDRESS>" \
    "<BRIDGE_ACCOUNT>" \
    "<EMERGENCY_ADMIN>" \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000
# Anotar: LUSDT_TOKEN_ADDRESS=<endereco>
```

### Configuracao pos-deploy (Lunes)

```bash
# Atualizar Tax Manager com endereco real do LUSDT Token
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message update_lusdt_token_address \
  --args "<LUSDT_TOKEN_ADDRESS>" \
  --suri //Alice --url ws://localhost:9944

# Configurar BurnEngine (OBRIGATORIO para dual-fee)
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message set_burn_engine \
  --args "<BURN_ENGINE_ADDRESS>" \
  --suri //Alice --url ws://localhost:9944

# Configurar LUNES burn fee (10 = 0.10%)
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message set_lunes_burn_fee_bps \
  --args 10 \
  --suri //Alice --url ws://localhost:9944
```

### Copiar ABI para o bridge-service

```bash
mkdir -p src/contracts
cp ../target/ink/tax_manager/tax_manager.json src/contracts/
```

### Deploy em mainnet Lunes

```bash
# Via script (le seed do .env)
../contracts/scripts/deploy_lusdt.sh

# Via polkadot-js (Node.js)
node scripts/deploy_lusdt.js
```

> **Nota:** Em producao, use wallet dedicada com saldo em LUNES. A seed e lida de `LUNES_WALLET_SEED`.

### Verificacao

```bash
# Teste E2E cross-contract (mint + burn + volume tracking)
NODE_PATH=node_modules node ../contracts/scripts/e2e_test_crosscontract.js

# Queries manuais
cargo contract call --contract <LUSDT_TOKEN_ADDRESS> \
  --message total_supply --suri //Alice --url ws://localhost:9944 --dry-run

cargo contract call --contract <TAX_MANAGER_ADDRESS> \
  --message get_current_fee_bps --suri //Alice --url ws://localhost:9944 --dry-run
```

> **Gas/proofSize:** Use `proofSize >= 5_000_000` para queries via polkadot-js.
> Valores baixos causam `OutOfGas` silencioso.

Documentacao completa: [`contracts/DEPLOYMENT_RUNBOOK.md`](../contracts/DEPLOYMENT_RUNBOOK.md) e [`contracts/CROSS_CONTRACT_DEPLOY.md`](../contracts/CROSS_CONTRACT_DEPLOY.md)

## Deploy Solana (Treasury Multisig)

O lado Solana requer um **cofre multisig** (3-de-5) que guarda o USDT colateral.

### Pre-requisitos

```bash
# Instalar Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Instalar SPL Token CLI
cargo install spl-token-cli

# Verificar
solana --version
spl-token --version
```

### Deploy automatizado

```bash
# Script completo (gera chaves + cria multisig + cria treasury)
../scripts/setup-solana-multisig.sh

# Para testes locais (inicia validator + cria tudo)
../scripts/setup-local-test.sh
```

### Deploy manual (passo a passo)

```bash
# 1. Configurar rede
solana config set --url devnet          # testes
# solana config set --url mainnet-beta  # producao

# 2. Gerar chaves dos guardioes (5 chaves)
mkdir -p solana-keys
for i in 1 2 3 4 5; do
  solana-keygen new --no-passphrase \
    --outfile solana-keys/guardian_${i}_keypair.json
done

# 3. Financiar o pagador
solana airdrop 2 solana-keys/guardian_1_keypair.json  # devnet

# 4. Criar autoridade multisig 3-de-5
GUARDIAN_1=$(solana-keygen pubkey solana-keys/guardian_1_keypair.json)
GUARDIAN_2=$(solana-keygen pubkey solana-keys/guardian_2_keypair.json)
GUARDIAN_3=$(solana-keygen pubkey solana-keys/guardian_3_keypair.json)
GUARDIAN_4=$(solana-keygen pubkey solana-keys/guardian_4_keypair.json)
GUARDIAN_5=$(solana-keygen pubkey solana-keys/guardian_5_keypair.json)

spl-token create-multisig 3 \
  $GUARDIAN_1 $GUARDIAN_2 $GUARDIAN_3 $GUARDIAN_4 $GUARDIAN_5 \
  --fee-payer solana-keys/guardian_1_keypair.json
# Anotar: MULTISIG_AUTHORITY=<endereco>

# 5. Criar conta de token do tesouro (controlada pelo multisig)
# USDT Devnet:  Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
# USDT Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDT_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

spl-token create-account $USDT_MINT \
  --owner <MULTISIG_AUTHORITY> \
  --fee-payer solana-keys/guardian_1_keypair.json
# Anotar: TREASURY_TOKEN_ACCOUNT=<endereco>

# 6. Verificar
spl-token balance --address <TREASURY_TOKEN_ACCOUNT>
spl-token account-info --address <TREASURY_TOKEN_ACCOUNT>
```

> **PRODUCAO:** Gere chaves em dispositivos isolados (hardware wallets). **NUNCA** commit chaves no git.

### Enderecos para o .env

Apos o deploy, configure no `.env` do bridge-service:

```bash
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
TREASURY_ACCOUNT_ADDRESS=<endereco_treasury>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

## Configuracao

### Variaveis de Ambiente Essenciais

```bash
# ── Servidor ───────────────────────────────
NODE_ENV=production          # development | staging | production
PORT=3001

# ── Blockchains ────────────────────────────
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
LUNES_RPC_URL=wss://ws.lunes.io
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
LUSDT_CONTRACT_ADDRESS=<endereco_contrato_lusdt>
TAX_MANAGER_CONTRACT_ADDRESS=<endereco_tax_manager>

# ── Banco de Dados / Cache ─────────────────
DATABASE_URL=postgresql://bridge_user:senha@localhost:5432/bridge_db
REDIS_URL=redis://localhost:6379

# ── Carteiras de Taxa (Solana) ─────────────
DEV_SOLANA_WALLET=<pubkey>
INSURANCE_SOLANA_WALLET=<pubkey>
STAKING_REWARDS_SOLANA_WALLET=<pubkey>

# ── HSM / Signer ──────────────────────────
# Opcao A: HashiCorp Vault (recomendado VPS)
HSM_TYPE=hashicorp_vault
VAULT_URL=http://127.0.0.1:8200
VAULT_TOKEN=<token_com_policy_bridge-signer>
VAULT_KEY_PATH=transit
VAULT_KEY_NAME=solana-bridge

# Opcao B: AWS KMS (envelope encryption)
# HSM_TYPE=aws_kms
# AWS_KMS_KEY_ID=<kms-key-id>
# SOLANA_ENCRYPTED_KEY=<base64_encrypted_keypair>

# Opcao C: Local (SOMENTE para dev)
# HSM_TYPE=local
# SOLANA_WALLET_PRIVATE_KEY=<base58_key>

# ── Multisig Vault ─────────────────────────
REQUIRE_MULTISIG_VAULT=true
BOT_ORIGIN_SECRET=<secret_hmac_bot_1>
BOT_RISK_SECRET=<secret_hmac_bot_2>
BOT_BACKUP_SECRET=<secret_hmac_bot_3>
MULTISIG_REQUIRED_APPROVALS=2
MULTISIG_TOTAL_BOTS=3
MULTISIG_HIGH_VALUE_THRESHOLD=5000
MULTISIG_TIMELOCK_MS=600000
MULTISIG_PROPOSAL_TTL_MS=300000

# ── Limites ────────────────────────────────
HOT_WALLET_SINGLE_TX_LIMIT=10000
HOT_WALLET_DAILY_LIMIT=50000
MAX_TRANSACTION_VALUE=100000
TREASURY_MIN_BALANCE=50000

# ── Alertas (opcional) ─────────────────────
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL=ops@seudominio.com
```

Referencia completa: [`env-vps.example`](env-vps.example)

## Estrutura do Projeto

```
bridge-service/
├── src/
│   ├── index.ts                 # Entrypoint — Express server, rotas, lifecycle
│   ├── config/
│   │   └── env.ts               # Carregamento e validacao de env vars
│   ├── bridge/
│   │   ├── processor.ts         # BridgeProcessor — fluxo principal Solana<->Lunes
│   │   ├── database.ts          # PostgreSQL — persistencia de transacoes
│   │   └── usdt-fee-collector.ts # Coleta de taxas USDT (legacy/fallback)
│   ├── solana/
│   │   └── client.ts            # SolanaClient — conexao RPC, SPL transfers
│   ├── lunes/
│   │   └── client.ts            # LunesClient — Polkadot API, ink! contracts
│   ├── multisig/                # *** Sistema Multisig Vault ***
│   │   ├── types.ts             # Tipos: Proposal, Bot, CircuitBreaker, Signer
│   │   ├── hsm-signer.ts        # Signers: Local, AWS KMS, HashiCorp Vault
│   │   ├── circuit-breaker.ts   # Circuit breaker (closed/open/half_open)
│   │   ├── proposal-manager.ts  # Lifecycle de propostas, spending limits
│   │   ├── approval-bots.ts     # 3 bots: Origin, Risk, Backup validators
│   │   ├── vault-executor.ts    # Orquestrador do fluxo multisig
│   │   ├── squads-client.ts     # Squads Protocol SDK (multisig on-chain)
│   │   ├── redis-store.ts       # Persistencia Redis (propostas, counters)
│   │   └── index.ts             # Re-exports
│   ├── admin/
│   │   └── adminRoutes.ts       # Rotas admin protegidas
│   ├── monitoring/
│   │   └── metrics.ts           # Prometheus metrics
│   ├── contracts/
│   │   └── tax_manager.json     # ABI do contrato TaxManager (ink!)
│   ├── utils/
│   │   ├── logger.ts            # Winston logger
│   │   └── helpers.ts           # Utilitarios
│   ├── db/
│   │   └── schema.sql           # Schema PostgreSQL
│   └── __tests__/
│       ├── multisig.test.ts     # 38 testes multisig
│       └── bridge.test.ts       # 34 testes bridge
├── dist/                        # Output compilado (gerado por `pnpm build`)
├── package.json
├── tsconfig.json
├── Dockerfile                   # Multi-stage build (builder + production)
├── docker-compose.yml           # Stack completa local (Postgres, Redis, etc)
├── env-vps.example              # Template de .env para producao
└── logs/                        # Logs da aplicacao
```

## Sistema Multisig

### Visao Geral

O bridge **nao executa transferencias diretamente**. Cada transferencia Lunes->Solana passa pelo sistema multisig:

1. **BridgeProcessor** detecta evento de burn na Lunes chain
2. **VaultExecutor** cria uma **proposta** no ProposalManager
3. **3 bots** avaliam a proposta em paralelo
4. Se **quorum** (2/3 normal, 3/3 para high-value) atingido -> executa
5. Se **rejeitado** -> bloqueia, loga, circuit breaker reage

### Bots de Aprovacao

| Bot | Funcao | Validacoes |
|-----|--------|------------|
| **OriginValidator** | Valida origem da transacao | Tx fonte finalizada, amount match, recipient valido |
| **RiskValidator** | Analisa risco e limites | Velocidade de propostas, volume por destinatario, solvencia do vault |
| **BackupValidator** | Contingencia e integridade | Saude do servico, DB acessivel, cross-ref com banco, freshness |

### Politica de Consenso

```
Transferencia normal (< $5K):
  Quorum: 2 de 3 bots
  Execucao: imediata apos quorum

Transferencia high-value (>= $5K):
  Quorum: 3 de 3 bots
  Timelock: 10 minutos antes de executar
```

### Limites de Gasto

| Limite | Valor Padrao | Configuravel via |
|--------|-------------|-----------------|
| **Por transacao** | $10,000 | `HOT_WALLET_SINGLE_TX_LIMIT` |
| **Por hora** | $25,000 | Codigo (SpendingPolicy) |
| **Por dia** | $50,000 | `HOT_WALLET_DAILY_LIMIT` |

### Circuit Breaker

```
closed ────(5 falhas em 10min)────▶ open
  ▲                                     │
  │                                 (5min timeout)
  │                                     │
  └──(sucesso)── half_open ◀────────────┘
                     │
                (falha)──────────────▶ open
```

- **closed**: operacao normal
- **open**: todas as propostas bloqueadas
- **half_open**: permite 2 tentativas de recovery
- **forceReset**: operadores podem resetar manualmente via admin

### HSM / KMS Signers

Chaves privadas **nunca ficam em variaveis de ambiente** em producao:

| Modo | Uso | Como funciona |
|------|-----|---------------|
| **Local** | Dev/teste | Chave base58 em env (inseguro) |
| **AWS KMS** | Cloud | Envelope encryption — keypair ed25519 criptografado pelo KMS |
| **HashiCorp Vault** | VPS | Transit engine com key_type=ed25519, chave nunca sai do Vault |

## Fluxos de Operacao

### Deposito / Mint (USDT -> LUSDT) — Dual-Fee v3

1. Usuario deposita USDT no treasury Solana
2. Bridge detecta a transacao e valida endereco Lunes no memo
3. Deducao de taxa ANTES do mint (preserva backing ratio 1:1):
   - Calcula stablecoin fee (0.30-0.60% USDT)
   - Distribui USDT: **80% dev / 15% insurance / 5% staking**
4. Mint LUSDT (amount - fee) via Lunes chain
5. On-chain: LUSDT.mint() cobra 0.10% LUNES burn fee
6. Confirmacao e notificacao

### Saque / Burn (LUSDT -> USDT) — Dual-Fee v3

1. Usuario chama `burn()` no contrato LUSDT
2. On-chain: Tax Manager cobra dual-fee:
   - 0.30-0.60% LUSDT (stablecoin fee) -> distribui 80/15/5
   - 0.10% LUNES (burn fee) -> BurnEngine
3. Evento `RedemptionRequested` emitido
4. Bridge processa o evento
5. **VaultExecutor** executa transferencia USDT via multisig
6. Confirmacao e atualizacao de status

### Distribuicao de Taxas

```
Stablecoin Fee
├── 80% -> Dev wallet
├── 15% -> Insurance fund
└──  5% -> Staking rewards pool
```

## Testes

```bash
cd bridge-service

# Rodar todos os testes (72 testes)
pnpm test

# Modo watch (re-executa ao salvar)
pnpm test:watch

# Com cobertura de codigo
pnpm test:coverage
```

**Suites de teste:**

| Suite | Testes | Cobre |
|-------|--------|-------|
| `multisig.test.ts` | 38 | CircuitBreaker, ProposalManager, 3 Bots, integracao |
| `bridge.test.ts` | 34 | BridgeProcessor, SolanaClient, LunesClient |

## Deploy Local (Docker)

### Stack completa

```bash
cd bridge-service

# Subir tudo: bridge + postgres + redis + prometheus + grafana + nginx
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f bridge-service
```

### Somente dependencias (para desenvolvimento)

```bash
# Subir apenas postgres e redis
docker-compose up -d postgres redis

# Rodar bridge em modo dev (hot-reload)
pnpm dev
```

### Build da imagem Docker

```bash
# Build multi-stage (builder + production)
docker build -t lusdt-bridge:latest .

# Executar standalone
docker run -p 3000:3000 --env-file .env lusdt-bridge:latest
```

A imagem usa:

- **Alpine Linux** (tamanho minimo)
- **Usuario nao-root** (seguranca)
- **dumb-init** (PID 1 correto)
- **Healthcheck** integrado (`/health`)

## Deploy VPS (Producao)

Guia completo em [`Docs/VPS_DEPLOYMENT_BRIDGE.md`](../Docs/VPS_DEPLOYMENT_BRIDGE.md).

### Resumo rapido

```bash
# 1. Bootstrap da VPS (instala Docker, Redis, Vault)
chmod +x scripts/setup-vps-bridge.sh
sudo scripts/setup-vps-bridge.sh

# 2. Inicializar Vault Transit (cria chave ed25519)
chmod +x scripts/init-vault-transit.sh
scripts/init-vault-transit.sh
# Guarde: Unseal Keys, Root Token, Bridge Token

# 3. Configurar ambiente
cp bridge-service/env-vps.example /opt/lusdt/bridge-service/.env
nano /opt/lusdt/bridge-service/.env
# Preencha: VAULT_TOKEN, BOT secrets, DB, RPCs, wallets

# 4. Build e deploy
cd /opt/lusdt/bridge-service
pnpm install --frozen-lockfile
pnpm build

# 5. Instalar como servico systemd
sudo cp scripts/lusdt-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lusdt-bridge
sudo systemctl start lusdt-bridge

# 6. Verificar
sudo systemctl status lusdt-bridge
curl http://localhost:3001/health
```

### Arquivos de deploy

| Arquivo | Funcao |
|---------|--------|
| `scripts/setup-vps-bridge.sh` | Bootstrap: Docker, Redis, Vault |
| `scripts/init-vault-transit.sh` | Inicializa Vault, cria chave ed25519 |
| `scripts/lusdt-bridge.service` | Unidade systemd |
| `env-vps.example` | Template de producao |
| `Docs/VPS_DEPLOYMENT_BRIDGE.md` | Runbook completo |

## Endpoints da API

### Publicos

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/metrics` | Metricas Prometheus |
| GET | `/transactions/:signature` | Status de uma transacao |
| GET | `/stats` | Estatisticas gerais |

### Admin (protegidos por Basic Auth)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/admin/fee-collector/initialize` | Inicializar fee collector |
| GET | `/admin/fee-collector/stats` | Estatisticas de taxas |
| POST | `/admin/fee-collector/update-dev-wallet` | Atualizar dev wallet |
| GET | `/admin/fee-collector/insurance-wallet` | Ver insurance wallet |
| POST | `/admin/fee-collector/pause` | Pausar coleta |
| POST | `/admin/fee-collector/resume` | Retomar coleta |

## Monitoramento

| Servico | URL Local | Credenciais |
|---------|-----------|-------------|
| **Bridge Service** | http://localhost:3000 | — |
| **Grafana** | http://localhost:3001 | admin / admin123 |
| **Prometheus** | http://localhost:9090 | — |
| **PostgreSQL** | localhost:15432 | bridge_user / bridge_password |
| **Redis** | localhost:16379 | — |

### Logs

```json
{
  "timestamp": "2026-02-13T22:30:00.000Z",
  "level": "info",
  "message": "Multisig transfer executed",
  "data": {
    "proposalId": "prop_1707...",
    "signature": "5j7s8...",
    "amount": 1000,
    "approvals": 2
  }
}
```

Niveis: `DEBUG` | `INFO` | `WARN` | `ERROR`

## Troubleshooting

### Build falha com erros TypeScript

```bash
# Verificar versao do Node
node -v   # deve ser >= 18

# Limpar e reinstalar
rm -rf node_modules dist
pnpm install
pnpm build
```

### Falta `src/contracts/tax_manager.json`

Este arquivo e gerado pelo build do contrato ink! e precisa existir em `src/contracts/`:

```bash
# Se o contrato ja foi compilado, copie:
cp ../target/ink/tax_manager/tax_manager.json src/contracts/
```

### Bridge nao conecta ao Redis/Postgres

```bash
# Verificar se os containers estao rodando
docker-compose ps

# Verificar logs
docker-compose logs redis
docker-compose logs postgres

# Testar conexao manual
redis-cli -h 127.0.0.1 -p 16379 ping
psql postgresql://bridge_user:bridge_password@localhost:15432/bridge_db
```

### Circuit breaker aberto (propostas bloqueadas)

```bash
# Verificar status via API
curl http://localhost:3000/health | jq '.circuitBreaker'

# Resetar via admin (requer auth)
curl -X POST http://localhost:3000/admin/circuit-breaker/reset \
  -u ops:password
```

### Vault signer falha na inicializacao

```bash
# Verificar se Vault esta rodando
vault status

# Verificar se a chave Transit existe
vault read transit/keys/solana-bridge

# Verificar token tem permissao
vault token lookup
```

## Contribuicao

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nome`)
3. Commit (`git commit -m 'feat: descricao'`)
4. Push (`git push origin feature/nome`)
5. Abra um Pull Request

## Licenca

MIT License — veja [LICENSE](LICENSE).

## Suporte

- **Discord**: [Lunes Community](https://discord.gg/lunes)
- **Email**: dev@lunes.io
- **Docs**: [docs.lunes.io](https://docs.lunes.io)
- **Issues**: [GitHub Issues](https://github.com/lunes-platform/LUSDT/issues)

---

Desenvolvido pela equipe **Lunes Platform**