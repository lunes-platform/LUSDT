# LUSDT Bridge Platform

**Stablecoin cross-chain LUSDT — Ponte Solana (USDT) ↔ Lunes (LUSDT)**

[![Rust](https://img.shields.io/badge/ink!-4.2.1-orange.svg)](https://use.ink/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Sobre o Projeto

Plataforma completa de bridge cross-chain entre Solana e Lunes com:
- Stablecoin LUSDT colateralizada 1:1 por USDT (Proof of Reserve)
- Modelo de taxas dual-fee v3 (taxa em stablecoin + queima deflacionária de LUNES)
- Distribuição de receita: 80% dev / 15% insurance / 5% staking rewards
- Staking rewards para holders de LUNES (mínimo 100k, distribuição mensal)

## Arquitetura

```text
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│   Frontend  │    │   Bridge    │    │  Smart Contracts  │
│   (React)   │◄──►│   Service   │◄──►│  (Rust / ink!)    │
│   Vite+TW   │    │  (Node.js)  │    │  Lunes Chain      │
└─────────────┘    └─────────────┘    └──────────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│    USDT     │    │  Treasury   │    │  LUSDT Token     │
│ (SPL Token) │    │ (Multisig)  │    │  Tax Manager     │
│   Solana    │    │   Solana    │    │  BurnEngine      │
└─────────────┘    └─────────────┘    └──────────────────┘
```

### Smart Contracts (ink! 4.2.1)

| Contrato | Descrição |
|----------|-----------|
| **LUSDT Token** | Token PSP22 com mint/burn, RBAC, pausa de emergência, rate limiting |
| **Tax Manager** | Cálculo e distribuição de taxas, adaptive fees por volume, BurnEngine integration |
| **BurnEngine** | Mecanismo deflacionário permissionless — qualquer pessoa pode acionar queima de LUNES |

## Estrutura do Projeto

```
LUSDT/
├── contracts/              # Smart Contracts (Rust/ink!)
│   ├── common/             # Tipos e traits compartilhados
│   ├── lusdt_token/        # Token LUSDT (PSP22 + RBAC)
│   ├── tax_manager/        # Sistema de Taxas v3 (dual-fee + staking)
│   ├── burn_engine/        # Mecanismo deflacionário de LUNES
│   └── scripts/            # Deploy e testes E2E
├── bridge-service/         # Serviço Off-chain (Node.js/TypeScript)
│   ├── src/solana/         # Cliente Solana (USDT transfers)
│   ├── src/lunes/          # Cliente Lunes (LUSDT mint/burn)
│   └── src/bridge/         # Processor, UsdtFeeCollector
├── lusdt-app/              # Frontend (React + TailwindCSS)
│   ├── src/components/     # UI: AdminPanel, Staking, Bridge
│   └── src/hooks/          # useAdminContract, useWallet
└── docs/                   # Documentação técnica
```

## Modelo de Taxas v3 (Dual-Fee)

### Taxa por Operação

Cada operação (mint ou burn) cobra **duas taxas**:

| Taxa | Percentual | Moeda | Destino |
|------|-----------|-------|---------|
| **Stablecoin fee** (receita) | 0.30% - 0.60% | USDT (mint) / LUSDT (burn) | Distribuição 80/15/5 |
| **LUNES burn fee** (deflacionária) | 0.10% | LUNES | BurnEngine (queima) |

### Tiers Adaptativos por Volume Mensal

| Volume Mensal | Stablecoin Fee | Exemplos |
|---------------|---------------|----------|
| ≤ $10K | 0.60% | Swap de $1000 → $6 de taxa |
| $10K - $100K | 0.50% | Swap de $50K → $250 de taxa |
| > $100K | 0.30% | Swap de $200K → $600 de taxa |

### Tetos de LUNES Burn Fee

| Valor da Transação | Máx. LUNES Burn Fee |
|--------------------|--------------------|
| ≤ $100 | 0.5 LUNES |
| $100 - $1K | 2 LUNES |
| $1K - $10K | 10 LUNES |
| > $10K | 50 LUNES |

### Distribuição de Receita (80/15/5)

```
Stablecoin Fee (0.30% - 0.60%)
├── 80% → Dev Team (wallet configurável)
├── 15% → Insurance Fund (wallet fixo, imutável)
└──  5% → Staking Rewards Pool (distribuição mensal)

LUNES Burn Fee (0.10%)
└── 100% → BurnEngine contract (queima deflacionária)
```

## Staking Rewards (LUNES)

5% de **todas** as taxas do protocolo são direcionadas ao pool de Staking Rewards.

| Regra | Valor |
|-------|-------|
| Percentual das taxas | 5% |
| Stake mínimo | 100.000 LUNES |
| Frequência de distribuição | Mensal |
| Critério de elegibilidade | Staking ativo na plataforma Lunes |
| Distribuição | Proporcional ao peso do stake |

## Fluxos de Operação

### Mint (USDT → LUSDT)

```
1. Usuário deposita USDT no cofre Solana
2. Bridge detecta depósito e calcula taxa:
   ├── Deduz 0.60% USDT (stablecoin fee) ANTES de mintar
   ├── Distribui USDT: 80% dev / 15% insurance / 5% staking
   └── Minta (amount - fee) LUSDT na Lunes chain
3. LUSDT.mint() chama Tax Manager:
   └── Cobra 0.10% LUNES burn fee → envia ao BurnEngine
4. Backing ratio mantido: USDT no cofre == LUSDT total supply
```

### Burn (LUSDT → USDT)

```
1. Usuário chama LUSDT.burn(amount, solana_address)
2. Contrato queima LUSDT e emite RedemptionRequested
3. Tax Manager cobra dual-fee:
   ├── 0.60% LUSDT (stablecoin fee) → distribui 80/15/5
   └── 0.10% LUNES (burn fee) → envia ao BurnEngine
4. Bridge detecta evento e transfere USDT ao usuário na Solana
5. Backing ratio mantido: cofre diminui == supply diminui
```

### Proof of Reserve

A colateralização 1:1 é garantida por design:
- **Mint:** bridge deduz a taxa USDT *antes* de mintar LUSDT → cofre sempre tem USDT >= supply
- **Burn:** bridge libera exatamente o amount queimado → cofre diminui proporcionalmente
- **Taxas LUSDT** (burn) são transferências entre contas, não alteram supply

## Começando

### Pré-requisitos

- **Node.js** 18+ e **npm** 9+
- **Rust** 1.85+ com `cargo-contract` 3.2.0
- **Carteiras:** Phantom (Solana) + Polkadot.js (Lunes)

### Instalação

```bash
git clone <repository-url>
cd LUSDT
npm install
```

### Compilar Contratos

```bash
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/tax_manager/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/lusdt_token/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/burn_engine/Cargo.toml --release
```

### Testes

```bash
# Testes unitários dos contratos (27 testes)
cargo test -p tax_manager -p lusdt_token -p burn_engine

# Frontend
cd lusdt-app && npm test

# Bridge service
cd bridge-service && npm test
```

### Desenvolvimento

```bash
npm run dev:app      # Frontend (React)
npm run dev:bridge   # Bridge service (Node.js)
```

## Variáveis de Ambiente

```bash
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WALLET_PRIVATE_KEY=your_private_key
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Fee Distribution Wallets (Solana) — 80/15/5
DEV_SOLANA_WALLET=your_dev_wallet
INSURANCE_SOLANA_WALLET=your_insurance_wallet
STAKING_REWARDS_SOLANA_WALLET=your_staking_pool_wallet

# Lunes
LUNES_RPC_URL=wss://rpc.lunes.io
LUNES_WALLET_SEED=your_seed_phrase
LUSDT_CONTRACT_ADDRESS=your_lusdt_contract
TAX_MANAGER_CONTRACT_ADDRESS=your_tax_manager_contract
```

## Segurança

- **Circuit Breaker:** Pausa de emergência via RBAC
- **Multisig Treasury:** Cofre protegido na Solana
- **Rate Limiting:** Limites por transação e por período
- **RBAC:** Roles: ADMIN, MINTER, EMERGENCY
- **Backing Ratio:** Proof of Reserve 1:1 por design
- **BurnEngine:** Queima de LUNES on-chain, permissionless, auditável

## Documentação

- **[Cross-Contract Deploy](contracts/CROSS_CONTRACT_DEPLOY.md)** — Guia de deploy e integração entre contratos
- **[Deployment Runbook](contracts/DEPLOYMENT_RUNBOOK.md)** — Checklist para testnet e mainnet
- **[Integração Solana USDT](docs/solana_usdt_integration.md)** — Implementação técnica
- **[Análise de Segurança](docs/security_analysis.md)** — Auditoria e segurança

## Roadmap

### Fase 1 — Core
- [x] Contratos LUSDT Token + Tax Manager (ink! 4.2.1)
- [x] Bridge service Solana ↔ Lunes
- [x] Frontend com AdminPanel completo
- [x] Sistema de taxas inteligente com tiers

### Fase 2 — v3 Dual-Fee + Deflação
- [x] BurnEngine contract (queima deflacionária de LUNES)
- [x] Modelo dual-fee: stablecoin fee + LUNES burn fee
- [x] Distribuição 80% dev / 15% insurance / 5% staking rewards
- [x] Staking rewards para holders ≥100k LUNES (mensal)
- [x] Fix backing ratio: dedução de taxa antes do mint

### Fase 3 — Produção
- [ ] Auditoria externa dos contratos
- [ ] Deploy em testnet Rococo
- [ ] Deploy em mainnet Lunes + Solana
- [ ] API pública para desenvolvedores

---

**LUSDT — Stablecoin cross-chain do ecossistema Lunes**