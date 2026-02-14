#!/usr/bin/env bash
set -euo pipefail

# Inicializa Vault e cria chave Transit ed25519 para o bridge.
# Requer: docker compose stack do setup-vps-bridge já ativo.

APP_DIR="/opt/lusdt/bridge-service"
OUT_DIR="/opt/lusdt/secrets"
mkdir -p "$OUT_DIR"

export VAULT_ADDR="http://127.0.0.1:8200"

# 1) Init (apenas se não iniciado)
INIT_STATUS=$(docker exec $(docker ps --filter "name=vault" --format "{{.ID}}" | head -1) vault status -format=json | jq -r '.initialized' || echo "false")

if [[ "$INIT_STATUS" != "true" ]]; then
  echo "🔐 Inicializando Vault..."
  docker exec $(docker ps --filter "name=vault" --format "{{.ID}}" | head -1) vault operator init -key-shares=1 -key-threshold=1 -format=json > "$OUT_DIR/vault-init.json"
  UNSEAL_KEY=$(jq -r '.unseal_keys_b64[0]' "$OUT_DIR/vault-init.json")
  ROOT_TOKEN=$(jq -r '.root_token' "$OUT_DIR/vault-init.json")
else
  echo "Vault já inicializado. Informe ROOT_TOKEN manualmente para continuar."
  read -r -p "VAULT_ROOT_TOKEN: " ROOT_TOKEN
  read -r -p "VAULT_UNSEAL_KEY (se necessário): " UNSEAL_KEY
fi

# 2) Unseal (se sealed)
SEALED=$(docker exec $(docker ps --filter "name=vault" --format "{{.ID}}" | head -1) vault status -format=json | jq -r '.sealed')
if [[ "$SEALED" == "true" ]]; then
  docker exec -e VAULT_TOKEN="$ROOT_TOKEN" $(docker ps --filter "name=vault" --format "{{.ID}}" | head -1) vault operator unseal "$UNSEAL_KEY"
fi

# 3) Enable transit + create key
CID=$(docker ps --filter "name=vault" --format "{{.ID}}" | head -1)
docker exec -e VAULT_TOKEN="$ROOT_TOKEN" "$CID" vault secrets enable transit || true
docker exec -e VAULT_TOKEN="$ROOT_TOKEN" "$CID" vault write -f transit/keys/solana-bridge type=ed25519 || true

# 4) Policy + token scoped
cat > "$OUT_DIR/bridge-policy.hcl" <<'EOF'
path "transit/sign/solana-bridge" {
  capabilities = ["update"]
}
path "transit/keys/solana-bridge" {
  capabilities = ["read"]
}
EOF

docker cp "$OUT_DIR/bridge-policy.hcl" "$CID":/tmp/bridge-policy.hcl
docker exec -e VAULT_TOKEN="$ROOT_TOKEN" "$CID" vault policy write bridge-signer /tmp/bridge-policy.hcl
BRIDGE_TOKEN=$(docker exec -e VAULT_TOKEN="$ROOT_TOKEN" "$CID" vault token create -policy=bridge-signer -format=json | jq -r '.auth.client_token')

cat > "$OUT_DIR/bridge-vault.env" <<EOF
VAULT_URL=http://127.0.0.1:8200
VAULT_TOKEN=$BRIDGE_TOKEN
VAULT_KEY_PATH=transit
VAULT_KEY_NAME=solana-bridge
HSM_TYPE=hashicorp_vault
EOF

chmod 600 "$OUT_DIR/bridge-vault.env"

echo "✅ Vault Transit pronto"
echo "Arquivos sensíveis em: $OUT_DIR"
