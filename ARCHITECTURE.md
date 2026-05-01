# LUSDT Bridge — Architecture

## Overview

LUSDT Bridge is a cross-chain bridge between Solana and Lunes networks, enabling bidirectional conversion between USDT (Solana SPL) and LUSDT (Lunes PSP22). The system consists of three layers: smart contracts (Rust/ink!), a bridge service (Node.js/TypeScript), and a frontend (React/TypeScript).

### Component Diagram

```text
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│    Frontend      │    │   Bridge Service      │    │  Smart Contracts  │
│  (React/Vite)   │───►│  (Express/TypeScript) │───►│  (Rust / ink!)    │
│  Display only   │    │  All business logic   │    │  Lunes Chain      │
└─────────────────┘    └──────────┬───────────┘    └──────────────────┘
         │                        │                         │
         │ REST API only          ▼                         ▼
         │              ┌──────────────────┐    ┌──────────────────┐
         │              │  Multisig Vault  │    │  LUSDT Token     │
         │              │  3 Bots (2/3 or  │    │  Tax Manager     │
         │              │  3/3 quorum)     │    │  BurnEngine      │
         │              │  HSM/KMS Signer  │    └──────────────────┘
         │              └──────────────────┘
         ▼
┌─────────────────┐
│   USDT (SPL)    │
│   Solana        │
└─────────────────┘
```

---

## Architecture Rule: Frontend Has No Business Logic

The frontend (`lusdt-app/`) is a display layer only. It:
- Calls the bridge service REST API for all operations
- Reads contract state through the API
- Does **not** calculate fees, validate amounts, or call contracts directly in components
- Business logic (fee calculation, validation, contract interaction) lives exclusively in the bridge service

This rule ensures security-sensitive logic cannot be bypassed client-side and simplifies auditing.

---

## Project Structure

```
LUSDT/
├── contracts/                   # Smart Contracts (Rust/ink!)
│   ├── common/                  # Shared types and traits (TaxManager, StakingManager)
│   ├── lusdt_token/             # Token LUSDT (PSP22 + RBAC)
│   ├── tax_manager/             # Fee system v3 (dual-fee + staking rewards)
│   ├── burn_engine/             # Deflationary LUNES burn mechanism
│   └── scripts/                 # Deploy and E2E test scripts
├── bridge-service/              # Off-chain service (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts             # Entrypoint — Express server, auth middleware
│   │   ├── config/env.ts        # Environment variables and validation
│   │   ├── bridge/              # BridgeProcessor, Database, UsdtFeeCollector
│   │   ├── solana/client.ts     # Solana client (USDT SPL transfers)
│   │   ├── lunes/client.ts      # Lunes client (Polkadot API, ink! contracts)
│   │   ├── multisig/            # Multisig vault system
│   │   │   ├── types.ts         # Proposal, Bot, Signer, Policy types
│   │   │   ├── hsm-signer.ts    # Local / AWS KMS / HashiCorp Vault signers
│   │   │   ├── circuit-breaker.ts
│   │   │   ├── proposal-manager.ts
│   │   │   ├── approval-bots.ts # 3 segregated bots
│   │   │   ├── vault-executor.ts
│   │   │   ├── squads-client.ts # Squads Protocol SDK integration
│   │   │   └── redis-store.ts   # Redis persistence (proposals, spending counters)
│   │   ├── utils/
│   │   │   ├── logger.ts        # Structured logger (replaces winston)
│   │   │   ├── validation.ts    # Solana/Lunes address validation
│   │   │   └── error.ts         # Typed error utilities
│   │   ├── admin/               # Protected admin routes
│   │   ├── monitoring/          # Prometheus metrics
│   │   ├── contracts/           # TaxManager ink! ABI
│   │   └── __tests__/           # 72 tests (38 multisig + 34 bridge)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── env-vps.example
├── lusdt-app/                   # Frontend (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/          # UI: AdminPanel, Staking, BridgeInterface
│   │   ├── hooks/               # useAdminContract, useLunesContract, useSolanaContract
│   │   ├── contracts/           # Contract addresses, ABIs, and unified types
│   │   └── utils/
│   │       ├── contractHelpers.ts  # createGasLimit(), unwrapOutput() for ink! calls
│   │       ├── format.ts           # formatAddress(), formatNumber()
│   │       ├── validation.ts       # Upstream: see bridge-service/src/utils/validation.ts
│   │       └── security.ts         # InputSanitizer, XSS protection
├── scripts/                     # Deploy and operations scripts
│   ├── setup-vps-bridge.sh      # VPS bootstrap: Docker, Redis, Vault
│   ├── init-vault-transit.sh    # HashiCorp Vault Transit init + ed25519 key
│   ├── setup-guardian-keys.sh   # Guardian keypair env-var export helper
│   ├── setup-solana-multisig.sh # Create 3-of-5 multisig on Solana
│   └── lusdt-bridge.service     # systemd unit
└── Docs/
    └── VPS_DEPLOYMENT_BRIDGE.md
```

