# Deploy com Cross-Contract — Documentação Completa

> **Data do Deploy**: Fevereiro 2026  
> **Rede**: Lunes Local Testnet (`ws://localhost:9944`)  
> **ink! version**: 4.2.1  
> **cargo-contract**: 3.2.0  
> **Rust toolchain**: 1.85.0  

---

## Endereços Deployados (Testnet Local — v2)

| Contrato | Endereço |
|----------|----------|
| **LUSDT Token** | `5H91zF5pkY1Xq9c2EG9R7aEsiLfGcYyLk9ED9AvKNNGSkQhD` |
| **Tax Manager** | `5FvsNqiDpFRYBNY436UsvRWe6pYb2UWrkTXHJrgBQHx6a4pe` |
| **Staking Manager** | `5GcrV2V1Dor9xwxFfpw8VLXnLeAfxe22ZE6ZvKQ6wJahKMNY` |
| **Burn Engine** | `5G7T1bzZ1QuntTPLcxuoS1u8ymnre5grvFYEu75CP6vBLoK3` |

### Contas de Teste

| Papel | Conta | Endereço |
|-------|-------|----------|
| Owner / Bridge (MINTER_ROLE) | `//Alice` | `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY` |
| Dev Lunes Wallet | `//Bob` | `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty` |
| Insurance Fund | `//Charlie` | `5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y` |

---

## 1. Arquitetura Cross-Contract

```
┌─────────────────────────────────────────────────────────────┐
│                      LUSDT Token                            │
│  (lusdt_token)                                              │
│                                                             │
│  mint() ──────┐                                             │
│               │  ink::contract_ref!(TaxManager)             │
│  burn() ──────┤  ─────────────────────────────►  Tax Manager│
│               │  process_fees_flexible(                     │
│               │    operation: Mint|Burn,                    │
│               │    user: AccountId,                         │
│               │    amount: u128,                            │
│               │    fee_type: FeeType::Usdt                  │
│               │  )                                          │
└───────────────┴─────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Tax Manager                            │
│  (tax_manager)                                              │
│                                                             │
│  Recebe chamada cross-contract:                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ _process_fees_usdt_bridge()                         │    │
│  │  1. Calcula fee_amount_usd = amount * fee_bps/10000 │    │
│  │  2. Atualiza monthly_volume_usd                     │    │
│  │  3. Emite evento UsdtBridgeFeeMarked                │    │
│  │     { operation, user, lusdt_amount, fee_amount_usd }│   │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Distribuição de taxas (off-chain via bridge):              │
│  ├── 80% → dev wallet (Solana ou Lunes, por rede)          │
│  ├── 15% → insurance fund (fixo, imutável)                 │
│  └──  5% → staking rewards pool (mensal, ≥100k LUNES)      │
└─────────────────────────────────────────────────────────────┘
```

### Por que FeeType::Usdt?

O modelo v2 usa `FeeType::Usdt` para operações de bridge (mint/burn). Nesse path:
- **Não há `transfer_from`** on-chain (não precisa de token PSP22 externo)
- Apenas **emite o evento** `UsdtBridgeFeeMarked` com o valor da taxa em USD
- O **bridge-service** (off-chain) escuta esses eventos e realiza a distribuição real de USDT na Solana
- O **volume mensal** é atualizado on-chain para cálculo de tiers de taxa

---

## 2. O Problema: ContractTrapped

### Sintoma

Ao executar mint/burn no LUSDT Token, a chamada cross-contract para o Tax Manager falhava com `ContractTrapped`.

### Causa Raiz: **Selector Mismatch**

Em ink!, chamadas cross-contract usam **selectors** derivados da trait definition. O problema era:

1. **LUSDT Token** usava `ink::contract_ref!(TaxManager)` referenciando a trait de `common::traits::TaxManager`
2. **Tax Manager** implementava uma trait **local** `TaxManagerTrait` com a mesma assinatura mas **selectors diferentes**

```
LUSDT Token chama:  selector de common::traits::TaxManager::process_fees_flexible
Tax Manager espera: selector de tax_manager::TaxManagerTrait::process_fees_flexible

→ Selectors não coincidem → ContractTrapped
```

### A Correção

Fazer o Tax Manager implementar **a mesma trait** que o LUSDT Token referencia:

**Antes** (quebrado):
```rust
// tax_manager/src/lib.rs — trait LOCAL (selectors diferentes)
#[ink::trait_definition]
pub trait TaxManagerTrait {
    fn process_fees_flexible(...) -> Result<(), ink::LangError>;
}

impl TaxManagerTrait for TaxManager { ... }
```

