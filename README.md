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