---

## Components

### 1. Smart Contracts (Rust/ink! 4.2.1)

#### LUSDT Token Contract (`contracts/lusdt_token/src/lib.rs`)
- PSP22 token with on-chain RBAC (roles stored in `Mapping<(Role, AccountId), bool>`)
- Roles: `DEFAULT_ADMIN_ROLE (0)`, `PAUSER_ROLE (1)`, `MINTER_ROLE (2)`, `TAX_MANAGER_ROLE (3)`
- Only accounts with `MINTER_ROLE` can call `mint()`
- Only `PAUSER_ROLE` or `DEFAULT_ADMIN_ROLE` can call `emergency_pause()`
- Only `DEFAULT_ADMIN_ROLE` can call `emergency_unpause()`
- Access check: `ensure_role(required_role)` — reverts with `Error::Unauthorized`

#### Tax Manager Contract (`contracts/tax_manager/src/lib.rs`)
- Dual-fee model: stablecoin fee (0.30%–0.60% adaptive) + LUNES burn fee (0.10%)
- Owner access enforced via `ensure_owner()` on all admin messages
- Administrative messages (owner-only): `update_lunes_price`, `update_fee_config`, `set_burn_engine`, `set_lunes_burn_fee_bps`, `update_lusdt_token_address`, `set_code`
- Fee processing messages (`process_fees`, `process_fees_flexible`, `process_dual_fee`, `process_burn_fee_only`) are callable by any account; security relies on the system design (only the LUSDT Token contract calls them via cross-contract calls during mint/burn operations)
- **Known security consideration**: `process_fees` has no on-chain caller restriction. In production, mitigation is: (1) the bridge account holds `MINTER_ROLE` exclusively, (2) all mint/burn paths go through LUSDT Token, (3) direct calls to `process_fees` by arbitrary accounts would debit the caller's own token balance, which is economically self-defeating.

#### BurnEngine Contract (`contracts/burn_engine/src/lib.rs`)
- Permissionless deflationary burn of LUNES tokens
- Receives LUNES from Tax Manager and burns them on-chain

### 2. Bridge Service (Node.js/TypeScript)

#### Key Modules

| Module | File | Responsibility |
|--------|------|---------------|
| BridgeProcessor | `bridge/processor.ts` | Main Solana ↔ Lunes flow, event detection |
| VaultExecutor | `multisig/vault-executor.ts` | Proposal → bots → quorum → execution |
| Approval Bots | `multisig/approval-bots.ts` | 3 independent bots: Origin, Risk, Backup |
| HSM Signer | `multisig/hsm-signer.ts` | Local (dev) / AWS KMS / HashiCorp Vault |
| Circuit Breaker | `multisig/circuit-breaker.ts` | Auto-pause: closed/open/half-open states |
| Redis Store | `multisig/redis-store.ts` | Proposal persistence, spending counters, audit log |
| Squads Client | `multisig/squads-client.ts` | Squads Protocol on-chain multisig |
| Logger | `utils/logger.ts` | Structured logging (custom implementation) |
| Validation | `utils/validation.ts` | `isValidSolanaAddress()`, `isValidLunesAddress()` |

#### Utils Layer (`bridge-service/src/utils/`)

Shared utilities extracted during the DRY refactor to eliminate duplication:

- **`validation.ts`**: Address validation for Solana (base58, on-curve check) and Lunes/Substrate (SS58 format)
- **`logger.ts`**: Structured logger with configurable `LOG_LEVEL`; replaces the unused `winston` dependency
- **`error.ts`**: Typed error utilities

#### Frontend Utils Layer (`lusdt-app/src/utils/`)

- **`contractHelpers.ts`**: `createGasLimit(api, refTime, proofSize)` — creates `WeightV2` objects for `@polkadot/api-contract` calls; `unwrapOutput()` — unwraps ink! `Ok/Err` codec result
- **`format.ts`**: `formatAddress()`, `formatNumber()` — display formatting
- **`security.ts`**: `InputSanitizer` — XSS protection, address sanitization

