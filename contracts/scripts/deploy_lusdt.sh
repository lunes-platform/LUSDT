#!/bin/bash

# LUSDT Contract Deployment Script
# Lê a seed do .env do bridge-service e faz deploy na rede Lunes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"
ENV_FILE="$PROJECT_ROOT/bridge-service/.env"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 LUSDT Contract Deployment${NC}"
echo ""

# Verificar se .env existe
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado em: $ENV_FILE${NC}"
    exit 1
fi

# Ler LUNES_WALLET_SEED do .env (sem usar source)
LUNES_WALLET_SEED=$(grep -E '^LUNES_WALLET_SEED=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Verificar se LUNES_WALLET_SEED está definida
if [ -z "$LUNES_WALLET_SEED" ]; then
    echo -e "${RED}❌ LUNES_WALLET_SEED não está definida no .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Seed carregada do .env${NC}"

# Configurações
RPC_URL="wss://ws-lunes-main-01.lunes.io"
CONTRACT_PATH="$PROJECT_ROOT/target/ink/lusdt_token/lusdt_token.contract"

# Verificar se contrato existe
if [ ! -f "$CONTRACT_PATH" ]; then
    echo -e "${RED}❌ Contrato não encontrado: $CONTRACT_PATH${NC}"
    echo -e "${YELLOW}Execute primeiro: cd contracts/lusdt_token && cargo contract build --release${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contrato encontrado${NC}"
echo -e "${BLUE}📡 RPC: $RPC_URL${NC}"
echo ""

# Obter endereço da wallet usando subkey
echo -e "${YELLOW}📋 Verificando endereço da wallet...${NC}"

# Tentar obter endereço com subkey se disponível
if command -v subkey &> /dev/null; then
    WALLET_ADDRESS=$(subkey inspect "$LUNES_WALLET_SEED" 2>/dev/null | grep "SS58 Address" | awk '{print $3}')
    if [ -n "$WALLET_ADDRESS" ]; then
        echo -e "${GREEN}✅ Wallet Address: $WALLET_ADDRESS${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Você está prestes a fazer deploy na MAINNET Lunes!${NC}"
echo -e "${BLUE}Parâmetros do construtor:${NC}"
echo "  - tax_manager: sua wallet (placeholder)"
echo "  - bridge_account: sua wallet (quem faz mint/burn)"  
echo "  - emergency_admin: sua wallet (quem pode pausar)"
echo ""
read -p "Deseja continuar com o deploy? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${YELLOW}Deploy cancelado.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Fazendo deploy do contrato LUSDT...${NC}"

# Deploy - cargo contract vai pedir confirmação e mostrar custos
cargo contract instantiate \
    --url "$RPC_URL" \
    --suri "$LUNES_WALLET_SEED" \
    "$CONTRACT_PATH" \
    --constructor new \
    --args "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"

echo ""
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo -e "${YELLOW}⚠️  IMPORTANTE: Anote o endereço do contrato acima e configure no .env:${NC}"
echo -e "${BLUE}LUSDT_CONTRACT_ADDRESS=<endereco_do_contrato>${NC}"
