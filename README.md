# LUSDT Bridge Platform

**Stablecoin cross-chain LUSDT — Ponte Solana (USDT) <-> Lunes (LUSDT)**

[![Rust](https://img.shields.io/badge/ink!-4.2.1-orange.svg)](https://use.ink/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Indice

- [Sobre o Projeto](#sobre-o-projeto)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pre-requisitos](#pre-requisitos)
- [Tutorial de Build](#tutorial-de-build)
- [Deploy Contratos Lunes (ink!)](#deploy-contratos-lunes-ink)
- [Deploy Solana (Treasury Multisig)](#deploy-solana-treasury-multisig)
- [Configuracao Pos-Deploy](#configuracao-pos-deploy)
- [Modelo de Taxas v3](#modelo-de-taxas-v3-dual-fee)
- [Sistema Multisig Vault](#sistema-multisig-vault)
- [Fluxos de Operacao](#fluxos-de-operacao)
- [Deploy VPS (Producao)](#deploy-vps-producao)
- [Testes](#testes)
- [Seguranca](#seguranca)
- [Documentacao](#documentacao)
- [Roadmap](#roadmap)

## Sobre o Projeto

Plataforma completa de bridge cross-chain entre Solana e Lunes com:

- Stablecoin LUSDT colateralizada 1:1 por USDT (Proof of Reserve)
- Modelo de taxas dual-fee v3 (taxa em stablecoin + queima deflacionaria de LUNES)
- Distribuicao de receita: 80% dev / 15% insurance / 5% staking rewards
- Sistema multisig vault com 3 bots de aprovacao e circuit breaker
- HSM/KMS para protecao de chaves (AWS KMS ou HashiCorp Vault)
- Staking rewards para holders de LUNES (minimo 100k, distribuicao mensal)

## Arquitetura

```text
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Frontend  │    │  Bridge Service  │    │  Smart Contracts  │
│   (React)   │◄──►│  (Node.js/TS)    │◄──►│  (Rust / ink!)    │
│   Vite+TW   │    │                  │    │  Lunes Chain      │
└─────────────┘    └────────┬─────────┘    └──────────────────┘
       │                    │                        │
       ▼                    ▼                        ▼
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    USDT     │    │  Multisig Vault  │    │  LUSDT Token     │
│ (SPL Token) │    │  ┌────────────┐  │    │  Tax Manager     │
│   Solana    │    │  │ 3 Bots     │  │    │  BurnEngine      │
└─────────────┘    │  │ HSM Signer │  │    └──────────────────┘
                   │  │ Circ.Break │  │
                   │  └────────────┘  │
                   └──────────────────┘
```

### Smart Contracts (ink! 4.2.1)

| Contrato | Descricao |
|----------|-----------|
| **LUSDT Token** | Token PSP22 com mint/burn, RBAC, pausa de emergencia, rate limiting |
| **Tax Manager** | Calculo e distribuicao de taxas, adaptive fees por volume, BurnEngine integration |
| **BurnEngine** | Mecanismo deflacionario permissionless |

### Bridge Service (Node.js/TypeScript)

| Modulo | Descricao |
|--------|-----------|
| **BridgeProcessor** | Fluxo principal Solana <-> Lunes, deteccao de eventos |
| **VaultExecutor** | Orquestrador multisig: proposta -> bots -> quorum -> execucao |
| **Approval Bots** | 3 bots independentes: Origin, Risk, Backup validators |
| **HSM Signer** | Abstracoes: Local (dev), AWS KMS, HashiCorp Vault |
| **Circuit Breaker** | Pausa automatica closed/open/half_open |
| **Squads Client** | Integracao com Squads Protocol para multisig on-chain |
| **Redis Store** | Persistencia de propostas, spending counters, audit log |

## Estrutura do Projeto

```
LUSDT/
├── contracts/                   # Smart Contracts (Rust/ink!)
│   ├── common/                  # Tipos e traits compartilhados
│   ├── lusdt_token/             # Token LUSDT (PSP22 + RBAC)
│   ├── tax_manager/             # Sistema de Taxas v3 (dual-fee + staking)
│   ├── burn_engine/             # Mecanismo deflacionario de LUNES
│   └── scripts/                 # Deploy e testes E2E
├── bridge-service/              # Servico Off-chain (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts             # Entrypoint — Express server
│   │   ├── config/env.ts        # Variaveis de ambiente
│   │   ├── bridge/              # BridgeProcessor, Database, FeeCollector
│   │   ├── solana/client.ts     # Cliente Solana (USDT SPL transfers)
│   │   ├── lunes/client.ts      # Cliente Lunes (Polkadot API, ink!)
│   │   ├── multisig/            # *** Sistema Multisig Vault ***
│   │   │   ├── types.ts         # Tipos: Proposal, Bot, Signer, Policy
│   │   │   ├── hsm-signer.ts    # Local / AWS KMS / HashiCorp Vault
│   │   │   ├── circuit-breaker.ts
│   │   │   ├── proposal-manager.ts
│   │   │   ├── approval-bots.ts # 3 bots segregados
│   │   │   ├── vault-executor.ts
│   │   │   ├── squads-client.ts # Squads Protocol SDK
│   │   │   └── redis-store.ts   # Persistencia Redis
│   │   ├── admin/               # Rotas admin protegidas
│   │   ├── monitoring/          # Metricas Prometheus
│   │   ├── contracts/           # ABI do TaxManager (ink!)
│   │   └── __tests__/           # 72 testes (38 multisig + 34 bridge)
│   ├── Dockerfile               # Multi-stage build
│   ├── docker-compose.yml       # Stack local completa
│   ├── env-vps.example          # Template de producao
│   ├── package.json
│   └── tsconfig.json
├── lusdt-app/                   # Frontend (React + TailwindCSS)
│   ├── src/components/          # UI: AdminPanel, Staking, Bridge
│   └── src/hooks/               # useAdminContract, useWallet
├── scripts/                     # Scripts de deploy e operacao
│   ├── setup-vps-bridge.sh      # Bootstrap VPS: Docker, Redis, Vault
│   ├── init-vault-transit.sh    # Inicializa Vault Transit + chave ed25519
│   ├── lusdt-bridge.service     # Unidade systemd
│   ├── setup-solana-multisig.sh # Cria multisig 3-of-5 na Solana
│   └── setup-local-test.sh      # Validator local Solana para testes
├── Docs/
│   └── VPS_DEPLOYMENT_BRIDGE.md # Runbook deploy VPS completo
└── target/ink/                  # Output de compilacao dos contratos
```

## Pre-requisitos

| Ferramenta | Versao | Notas |
|---|---|---|
| **Node.js** | >= 18 | LTS recomendado |
| **pnpm** | >= 9 | Gerenciador de pacotes (`npm i -g pnpm`) |
| **Rust** | 1.85.0 | Via rustup (`rustup toolchain install 1.85.0`) |
| **cargo-contract** | 3.2.0 | `cargo install cargo-contract --version 3.2.0` |
| **Docker** | >= 24 | Para containers locais e producao |
| **Docker Compose** | >= 2.20 | Plugin do Docker |
| **PostgreSQL** | >= 15 | Banco de dados principal |
| **Redis** | >= 7 | Cache e persistencia multisig |

**Producao (adicional):**

- **HashiCorp Vault** 1.15+ — chaves ed25519 via Transit engine
- ou **AWS KMS** — envelope encryption

## Tutorial de Build

### Passo 1 — Clonar e instalar

```bash
git clone https://github.com/lunes-platform/LUSDT.git
cd LUSDT
pnpm install
```

### Passo 2 — Compilar Smart Contracts (ink!)

Os contratos precisam do Rust toolchain 1.85.0:

```bash
# Instalar toolchain (se necessario)
rustup toolchain install 1.85.0
rustup component add rust-src --toolchain 1.85.0

# Instalar cargo-contract (se necessario)
cargo install cargo-contract --version 3.2.0

# Compilar os 3 contratos
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build \
  --manifest-path contracts/lusdt_token/Cargo.toml --release

RUSTUP_TOOLCHAIN=1.85.0 cargo contract build \
  --manifest-path contracts/tax_manager/Cargo.toml --release

RUSTUP_TOOLCHAIN=1.85.0 cargo contract build \
  --manifest-path contracts/burn_engine/Cargo.toml --release
```

Os artefatos sao gerados em `target/ink/<contrato>/`:

- `<contrato>.wasm` — bytecode do contrato
- `<contrato>.json` — metadata/ABI
- `<contrato>.contract` — bundle para deploy

### Passo 3 — Copiar ABI para o Bridge Service

O bridge-service precisa do ABI do TaxManager:

```bash
mkdir -p bridge-service/src/contracts
cp target/ink/tax_manager/tax_manager.json bridge-service/src/contracts/
```

### Passo 4 — Compilar o Bridge Service (TypeScript)

```bash
cd bridge-service
pnpm install
pnpm build
```

Isso executa `tsc` e gera JavaScript em `dist/`. O build deve terminar **sem erros**.

Se houver problemas:

```bash
# Limpar e reconstruir
rm -rf node_modules dist
pnpm install
pnpm build
```

### Passo 5 — Rodar testes

```bash
# Testes dos contratos (Rust)
cargo test -p tax_manager -p lusdt_token -p burn_engine

# Testes do bridge-service (72 testes)
cd bridge-service
pnpm test
```

### Passo 6 — Configurar ambiente

```bash
cd bridge-service

# Copiar template
cp env-vps.example .env

# Editar com suas configuracoes
nano .env
```

Variaveis essenciais:

```bash
# RPCs
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
LUNES_RPC_URL=wss://ws.lunes.io

# Contratos
LUSDT_CONTRACT_ADDRESS=<endereco>
TAX_MANAGER_CONTRACT_ADDRESS=<endereco>
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Banco / Cache
DATABASE_URL=postgresql://bridge_user:senha@localhost:5432/bridge_db
REDIS_URL=redis://localhost:6379

# HSM (escolha um)
HSM_TYPE=hashicorp_vault   # ou aws_kms, ou local (dev)
VAULT_URL=http://127.0.0.1:8200
VAULT_TOKEN=<token>
VAULT_KEY_NAME=solana-bridge

# Multisig bots
BOT_ORIGIN_SECRET=<secret_1>
BOT_RISK_SECRET=<secret_2>
BOT_BACKUP_SECRET=<secret_3>
```

Referencia completa: [`bridge-service/env-vps.example`](bridge-service/env-vps.example)

### Passo 7 — Executar

```bash
# Desenvolvimento (hot-reload)
cd bridge-service
pnpm dev

# Producao
cd bridge-service
pnpm start

# Ou via Docker (stack completa)
cd bridge-service
docker-compose up -d
```

### Resumo de comandos

```bash
# Build completo do zero:
git clone https://github.com/lunes-platform/LUSDT.git
cd LUSDT
pnpm install

# Contratos
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/lusdt_token/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/tax_manager/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/burn_engine/Cargo.toml --release

# Copiar ABI
cp target/ink/tax_manager/tax_manager.json bridge-service/src/contracts/

# Bridge service
cd bridge-service
pnpm build
pnpm test        # 72 testes devem passar
```

## Deploy Contratos Lunes (ink!)

Os smart contracts ink! sao deployados na **Lunes Chain** (Substrate com pallet `contracts`).

### Ordem de deploy

```
1. BurnEngine       (sem dependencias)
2. Tax Manager      (precisa do endereco do BurnEngine)
3. LUSDT Token      (precisa do endereco do Tax Manager)
4. Configuracao     (conectar contratos entre si)
```

### Pre-requisitos

```bash
# Ferramentas
cargo-contract --version   # 3.2.0
rustc +1.85.0 --version    # 1.85.0

# No local rodando (para desenvolvimento)
docker start node-lunes    # ws://localhost:9944
# Ou conectar a mainnet: wss://ws.lunes.io
```

### Passo 1 — Deploy do BurnEngine

```bash
cd contracts/burn_engine

RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release

RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000

# Anotar: BURN_ENGINE_ADDRESS=<endereco>
```

### Passo 2 — Deploy do Tax Manager

```bash
cd contracts/tax_manager

RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release

RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --args \
    "<LUNES_TOKEN_ADDRESS>" \
    "<LUSDT_TOKEN_PLACEHOLDER>" \
    '{"dev_solana":"<DEV_SOLANA_WALLET>","dev_lunes":"<DEV_LUNES_WALLET>","insurance_fund":"<INSURANCE_FUND>"}' \
    500000 \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000

# Anotar: TAX_MANAGER_ADDRESS=<endereco>
```

**Parametros do construtor:**

| Parametro | Descricao | Exemplo (local) |
|-----------|-----------|-----------------|
| `lunes_token_address` | Endereco do token LUNES (PSP22) | Alice |
| `lusdt_token_address` | Placeholder (atualizado depois) | Alice |
| `distribution_wallets` | Struct com dev_solana, dev_lunes, insurance_fund | Ver abaixo |
| `initial_lunes_price` | Preco do LUNES em USD (6 decimais) | `500000` ($0.50) |

**Wallets de distribuicao (local):**

| Wallet | Conta | Percentual |
|--------|-------|------------|
| `dev_solana` | Alice (`5Grwva...`) | 80% taxas USDT |
| `dev_lunes` | Bob (`5FHneW...`) | 80% taxas LUSDT |
| `insurance_fund` | Charlie (`5FLSig...`) | 15% todas as taxas |

### Passo 3 — Deploy do LUSDT Token

```bash
cd contracts/lusdt_token

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

**Parametros do construtor:**

| Parametro | Descricao | Exemplo (local) |
|-----------|-----------|-----------------|
| `tax_manager` | Endereco do Tax Manager deployado | `TAX_MANAGER_ADDRESS` |
| `bridge_account` | Conta que pode fazer mint (MINTER_ROLE) | Alice |
| `emergency_admin` | Conta que pode pausar (PAUSER_ROLE) | Charlie |

**Roles RBAC (configurados automaticamente):**

| Role | Conta | Permissao |
|------|-------|-----------|
| `DEFAULT_ADMIN_ROLE (0)` | Deployer (Alice) | Gerencia roles, upgrade |
| `PAUSER_ROLE (1)` | Emergency Admin (Charlie) | Pausa de emergencia |
| `MINTER_ROLE (2)` | Bridge Account (Alice) | Mint de LUSDT |
| `TAX_MANAGER_ROLE (3)` | Deployer (Alice) | Configurar taxas |

### Passo 4 — Configuracao pos-deploy (Lunes)

```bash
# Atualizar Tax Manager com endereco real do LUSDT Token
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message update_lusdt_token_address \
  --args "<LUSDT_TOKEN_ADDRESS>" \
  --suri //Alice \
  --url ws://localhost:9944

# Configurar BurnEngine no Tax Manager (OBRIGATORIO para dual-fee)
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message set_burn_engine \
  --args "<BURN_ENGINE_ADDRESS>" \
  --suri //Alice \
  --url ws://localhost:9944

# Configurar LUNES burn fee (padrao: 10 = 0.10%)
cargo contract call \
  --contract <TAX_MANAGER_ADDRESS> \
  --message set_lunes_burn_fee_bps \
  --args 10 \
  --suri //Alice \
  --url ws://localhost:9944
```

### Deploy automatizado (local)

Para desenvolvimento local, use o script automatizado:

```bash
# Via cargo-contract (shell)
contracts/scripts/deploy_local.sh

# Via polkadot-js (Node.js)
cd bridge-service
node ../contracts/scripts/deploy_polkadotjs.mjs
```

### Deploy em mainnet Lunes

```bash
# Via script (le seed do bridge-service/.env)
contracts/scripts/deploy_lusdt.sh

# Via polkadot-js (Node.js)
cd bridge-service
node scripts/deploy_lusdt.js
```

> **Importante:** Em producao, use uma wallet dedicada com saldo suficiente em LUNES
> para pagar gas. A seed e lida de `LUNES_WALLET_SEED` no `.env`.

### Verificacao de deploy

```bash
# Script de verificacao
contracts/scripts/verify_deployment.sh local <TAX_MANAGER_ADDRESS> <LUSDT_TOKEN_ADDRESS>

# Teste E2E cross-contract (mint + burn + volume tracking)
cd bridge-service
NODE_PATH=node_modules node ../contracts/scripts/e2e_test_crosscontract.js

# Queries manuais via cargo-contract
cargo contract call --contract <LUSDT_TOKEN_ADDRESS> \
  --message total_supply --suri //Alice --url ws://localhost:9944 --dry-run

cargo contract call --contract <TAX_MANAGER_ADDRESS> \
  --message get_monthly_volume_usd --suri //Alice --url ws://localhost:9944 --dry-run

cargo contract call --contract <TAX_MANAGER_ADDRESS> \
  --message get_current_fee_bps --suri //Alice --url ws://localhost:9944 --dry-run
```

> **Gas/proofSize:** Use `proofSize >= 5_000_000` para queries via polkadot-js.
> Valores baixos (250_000) causam `OutOfGas` silencioso.

## Deploy Solana (Treasury Multisig)

O lado Solana requer a configuracao de um **cofre multisig** que guarda o USDT colateral.

### Pre-requisitos Solana

```bash
# Instalar Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Instalar SPL Token CLI
cargo install spl-token-cli

# Verificar
solana --version
spl-token --version
```

### Passo 1 — Configurar rede

```bash
# Devnet (testes)
solana config set --url devnet

# Mainnet (producao)
solana config set --url mainnet-beta
```

### Passo 2 — Gerar chaves dos guardioes

O cofre usa um multisig **3-de-5** (3 assinaturas de 5 guardioes para movimentar fundos).

```bash
mkdir -p solana-keys

# Gerar 5 pares de chaves
for i in 1 2 3 4 5; do
  solana-keygen new --no-passphrase \
    --outfile solana-keys/guardian_${i}_keypair.json
done

# Verificar chaves publicas
for i in 1 2 3 4 5; do
  echo "Guardian $i: $(solana-keygen pubkey solana-keys/guardian_${i}_keypair.json)"
done
```

> **PRODUCAO:** Gere as chaves em dispositivos isolados (hardware wallets).
> **NUNCA** commit as chaves no git.

### Passo 3 — Financiar o pagador

```bash
# Devnet: airdrop
solana airdrop 2 solana-keys/guardian_1_keypair.json

# Mainnet: transferir SOL para o endereco do guardian 1
solana balance solana-keys/guardian_1_keypair.json
```

### Passo 4 — Criar autoridade multisig

```bash
GUARDIAN_1=$(solana-keygen pubkey solana-keys/guardian_1_keypair.json)
GUARDIAN_2=$(solana-keygen pubkey solana-keys/guardian_2_keypair.json)
GUARDIAN_3=$(solana-keygen pubkey solana-keys/guardian_3_keypair.json)
GUARDIAN_4=$(solana-keygen pubkey solana-keys/guardian_4_keypair.json)
GUARDIAN_5=$(solana-keygen pubkey solana-keys/guardian_5_keypair.json)

# Criar multisig 3-de-5
spl-token create-multisig 3 \
  $GUARDIAN_1 $GUARDIAN_2 $GUARDIAN_3 $GUARDIAN_4 $GUARDIAN_5 \
  --fee-payer solana-keys/guardian_1_keypair.json

# Anotar: MULTISIG_AUTHORITY=<endereco>
```

### Passo 5 — Criar conta do tesouro (Treasury)

A conta de token USDT e controlada pela autoridade multisig:

```bash
# Endereco USDT
# Devnet:  Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
# Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

USDT_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

spl-token create-account $USDT_MINT \
  --owner <MULTISIG_AUTHORITY> \
  --fee-payer solana-keys/guardian_1_keypair.json

# Anotar: TREASURY_TOKEN_ACCOUNT=<endereco>
```

### Passo 6 — Verificar

```bash
# Verificar saldo do tesouro
spl-token balance --address <TREASURY_TOKEN_ACCOUNT>

# Verificar autoridade
spl-token account-info --address <TREASURY_TOKEN_ACCOUNT>
```

### Deploy automatizado

```bash
# Script completo (gera chaves + cria multisig + cria treasury)
scripts/setup-solana-multisig.sh

# Para ambiente de teste local (inicia validator + cria tudo)
scripts/setup-local-test.sh
```

### Resumo dos enderecos Solana

| Componente | Endereco | Onde usar |
|-----------|----------|-----------|
| **USDT Mint** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `USDT_TOKEN_MINT` no .env |
| **Multisig Authority** | `<gerado>` | Owner da treasury |
| **Treasury Account** | `<gerado>` | `TREASURY_ACCOUNT_ADDRESS` no .env |
| **Guardian 1-5** | `<gerados>` | Signatarios do multisig |

## Configuracao Pos-Deploy

Apos deployar os contratos em ambas as chains, configure o bridge-service:

### 1. Atualizar .env do bridge-service

```bash
cd bridge-service
cp env-vps.example .env
nano .env
```

Preencher com os enderecos reais:

```bash
# === Lunes Chain ===
LUNES_RPC_URL=wss://ws.lunes.io                    # ou ws://localhost:9944 (local)
LUSDT_CONTRACT_ADDRESS=<endereco_lusdt_token>
TAX_MANAGER_CONTRACT_ADDRESS=<endereco_tax_manager>
LUNES_WALLET_SEED=<seed_da_bridge_account>          # conta com MINTER_ROLE

# === Solana ===
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # ou http://localhost:8899 (local)
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
TREASURY_ACCOUNT_ADDRESS=<endereco_treasury>

# === Fee Distribution (Solana) ===
DEV_SOLANA_WALLET=<wallet_dev>
INSURANCE_SOLANA_WALLET=<wallet_insurance>
STAKING_REWARDS_SOLANA_WALLET=<wallet_staking>
```

### 2. Atualizar frontend

```bash
cd lusdt-app

# Atualizar enderecos dos contratos
# src/contracts/addresses.ts
# src/config.ts

# Copiar ABIs atualizados
cp ../target/ink/tax_manager/tax_manager.contract src/contracts/tax_manager.contract.json
cp ../target/ink/lusdt_token/lusdt_token.contract src/contracts/lusdt_token.contract.json
```

### 3. Testar integracao

```bash
# Testar cross-contract (mint + burn + volume)
cd bridge-service
NODE_PATH=node_modules node ../contracts/scripts/e2e_test_crosscontract.js

# Rodar testes do bridge
pnpm test

# Iniciar bridge e verificar health
pnpm dev
curl http://localhost:3001/health
```

### Checklist de deploy completo

- [ ] BurnEngine deployado na Lunes
- [ ] Tax Manager deployado na Lunes
- [ ] LUSDT Token deployado na Lunes
- [ ] `set_burn_engine()` configurado no Tax Manager
- [ ] `update_lusdt_token_address()` configurado no Tax Manager
- [ ] Multisig 3-de-5 criado na Solana
- [ ] Treasury USDT criada com owner = multisig
- [ ] `.env` do bridge-service atualizado com todos os enderecos
- [ ] Frontend atualizado com ABIs e enderecos
- [ ] Teste E2E cross-contract passando
- [ ] Bridge service rodando e respondendo no `/health`
- [ ] Testes do bridge (72) passando

Documentacao detalhada: [`contracts/DEPLOYMENT_RUNBOOK.md`](contracts/DEPLOYMENT_RUNBOOK.md) e [`contracts/CROSS_CONTRACT_DEPLOY.md`](contracts/CROSS_CONTRACT_DEPLOY.md)

## Modelo de Taxas v3 (Dual-Fee)

### Taxa por Operacao

Cada operacao (mint ou burn) cobra **duas taxas**:

| Taxa | Percentual | Moeda | Destino |
|------|-----------|-------|---------|
| **Stablecoin fee** (receita) | 0.30% - 0.60% | USDT (mint) / LUSDT (burn) | Distribuicao 80/15/5 |
| **LUNES burn fee** (deflacionaria) | 0.10% | LUNES | BurnEngine (queima) |

### Tiers Adaptativos por Volume Mensal

| Volume Mensal | Stablecoin Fee | Exemplos |
|---------------|---------------|----------|
| <= $10K | 0.60% | Swap de $1000 -> $6 de taxa |
| $10K - $100K | 0.50% | Swap de $50K -> $250 de taxa |
| > $100K | 0.30% | Swap de $200K -> $600 de taxa |

### Distribuicao de Receita (80/15/5)

```
Stablecoin Fee (0.30% - 0.60%)
├── 80% -> Dev Team (wallet configuravel)
├── 15% -> Insurance Fund (wallet fixo, imutavel)
└──  5% -> Staking Rewards Pool (distribuicao mensal)

LUNES Burn Fee (0.10%)
└── 100% -> BurnEngine contract (queima deflacionaria)
```

### Staking Rewards (LUNES)

| Regra | Valor |
|-------|-------|
| Percentual das taxas | 5% |
| Stake minimo | 100.000 LUNES |
| Frequencia de distribuicao | Mensal |
| Criterio de elegibilidade | Staking ativo na plataforma Lunes |
| Distribuicao | Proporcional ao peso do stake |

## Sistema Multisig Vault

Cada transferencia Lunes->Solana passa por aprovacao de **3 bots independentes** antes de ser executada:

```
BridgeProcessor
      │
      ▼
VaultExecutor ──▶ ProposalManager ──▶ cria proposta
      │
      ├──▶ OriginValidatorBot (tx finalizada? amount correto?)
      ├──▶ RiskValidatorBot   (limites? velocidade? solvencia?)
      └──▶ BackupValidatorBot (servico saudavel? DB confirma?)
                     │
              Quorum atingido?
              ├── 2/3 (normal < $5K) ──▶ executa imediatamente
              └── 3/3 (high-value >= $5K) ──▶ timelock 10min ──▶ executa
```

### Protecoes

- **Circuit Breaker** — pausa automatica apos 5 falhas em 10 minutos
- **Spending Limits** — por transacao ($10K), por hora ($25K), por dia ($50K)
- **Timelock** — transferencias >= $5K aguardam 10 minutos
- **HSM/KMS** — chaves nunca ficam em variaveis de ambiente em producao
- **Redis Store** — propostas e contadores persistidos entre restarts
- **Audit Log** — todas as aprovacoes/rejeicoes registradas

Documentacao completa: [`bridge-service/README.md`](bridge-service/README.md#sistema-multisig)

## Fluxos de Operacao

### Mint (USDT -> LUSDT)

```
1. Usuario deposita USDT no cofre Solana
2. Bridge detecta deposito e calcula taxa:
   ├── Deduz 0.60% USDT (stablecoin fee) ANTES de mintar
   ├── Distribui USDT: 80% dev / 15% insurance / 5% staking
   └── Minta (amount - fee) LUSDT na Lunes chain
3. LUSDT.mint() chama Tax Manager:
   └── Cobra 0.10% LUNES burn fee -> envia ao BurnEngine
4. Backing ratio mantido: USDT no cofre == LUSDT total supply
```

### Burn (LUSDT -> USDT)

```
1. Usuario chama LUSDT.burn(amount, solana_address)
2. Contrato queima LUSDT e emite RedemptionRequested
3. Tax Manager cobra dual-fee:
   ├── 0.60% LUSDT (stablecoin fee) -> distribui 80/15/5
   └── 0.10% LUNES (burn fee) -> envia ao BurnEngine
4. Bridge detecta evento
5. VaultExecutor submete proposta ao multisig
6. 3 bots avaliam -> quorum -> transfere USDT na Solana
7. Backing ratio mantido: cofre diminui == supply diminui
```

### Proof of Reserve

A colateralizacao 1:1 e garantida por design:

- **Mint:** bridge deduz taxa USDT *antes* de mintar LUSDT
- **Burn:** bridge libera exatamente o amount queimado
- **Taxas LUSDT** (burn) sao transferencias entre contas, nao alteram supply

## Deploy VPS (Producao)

Guia completo: [`Docs/VPS_DEPLOYMENT_BRIDGE.md`](Docs/VPS_DEPLOYMENT_BRIDGE.md)

```bash
# 1. Bootstrap da VPS (instala Docker, Redis, Vault)
sudo scripts/setup-vps-bridge.sh

# 2. Inicializar Vault Transit (cria chave ed25519)
scripts/init-vault-transit.sh

# 3. Configurar .env
cp bridge-service/env-vps.example /opt/lusdt/bridge-service/.env
nano /opt/lusdt/bridge-service/.env

# 4. Build
cd /opt/lusdt/bridge-service
pnpm install --frozen-lockfile
pnpm build

# 5. Instalar servico systemd
sudo cp scripts/lusdt-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lusdt-bridge

# 6. Verificar
curl http://localhost:3001/health
```

### Arquivos de deploy

| Arquivo | Funcao |
|---------|--------|
| `scripts/setup-vps-bridge.sh` | Bootstrap: Docker, Redis, Vault |
| `scripts/init-vault-transit.sh` | Inicializa Vault, cria chave ed25519, gera token |
| `scripts/lusdt-bridge.service` | Unidade systemd para o bridge |
| `bridge-service/env-vps.example` | Template .env de producao |
| `Docs/VPS_DEPLOYMENT_BRIDGE.md` | Runbook passo-a-passo |

## Testes

```bash
# Contratos ink! (Rust)
cargo test -p tax_manager -p lusdt_token -p burn_engine

# Bridge Service (72 testes: 38 multisig + 34 bridge)
cd bridge-service && pnpm test

# Com cobertura
cd bridge-service && pnpm test:coverage

# Modo watch
cd bridge-service && pnpm test:watch
```

## Seguranca

- **Multisig Vault** — 3 bots de aprovacao com quorum 2/3 (3/3 para high-value)
- **Circuit Breaker** — pausa automatica em caso de falhas consecutivas
- **HSM/KMS** — chaves protegidas via AWS KMS ou HashiCorp Vault Transit
- **Spending Limits** — limites por tx, hora e dia
- **Timelock** — delay obrigatorio para transferencias de alto valor
- **RBAC** — roles nos contratos: ADMIN, MINTER, EMERGENCY
- **Rate Limiting** — limites por IP no bridge service
- **Proof of Reserve** — colateralizacao 1:1 garantida por design
- **BurnEngine** — queima de LUNES on-chain, permissionless, auditavel
- **Redis Persistence** — propostas e counters persistidos entre restarts

## Documentacao

- **[Bridge Service README](bridge-service/README.md)** — Documentacao completa do bridge
- **[VPS Deployment](Docs/VPS_DEPLOYMENT_BRIDGE.md)** — Runbook de deploy em VPS
- **[Cross-Contract Deploy](contracts/CROSS_CONTRACT_DEPLOY.md)** — Deploy e integracao entre contratos
- **[Deployment Runbook](contracts/DEPLOYMENT_RUNBOOK.md)** — Checklist para testnet e mainnet
- **[Integracao Solana USDT](docs/solana_usdt_integration.md)** — Implementacao tecnica
- **[Analise de Seguranca](docs/security_analysis.md)** — Auditoria e seguranca

## Roadmap

### Fase 1 — Core

- [x] Contratos LUSDT Token + Tax Manager (ink! 4.2.1)
- [x] Bridge service Solana <-> Lunes
- [x] Frontend com AdminPanel completo
- [x] Sistema de taxas inteligente com tiers

### Fase 2 — v3 Dual-Fee + Deflacao

- [x] BurnEngine contract (queima deflacionaria de LUNES)
- [x] Modelo dual-fee: stablecoin fee + LUNES burn fee
- [x] Distribuicao 80% dev / 15% insurance / 5% staking rewards
- [x] Staking rewards para holders >= 100k LUNES (mensal)
- [x] Fix backing ratio: deducao de taxa antes do mint

### Fase 3 — Multisig + Producao

- [x] Sistema multisig vault com 3 bots de aprovacao
- [x] HSM/KMS signers (AWS KMS + HashiCorp Vault)
- [x] Circuit breaker e spending limits
- [x] Redis persistence para estado do multisig
- [x] Squads Protocol SDK client
- [x] Deploy artifacts VPS (systemd, Vault, Docker)
- [x] 72 testes passando (38 multisig + 34 bridge)

### Fase 4 — Lancamento

- [ ] Auditoria externa dos contratos
- [ ] Ativar Squads multisig on-chain
- [ ] Integrar RedisStore como backend do ProposalManager
- [ ] Deploy em testnet Lunes
- [ ] Deploy em mainnet Lunes + Solana
- [ ] API publica para desenvolvedores

---

**LUSDT — Stablecoin cross-chain do ecossistema Lunes**