### 3. Frontend (React/TypeScript)

- `hooks/useLunesContract.ts` — Polkadot.js API connection, ink! contract calls via `ContractPromise`
- `hooks/useSolanaContract.ts` — Solana wallet integration
- `hooks/useAdminContract.ts` — Admin operations via bridge service API
- `components/BridgeInterface.tsx` — Main bridge UI
- `components/AdminPanel.tsx` — Admin dashboard
- `contracts/types.ts` — Unified `DistributionWallets`, `FeeConfig`, `ContractStats` interfaces

---

## Security Architecture

### KMS / Vault Signer Hierarchy

The bridge service never stores private keys in environment variables in production. Key management uses a pluggable signer abstraction in `multisig/hsm-signer.ts`:

```
Production:
  HashiCorp Vault Transit Engine (preferred)
    └── ed25519 key stored in Vault, sign operations via Vault API
  AWS KMS
    └── Envelope encryption for ed25519 signing keys
  
Development:
  Local signer (keypair from env vars, acceptable for dev/staging only)
```

Controlled by `HSM_TYPE` env var: `hashicorp_vault` | `aws_kms` | `local`.

### HMAC Authentication

The bridge service exposes protected endpoints on `/admin/*` and internal bridge routes. Authentication in production/staging (`NODE_ENV=production` or `NODE_ENV=staging`):

1. **HMAC signature** (preferred, server-to-server): `X-Bridge-Signature` header + `X-Bridge-Timestamp` header
   - Payload: `${timestamp}.${JSON.stringify(req.body)}`
   - Algorithm: HMAC-SHA256, key from `BRIDGE_API_SECRET`
   - Replay protection: timestamp must be within 5 minutes
   - Comparison: `crypto.timingSafeEqual` (timing-safe)
2. **Static API key**: `X-Bridge-API-Key` header (simpler, for trusted frontends)
3. **Basic Auth**: ops credentials fallback

In development (`NODE_ENV=development`), authentication is bypassed.

### Rate Limiting

- Express-level: `express-rate-limit` on all routes
- Contract-level (ink!): `MINTER_ROLE` enforced on-chain; mint rate limit 1M LUSDT/hour in Tax Manager
- Multisig spending limits: $10K/tx, $25K/hour, $50K/day

### Multisig Vault

Lunes → Solana transfers require approval from 3 independent bots before execution:

```
BridgeProcessor → VaultExecutor → ProposalManager (creates proposal)
                                        │
                       ┌────────────────┼───────────────────┐
                       ▼                ▼                   ▼
               OriginValidatorBot  RiskValidatorBot  BackupValidatorBot
               (tx finalized?      (limits? velocity? (service health?
                amount correct?)    solvency?)         DB confirms?)
                       └────────────────┼───────────────────┘
                                   Quorum check:
                                   2/3 (normal, < $5K) → execute immediately
                                   3/3 (high-value, ≥ $5K) → 10-min timelock → execute
```

Circuit breaker triggers automatic pause after 5 consecutive failures within 10 minutes.

### RBAC (ink! Contracts)

Access control in the LUSDT Token contract uses on-chain role mapping:

| Role | ID | Holder | Permission |
|------|----|--------|------------|
| `DEFAULT_ADMIN_ROLE` | 0 | Deployer (multisig in prod) | Grant/revoke roles, upgrade code |
| `PAUSER_ROLE` | 1 | Emergency Admin (separate multisig) | `emergency_pause()` |
| `MINTER_ROLE` | 2 | Bridge Account (HSM-protected) | `mint()` |
| `TAX_MANAGER_ROLE` | 3 | Deployer | Configure fees |

`ensure_role(role)` is called at the top of every restricted message, reverting with `Error::Unauthorized` on failure.

Tax Manager admin messages (`update_lunes_price`, `update_fee_config`, etc.) use `ensure_owner()` which checks `self.env().caller() == self.owner`.

---

## Transaction Flows

### Mint (USDT → LUSDT)

