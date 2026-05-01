# LUSDT Bridge — Security

## Security Architecture Overview

The bridge operates across two chains (Solana and Lunes) and manages real user funds. Defense-in-depth is applied across four layers: off-chain service authentication, on-chain contract access control, key management, and operational spending limits.

---

## 1. Bridge Service Authentication

### HMAC Signature Verification

All protected bridge endpoints (`/admin/*`, internal bridge routes) enforce authentication when `NODE_ENV=production` or `NODE_ENV=staging`.

Authentication methods (in priority order):

1. **HMAC-SHA256** (preferred, server-to-server):
   - Client sends `X-Bridge-Signature: <hex>` and `X-Bridge-Timestamp: <unix_ms>`
   - Payload signed: `${timestamp}.${JSON.stringify(req.body)}`
   - Server computes expected signature using `BRIDGE_API_SECRET`
   - Comparison uses `crypto.timingSafeEqual` (prevents timing attacks)
   - Replay protection: timestamp must be within 5 minutes of server time

2. **Static API key**: `X-Bridge-API-Key` header, compared with `BRIDGE_API_KEY` via `timingSafeEqual`

3. **Basic Auth**: ops credentials fallback (`BRIDGE_OPS_USER` / `BRIDGE_OPS_PASSWORD`)

In `NODE_ENV=development`, authentication is bypassed for local development.

### Rate Limiting

HTTP-level rate limiting via `express-rate-limit` is applied to all routes. Configure `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` in env.

---

## 2. Key Management

### Signer Hierarchy

Private keys are managed through a pluggable signer abstraction in `bridge-service/src/multisig/hsm-signer.ts`. The `HSM_TYPE` environment variable selects the backend:

| HSM_TYPE | Backend | Use Case |
|----------|---------|----------|
| `hashicorp_vault` | HashiCorp Vault Transit engine | Production (recommended) |
| `aws_kms` | AWS KMS (envelope encryption) | Production (cloud-native) |
| `local` | Keypair from env vars | Development and testing only |

**Never use `HSM_TYPE=local` in production.**

### HashiCorp Vault Setup

```bash
# 1. Bootstrap VPS and install Vault
sudo scripts/setup-vps-bridge.sh

# 2. Initialize Vault Transit engine and create ed25519 key
scripts/init-vault-transit.sh

# 3. Configure bridge service
HSM_TYPE=hashicorp_vault
VAULT_URL=https://vault.internal:8200
VAULT_TOKEN=<generated_by_init_script>
VAULT_KEY_NAME=solana-bridge
```

### AWS KMS Setup

```bash
# Create a KMS key for asymmetric signing (ED25519 or use envelope)
aws kms create-key --key-spec ECC_NIST_P256 --key-usage SIGN_VERIFY

HSM_TYPE=aws_kms
AWS_KMS_KEY_ID=<arn_or_key_id>
AWS_REGION=<region>
```

---

## 3. Guardian Key Management

The Solana treasury uses a **3-of-5 SPL multisig**. Five guardian keypairs control the treasury account; any 3 must sign to execute a transfer.

### Initial Key Generation

Generate guardian keys in an air-gapped environment. **Never generate on the production server.**

```bash
mkdir -p ~/.lusdt-guardian-keys

for i in 1 2 3 4 5; do
  solana-keygen new --no-passphrase \
    --outfile ~/.lusdt-guardian-keys/guardian_${i}.json
done
```

In production, use hardware wallets (Ledger) instead of software keypairs.

### Key Rotation Procedure

Use `scripts/setup-guardian-keys.sh` to export new keypairs as environment variables:

```bash
# Generate new guardian keypairs (store in ~/.lusdt-guardian-keys/)
# Then export as env vars:
scripts/setup-guardian-keys.sh
# Output: SOLANA_GUARDIAN_1_PUBLIC_KEY, SOLANA_GUARDIAN_1_PRIVATE_KEY, ... (x5)
# + MULTISIG_REQUIRED_SIGNERS=3
```

After generating new keys:

1. Paste the output into `.env.production` or CI secrets
2. Create a new Squads vault on-chain with the new public keys
3. Migrate funds from old vault to new vault
4. Update `SOLANA_MULTISIG_VAULT_ADDRESS` in `.env.production`
5. Decommission old guardian keypairs

**NEVER commit guardian keypairs to git.** Use `git-filter-repo` or `BFG Repo Cleaner` if a private key is accidentally committed.

### Guardian Key Storage Rules

- Store in `~/.lusdt-guardian-keys/` (outside the repo)
- Add `solana-keys/` and `~/.lusdt-guardian-keys/` to `.gitignore`
- For production: use hardware wallets (Ledger Nano) or HSM-backed key storage
- Back up encrypted copies offline

---

## 4. Smart Contract Access Control

### LUSDT Token — RBAC

On-chain role-based access control using `Mapping<(Role, AccountId), bool>`:

| Role | ID | Holder (production) | Permission |
|------|----|---------------------|------------|
| `DEFAULT_ADMIN_ROLE` | 0 | Deployer multisig | Grant/revoke roles, code upgrade |
| `PAUSER_ROLE` | 1 | Emergency Admin multisig | `emergency_pause()` |
| `MINTER_ROLE` | 2 | Bridge Account (HSM) | `mint()` |
| `TAX_MANAGER_ROLE` | 3 | Deployer multisig | Configure fee parameters |

Access guard: `ensure_role(role)` — reverts with `Error::Unauthorized` if `self.env().caller()` does not hold the role.

Verify post-deployment:
```bash
cargo contract call --contract <LUSDT_ADDRESS> \
  --message has_role --args 2 <BRIDGE_ACCOUNT> \
  --suri //Alice --url wss://ws.lunes.io --dry-run
# Expected: true
```

### Tax Manager — Owner Access

Admin messages (`update_lunes_price`, `update_fee_config`, `set_burn_engine`, `set_lunes_burn_fee_bps`, `update_lusdt_token_address`, `set_code`) are protected by `ensure_owner()`:

```rust
fn ensure_owner(&self) -> Result<(), Error> {
    if self.env().caller() != self.owner {
        Err(Error::Unauthorized)
    } else {
        Ok(())
    }
}
```

**Known consideration**: `process_fees`, `process_fees_flexible`, `process_dual_fee`, and `process_burn_fee_only` do not perform a caller check on-chain. These messages are intended to be called exclusively by the LUSDT Token contract via cross-contract calls during mint/burn operations. A direct call by an arbitrary account would debit that account's own token balance (economically self-defeating), but it is not blocked at the contract level. A future upgrade (`set_code`) should add an `ensure_caller == lusdt_token_address` guard.

Verify post-deployment:
```bash
# Verify Tax Manager owner
cargo contract call --contract <TAX_MANAGER_ADDRESS> \
  --message owner --suri //Alice --url wss://ws.lunes.io --dry-run

# Attempt unauthorized fee config update (should fail)
cargo contract call --contract <TAX_MANAGER_ADDRESS> \
  --message update_fee_config --args ... \
  --suri //Bob --url wss://ws.lunes.io
# Expected: Error::Unauthorized
```

---

## 5. Multisig Vault Security

Every Lunes → Solana transfer passes through a 3-bot approval system before execution.

### Bots

| Bot | Role | Checks |
|-----|------|--------|
| OriginValidatorBot | Validates the originating transaction | Transaction finalized on Lunes? Correct amount? |
| RiskValidatorBot | Evaluates financial risk | Spending limits? Velocity? Treasury solvency? |
| BackupValidatorBot | Operational sanity check | Service healthy? DB confirms event? |

### Quorum Rules

| Transfer Value | Required Approvals | Execution |
|---------------|-------------------|-----------|
| < $5,000 | 2 of 3 | Immediate |
| ≥ $5,000 | 3 of 3 | 10-minute timelock |

### Spending Limits

| Limit | Value |
|-------|-------|
| Per transaction | $10,000 |
| Per hour | $25,000 |
| Per day | $50,000 |

