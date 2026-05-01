#!/usr/bin/env bash
# Guardian key setup script.
# Reads new keypairs from ~/.lusdt-guardian-keys/ and prints env var exports.
# Paste output into your .env.production or CI secrets.
#
# NEVER commit private keys. Use AWS KMS or Vault in production.
# See bridge-service/src/multisig/hsm-signer.ts for KMS setup.

set -euo pipefail

KEYS_DIR="${HOME}/.lusdt-guardian-keys"

if [ ! -d "$KEYS_DIR" ]; then
  echo "ERROR: $KEYS_DIR not found." >&2
  echo "Run key generation first (see DEPLOYMENT_RUNBOOK.md)" >&2
  exit 1
fi

echo "# Guardian key env vars — paste into .env.production or CI secrets"
echo "# Generated from $KEYS_DIR"
echo ""

for i in 1 2 3 4 5; do
  KEY_FILE="$KEYS_DIR/guardian_${i}.json"
  if [ ! -f "$KEY_FILE" ]; then
    echo "# WARNING: guardian_${i}.json not found" >&2
    continue
  fi
  SECRET=$(python3 -c "import json; d=json.load(open('$KEY_FILE')); print(d.get('secretKeyBase58',''))")
  PUBKEY=$(python3 -c "import json; d=json.load(open('$KEY_FILE')); print(d.get('publicKey',''))")
  echo "SOLANA_GUARDIAN_${i}_PUBLIC_KEY=\"${PUBKEY}\""
  echo "SOLANA_GUARDIAN_${i}_PRIVATE_KEY=\"${SECRET}\""
  echo ""
done

echo "# Multisig threshold (adjust as needed)"
echo "MULTISIG_REQUIRED_SIGNERS=3"
echo ""
echo "# After setting these vars, update the on-chain multisig config:"
echo "# 1. Create new Squads vault with the new public keys above"
echo "# 2. Migrate funds from old vault to new vault"
echo "# 3. Update SOLANA_MULTISIG_VAULT_ADDRESS in your .env.production"