```
1. User deposits USDT to Solana treasury (multisig-controlled)
2. Bridge detects deposit event
3. Bridge deducts stablecoin fee (0.30%–0.60%) from USDT before minting
   └── Distributes: 80% dev / 15% insurance / 5% staking rewards
4. Bridge calls LUSDT.mint(amount - fee, user_lunes_address)
   └── Requires MINTER_ROLE on bridge account
5. LUSDT.mint() cross-calls TaxManager.process_burn_fee_only()
   └── Deducts 0.10% LUNES from user → sends to BurnEngine
6. LUSDT minted to user's Lunes wallet
7. Backing ratio: USDT in vault == LUSDT total supply (maintained by design)
```

### Burn (LUSDT → USDT)

```
1. User calls LUSDT.burn(amount, solana_recipient_address)
2. LUSDT contract burns tokens and calls TaxManager.process_dual_fee()
   ├── 0.30%–0.60% LUSDT stablecoin fee → distributed 80/15/5
   └── 0.10% LUNES burn fee → BurnEngine (deflationary)
3. Bridge detects RedemptionRequested event
4. VaultExecutor creates multisig proposal
5. 3 bots evaluate → quorum (2/3 or 3/3 + timelock) → approved
6. Bridge transfers exact burned amount of USDT from Solana treasury to user
```

---

## Fee System

### Adaptive Tiers (Monthly Volume)

| Monthly Volume (USD) | Stablecoin Fee | LUNES Burn Fee |
|---------------------|---------------|----------------|
| ≤ $10K              | 0.60%         | 0.10%          |
| $10K – $100K        | 0.50%         | 0.10%          |
| > $100K             | 0.30%         | 0.10%          |

### Revenue Distribution (stablecoin fee)

```
Stablecoin fee (0.30%–0.60%)
├── 80% → Dev Team (configurable wallet)
├── 15% → Insurance Fund (immutable wallet)
└──  5% → Staking Rewards Pool (monthly distribution, ≥ 100k LUNES staked)

LUNES Burn fee (0.10%)
└── 100% → BurnEngine contract (on-chain burn)
```

---

## Environment Configuration

### Development
```bash
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
LUNES_RPC_URL=ws://localhost:9944
HSM_TYPE=local
```

### Production
```bash
NODE_ENV=production
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
LUNES_RPC_URL=wss://ws.lunes.io
HSM_TYPE=hashicorp_vault
VAULT_URL=https://vault.internal
VAULT_KEY_NAME=solana-bridge
```

Full variable reference: `bridge-service/env-vps.example`

---

## Key Dependencies

### bridge-service

| Package | Purpose |
|---------|---------|
| `@polkadot/api`, `@polkadot/api-contract` | Lunes/Substrate RPC and ink! contract calls |
| `@polkadot/keyring`, `@polkadot/util-crypto` | Key management |
| `@solana/web3.js`, `@solana/spl-token` | Solana RPC and USDT transfers |
| `@sqds/multisig` | Squads Protocol on-chain multisig |
| `@aws-sdk/client-kms` | AWS KMS envelope encryption |
| `ioredis` | Redis persistence (proposals, spending counters) |
| `express`, `helmet`, `cors`, `express-rate-limit` | HTTP server and security middleware |
| `pg` | PostgreSQL (bridge transaction database) |
| `tweetnacl` | Ed25519 signing (local dev signer) |

### lusdt-app

| Package | Purpose |
|---------|---------|
| `@polkadot/api`, `@polkadot/api-contract` | Lunes contract interaction |
| `@polkadot/extension-dapp` | Polkadot.js browser extension integration |
| `@solana/web3.js`, `@solana/spl-token` | Solana wallet integration |
| `react`, `vite`, `tailwindcss` | UI framework |

---

## Monitoring

### Key Metrics (Prometheus)
- Transaction volume (daily/weekly)
- Success rate (target: >99.8%)
- Average processing time (target: <1.2s)
- Treasury parity (target: deviation <1%)

### Critical Alerts
- Treasury parity deviation >1%
- Treasury balance < 50k USDT
- Transaction failure rate >5%
- Processing time >30s
- Contract paused
- Rate limit exceeded

---

## Build and Test

```bash
# Contracts (Rust)
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/lusdt_token/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/tax_manager/Cargo.toml --release
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --manifest-path contracts/burn_engine/Cargo.toml --release
cargo test -p tax_manager -p lusdt_token -p burn_engine

# Bridge service
cd bridge-service
pnpm install && pnpm build
pnpm test          # 72 tests (38 multisig + 34 bridge)
pnpm test:coverage

# Frontend
cd lusdt-app
pnpm install && pnpm build
pnpm test
```