Spending counters are persisted in Redis (`redis-store.ts`) and survive service restarts — limits cannot be reset by redeploying.

### Circuit Breaker

Automatically pauses the vault after 5 consecutive failures within 10 minutes. States: `closed` (normal) → `open` (paused) → `half_open` (recovery probe). Recovery requires manual intervention or automatic cool-down.

---

## 6. Required Environment Variables (Production)

```bash
# === Core ===
NODE_ENV=production                          # Enables HMAC auth and strict validations
LOG_LEVEL=info

# === Authentication ===
BRIDGE_API_SECRET=<32+ bytes, random>        # HMAC-SHA256 signing secret
BRIDGE_API_KEY=<random string>               # Static API key for frontends
BRIDGE_OPS_USER=<username>                   # Basic Auth ops credentials
BRIDGE_OPS_PASSWORD=<strong password>

# === HSM (choose one) ===
HSM_TYPE=hashicorp_vault
VAULT_URL=https://vault.internal:8200
VAULT_TOKEN=<vault_token>
VAULT_KEY_NAME=solana-bridge
# or: HSM_TYPE=aws_kms + AWS_KMS_KEY_ID + AWS_REGION

# === Solana ===
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
USDT_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
TREASURY_ACCOUNT_ADDRESS=<multisig_treasury>
SOLANA_MULTISIG_VAULT_ADDRESS=<squads_vault>

# === Guardian Keys (5 required) ===
SOLANA_GUARDIAN_1_PUBLIC_KEY=<pubkey>
SOLANA_GUARDIAN_1_PRIVATE_KEY=<base58_private>   # Use Vault in prod, not env
# ... GUARDIAN_2 through GUARDIAN_5 ...
MULTISIG_REQUIRED_SIGNERS=3

# === Lunes / ink! Contracts ===
LUNES_RPC_URL=wss://ws.lunes.io
LUSDT_CONTRACT_ADDRESS=<address>
TAX_MANAGER_CONTRACT_ADDRESS=<address>
LUNES_WALLET_SEED=<seed>                         # Bridge account with MINTER_ROLE

# === Database / Cache ===
DATABASE_URL=postgresql://user:pass@host:5432/bridge_db
REDIS_URL=redis://localhost:6379

# === Fee Distribution (Solana) ===
DEV_SOLANA_WALLET=<wallet>
INSURANCE_SOLANA_WALLET=<wallet>
STAKING_REWARDS_SOLANA_WALLET=<wallet>
```

Full template: `bridge-service/env-vps.example`

---

## 7. Security Considerations

### process_fees ABI (Open Access)

**Issue**: `process_fees`, `process_fees_flexible`, `process_dual_fee`, and `process_burn_fee_only` on the Tax Manager contract are callable by any account on-chain.

**Current mitigation**: Only the LUSDT Token contract calls these during its mint/burn flow. Direct external calls debit the caller's own tokens. The economic incentive to abuse this is negative.

**Recommended fix**: In a future contract upgrade via `set_code`, add:
```rust
if self.env().caller() != self.lusdt_token_address {
    return Err(Error::Unauthorized);
}
```

### Multisig Setup (Squads Protocol)

The Squads Protocol on-chain multisig (`squads-client.ts`) is implemented and tested but requires manual activation for mainnet. Until Squads is active on-chain, the 3-bot approval system provides off-chain multisig security via Redis persistence.

**Before mainnet launch**: Activate on-chain Squads vault and migrate from the off-chain bot-only model.

### NODE_ENV Default

`NODE_ENV` defaults to `development` if not set (`bridge-service/src/config/env.ts`). In this mode, authentication is bypassed. **Always set `NODE_ENV=production` in production deployments** and verify it is set before going live:

```bash
curl http://localhost:3001/health | jq '.environment'
# Must return "production"
```

### Redis Persistence

The Redis store persists spending counters and circuit breaker state. If Redis is unavailable at startup, the service logs a warning and continues with in-memory state only — spending limits reset on restart. Monitor Redis availability and set up replication for production.

---

## Contacts

- Security issues: security@lunes.io
- Emergency: emergency@lunes.io
