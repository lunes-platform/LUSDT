# VPS Deployment Runbook (Bridge + Vault + Redis)

## 1) Bootstrap VPS

```bash
sudo bash scripts/setup-vps-bridge.sh
```

Isso instala Docker/Compose e sobe `redis` + `vault` localmente.

## 2) Inicializar Vault Transit

```bash
sudo bash scripts/init-vault-transit.sh
```

Gera token restrito para assinatura e salva em `/opt/lusdt/secrets/bridge-vault.env`.

## 3) Publicar código na VPS

```bash
mkdir -p /opt/lusdt/bridge-service
# copie o repositório para /opt/lusdt/bridge-service
```

## 4) Configurar .env de produção

Use como base:

- `bridge-service/env-vps.example`
- `/opt/lusdt/secrets/bridge-vault.env`

Arquivo final em:

```bash
/opt/lusdt/bridge-service/.env
```

## 5) Build do bridge-service

```bash
cd /opt/lusdt/bridge-service/bridge-service
pnpm install --frozen-lockfile
pnpm build
```

## 6) Instalar systemd service

```bash
sudo cp /opt/lusdt/bridge-service/scripts/lusdt-bridge.service /etc/systemd/system/lusdt-bridge.service
sudo systemctl daemon-reload
sudo systemctl enable lusdt-bridge
sudo systemctl start lusdt-bridge
sudo systemctl status lusdt-bridge
```

## 7) Verificações

```bash
curl -s http://127.0.0.1:3001/health
journalctl -u lusdt-bridge -f
docker ps
```

## 8) Hardening mínimo recomendado

1. Fechar portas públicas de Redis/Vault (bind localhost já aplicado).
2. Colocar Nginx/Caddy com TLS na frente da API.
3. Guardar `/opt/lusdt/secrets/vault-init.json` offline.
4. Rotacionar `VAULT_TOKEN` periodicamente.
5. Ativar backup de `/opt/lusdt/vault/data` e banco Postgres.