**Depois** (funcionando):
```rust
// tax_manager/src/lib.rs — importa trait do common (mesmos selectors)
use common::traits::TaxManager as TaxManagerApi;

impl TaxManagerApi for TaxManager {
    #[ink(message)]
    fn process_fees_flexible(...) -> Result<(), ink::LangError> {
        self._process_fees_flexible(operation, user, lusdt_amount, fee_type)
            .map_err(|_| ink::LangError::CouldNotReadInput)
    }
}
```

---

## 3. Estrutura de Crates

```
contracts/
├── common/                          # Crate compartilhada
│   ├── Cargo.toml                   # ink 4.2.1
│   └── src/
│       ├── lib.rs
│       ├── common_types.rs          # FeeType, OperationType, DistributionWallets
│       └── traits.rs                # TaxManager trait, PSP22 trait
│
├── tax_manager/                     # Contrato Tax Manager
│   ├── Cargo.toml                   # ink 4.2.1, depende de common
│   └── src/
│       └── lib.rs                   # impl TaxManagerApi (de common::traits)
│
└── lusdt_token/                     # Contrato LUSDT Token
    ├── Cargo.toml                   # ink 4.2.1, depende de common
    └── src/
        └── lib.rs                   # usa ink::contract_ref!(TaxManager) (de common::traits)
```

### Dependências Cargo.toml

Ambos os contratos dependem de `common`:

```toml
# tax_manager/Cargo.toml
[dependencies]
ink = { version = "4.2.1", default-features = false }
common = { path = "../common", default-features = false }

[features]
std = ["ink/std", "scale/std", "scale-info/std", "common/std"]
```

```toml
# lusdt_token/Cargo.toml
[dependencies]
ink = { version = "4.2.1", default-features = false }
common = { path = "../common", default-features = false }
```

### Trait Compartilhada (`common/src/traits.rs`)

```rust
use crate::common_types::{FeeType, OperationType};
use ink::primitives::AccountId;

#[ink::trait_definition]
pub trait TaxManager {
    #[ink(message)]
    fn process_fees(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
    ) -> Result<(), ink::LangError>;

    #[ink(message)]
    fn process_fees_flexible(
        &mut self,
        operation: OperationType,
        user: AccountId,
        lusdt_amount: u128,
        fee_type: FeeType,
    ) -> Result<(), ink::LangError>;
}
```

### Tipos Compartilhados (`common/src/common_types.rs`)

```rust
pub enum FeeType {
    Lunes,  // Taxas em LUNES tokens
    Lusdt,  // Taxas em LUSDT tokens
    Usdt,   // Taxas marcadas para USDT via bridge (apenas evento)
}

pub enum OperationType {
    Mint,
    Burn,
}

pub struct DistributionWallets {
    pub dev_solana: AccountId,      // 80% fees USDT → Solana
    pub dev_lunes: AccountId,       // 80% fees LUSDT/LUNES → Lunes
    pub insurance_fund: AccountId,  // 15% ALL fees (fixo)
    pub staking_rewards_pool: AccountId, // 5% ALL fees (staking mensal)
}
```

---

## 4. Processo de Deploy Completo

### Pré-requisitos

```bash
# Verificar ferramentas
cargo-contract --version   # 3.2.0
rustc +1.85.0 --version    # 1.85.0

# Nó local rodando
docker start node-lunes    # ws://localhost:9944
```

### Passo 1: Build dos Contratos

```bash
cd /Users/cliente/Documents/Projetos_DEV/LUSDT/contracts

# Build Tax Manager
cd tax_manager
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release

# Build LUSDT Token
cd ../lusdt_token
RUSTUP_TOOLCHAIN=1.85.0 cargo contract build --release
```

Artefatos gerados em `target/ink/`:
- `target/ink/tax_manager/tax_manager.contract` (ABI + WASM)
- `target/ink/lusdt_token/lusdt_token.contract` (ABI + WASM)

### Passo 2: Deploy do Tax Manager (primeiro)

O Tax Manager deve ser deployado primeiro porque o LUSDT Token precisa do seu endereço no construtor.

```bash
cd tax_manager

RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --args \
    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
    '{"dev_solana":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","dev_lunes":"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty","insurance_fund":"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"}' \
    500000 \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000
```

**Parâmetros do construtor**:
| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `lunes_token_address` | Alice | Endereço do token LUNES (PSP22) |
| `lusdt_token_address` | Alice | Placeholder, será atualizado depois |
| `distribution_wallets` | Struct | dev_solana=Alice, dev_lunes=Bob, insurance=Charlie |
| `initial_lunes_price` | `500000` | $0.50 USD (6 decimais) |

