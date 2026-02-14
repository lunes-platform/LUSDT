#!/usr/bin/env bash
set -euo pipefail

# LUSDT Bridge VPS bootstrap (Ubuntu/Debian)
# - Instala Docker + Compose plugin
# - Sobe Redis e Vault (dev mode OFF)
# - Cria estrutura /opt/lusdt/bridge-service

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root: sudo bash scripts/setup-vps-bridge.sh"
  exit 1
fi

APP_DIR="/opt/lusdt/bridge-service"
VAULT_DIR="/opt/lusdt/vault"

apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release jq openssl

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker

# Estrutura
mkdir -p "$APP_DIR" "$VAULT_DIR/data" "$VAULT_DIR/config"

# Vault config (file backend + tls_disable=1 para rede interna; usar reverse proxy TLS externo)
cat > "$VAULT_DIR/config/vault.hcl" <<'EOF'
storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr = "http://127.0.0.1:8200"
ui = true
EOF

cat > "$APP_DIR/docker-compose.vps.yml" <<'EOF'
services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  vault:
    image: hashicorp/vault:1.16
    cap_add:
      - IPC_LOCK
    environment:
      VAULT_LOCAL_CONFIG: ""
    command: vault server -config=/vault/config/vault.hcl
    ports:
      - "127.0.0.1:8200:8200"
    volumes:
      - /opt/lusdt/vault/data:/vault/data
      - /opt/lusdt/vault/config:/vault/config
    restart: unless-stopped

volumes:
  redis_data:
EOF

cd "$APP_DIR"
docker compose -f docker-compose.vps.yml up -d

echo "✅ Base da VPS pronta"
echo "Próximo passo: bash scripts/init-vault-transit.sh"