**Resultado**: Tax Manager deployado em `5ETkoMMT5TnSBwgcc7ETk31DexEdYP7332kHM7wkgn4FENuw`

### Passo 3: Deploy do LUSDT Token

```bash
cd ../lusdt_token

RUSTUP_TOOLCHAIN=1.85.0 cargo contract instantiate \
  --constructor new \
  --args \
    "5ETkoMMT5TnSBwgcc7ETk31DexEdYP7332kHM7wkgn4FENuw" \
    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
    "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y" \
  --suri //Alice \
  --url ws://localhost:9944 \
  --skip-dry-run --skip-confirm -x \
  --gas 100000000000 --proof-size 500000
```

**Parâmetros do construtor**:
| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `tax_manager_contract` | `5ETko...` | Endereço do Tax Manager deployado |
| `initial_minter` | Alice | Bridge account (MINTER_ROLE) |
| `initial_pauser` | Charlie | Emergency admin (PAUSER_ROLE) |

**Resultado**: LUSDT Token deployado em `5CRWVeC2aqcTRjHbLMUi1ep3xtffmdQEnyNqJAGZUtPUpURc`

### RBAC configurado automaticamente pelo construtor:

| Role | Conta | Descrição |
|------|-------|-----------|
| `DEFAULT_ADMIN_ROLE (0)` | Alice (deployer) | Gerencia roles, upgrade |
| `PAUSER_ROLE (1)` | Charlie | Pausa de emergência |
| `MINTER_ROLE (2)` | Alice | Bridge — pode mintar |
| `TAX_MANAGER_ROLE (3)` | Alice | Configurar taxas |

---

## 5. Verificação E2E — Cross-Contract Funcionando

### Script de Teste

Arquivo: `contracts/scripts/e2e_test_crosscontract.js`

Execução:
```bash
cd bridge-service
NODE_PATH=node_modules node ../contracts/scripts/e2e_test_crosscontract.js
```

### Gas Limits Utilizados

```javascript
// Para transações (mint, burn)
const gl = api.registry.createType('WeightV2', {
  refTime: 50_000_000_000n,
  proofSize: 5_000_000n
});

// Para queries (totalSupply, balanceOf, getMonthlyVolumeUsd)
const qgl = api.registry.createType('WeightV2', {
  refTime: 5_000_000_000_000n,
  proofSize: 5_000_000n
});
```

> **Importante**: `proofSize` deve ser alto (5_000_000). Valores baixos (250_000) causam `OutOfGas` mesmo em queries simples.

### Resultados do Teste

```
=== PRE-STATE ===
totalSupply: {"ok":0}
monthlyVolume: 0

=== TEST 1: MINT 1000 LUSDT to Bob ===
Mint OK: true | Block: 0x...

=== POST-MINT STATE ===
totalSupply: {"ok":1000000000}          ← 1000 LUSDT (6 decimais)
Bob balance: {"ok":1000000000}
Tax monthlyVolume: 1000000000           ← Volume atualizado via cross-contract!

=== TEST 2: BURN 500 LUSDT from Bob ===
Burn OK: true | Block: 0x...

=== FINAL STATE ===
totalSupply: {"ok":500000000}           ← 500 LUSDT restante
Bob balance: {"ok":500000000}
Tax monthlyVolume: 1500000000           ← Volume acumulado (1000 + 500)

=== E2E COMPLETE ===
```

### O que o teste comprova

1. **Mint funciona**: `LUSDT.mint()` → totalSupply aumenta
2. **Cross-contract no mint funciona**: `monthlyVolume` no Tax Manager é atualizado automaticamente pela chamada `process_fees_flexible` dentro do `mint()`
3. **Burn funciona**: `LUSDT.burn()` → totalSupply diminui, valida endereço Solana
4. **Cross-contract no burn funciona**: `monthlyVolume` continua acumulando
5. **Evento `UsdtBridgeFeeMarked`** é emitido (verificável via explorer)

---

## 6. Distribuição de Taxas

### Modelo v2 (FeeType::Usdt)

Para operações via bridge (mint/burn), as taxas são **marcadas** on-chain e **distribuídas** off-chain:

```
On-chain (Tax Manager):
  1. Calcula fee = amount * current_fee_bps / 10000
  2. Atualiza monthly_volume_usd
  3. Emite UsdtBridgeFeeMarked { fee_amount_usd }

Off-chain (Bridge Service):
  1. Escuta evento UsdtBridgeFeeMarked
  2. Distribui USDT na Solana:
     ├── 80% → dev_solana wallet
     ├── 15% → insurance_fund wallet
     └──  5% → staking_rewards_pool wallet
```

### Tiers de Taxa (adaptativos por volume)

| Volume Mensal | Taxa (bps) | Porcentagem |
|---------------|-----------|-------------|
| ≤ $10,000 | 60 | 0.60% |
| $10K - $100K | 50 | 0.50% |
| > $100K | 30 | 0.30% |

### Exemplo de cálculo

Mint de 1000 LUSDT (tier baixo):
```
fee = 1000 * 60 / 10000 = 6 USDT
├── dev (80%):       4.80 USDT → dev_solana wallet
├── insurance (15%): 0.90 USDT → insurance_fund wallet
└── staking (5%):    0.30 USDT → staking_rewards_pool wallet
```

---

## 7. Configuração do Frontend e Bridge Service

Após o deploy dos contratos, os seguintes arquivos foram atualizados:

### Frontend (`lusdt-app`)

| Arquivo | Mudança |
|---------|---------|
| `src/contracts/addresses.ts` | Endereços locais atualizados |
| `src/contracts/metadata.ts` | ABI real do Tax Manager importado |
| `src/contracts/lusdt_token.contract.json` | ABI atualizado pós-rebuild |
| `src/contracts/tax_manager.contract.json` | ABI real copiado de `target/ink/` |
| `src/hooks/useLunesContract.ts` | `gasLimit: -1` → WeightV2 correto |
| `src/config.ts` | Endereços locais atualizados |
| `.env` | `VITE_USE_LOCAL_NODE=true` |

### Bridge Service (`bridge-service`)

| Arquivo | Mudança |
|---------|---------|
| `.env` | `LUSDT_CONTRACT_ADDRESS` e `TAX_MANAGER_CONTRACT_ADDRESS` corrigidos |
| `.env` | `LUNES_WALLET_SEED=//Alice` (owner dos contratos) |
| `src/lunes/client.ts` | Suporta `//Alice` (dev URI) além de mnemonic |

---

## 8. Lições Aprendidas

### 1. Selectors devem coincidir

Em ink! 4.x, chamadas cross-contract via `ink::contract_ref!(TraitName)` geram selectors baseados no **path completo da trait**. Se o contrato alvo implementa uma trait diferente (mesmo com assinatura idêntica), os selectors não coincidem → `ContractTrapped`.

**Regra**: Ambos os contratos devem referenciar **a mesma trait definition** (mesma crate, mesmo módulo).

### 2. proofSize deve ser alto

Queries e transações em contratos ink! v4 na Lunes testnet requerem `proofSize >= 5_000_000`. Valores menores causam `OutOfGas` silencioso.

### 3. Endereço Solana: 32-44 caracteres

O contrato LUSDT valida que o endereço Solana no burn tem entre 32 e 44 caracteres (base58). Endereços inválidos retornam `InvalidSolanaAddress`.

### 4. FeeType::Usdt não faz transfer on-chain

O path `FeeType::Usdt` no Tax Manager **não chama** `transfer_from` em nenhum token. Ele apenas emite um evento e atualiza o volume. A distribuição real de USDT acontece off-chain pelo bridge-service.

### 5. Ordem de deploy importa

```
1. Tax Manager (não depende de ninguém para ser deployado)
2. LUSDT Token (precisa do endereço do Tax Manager no construtor)
```

---

## 9. Comandos Úteis

```bash
# Verificar totalSupply do LUSDT
cargo contract call --contract 5CRWVeC2aqcTRjHbLMUi1ep3xtffmdQEnyNqJAGZUtPUpURc \
  --message total_supply --suri //Alice --url ws://localhost:9944 --dry-run

# Verificar volume mensal no Tax Manager
cargo contract call --contract 5ETkoMMT5TnSBwgcc7ETk31DexEdYP7332kHM7wkgn4FENuw \
  --message get_monthly_volume_usd --suri //Alice --url ws://localhost:9944 --dry-run

# Verificar taxa atual (bps)
cargo contract call --contract 5ETkoMMT5TnSBwgcc7ETk31DexEdYP7332kHM7wkgn4FENuw \
  --message get_current_fee_bps --suri //Alice --url ws://localhost:9944 --dry-run

# Executar teste E2E cross-contract
cd bridge-service && NODE_PATH=node_modules node ../contracts/scripts/e2e_test_crosscontract.js

# Build frontend
cd lusdt-app && pnpm build

# Iniciar frontend dev
cd lusdt-app && pnpm dev

# Iniciar bridge service
cd bridge-service && pnpm dev
```

---

**Status**: ✅ Deploy com cross-contract verificado e funcionando  
**Última atualização**: 12 Fevereiro 2026 (v2 — com StakingManager + BurnEngine)
