#!/bin/bash

set -e

echo "🧪 --- Setup de Ambiente de Teste Local para LUSDT ---"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

KEYS_DIR="solana-keys"

# Verificar se o diretório de chaves existe
if [ ! -d "$KEYS_DIR" ]; then
    echo -e "${RED}❌ Diretório $KEYS_DIR não encontrado. Execute setup-solana-multisig.sh primeiro.${NC}"
    exit 1
fi

echo -e "${BLUE}📡 Configurando ambiente local...${NC}"

# Parar qualquer validator rodando
echo "   -> Parando validators existentes..."
pkill -f solana-test-validator || true
sleep 2

# Iniciar validator local
echo "   -> Iniciando validator local..."
solana-test-validator \
    --reset \
    --quiet \
    --bind-address 0.0.0.0 \
    --rpc-port 8899 \
    --ledger .validator-ledger \
    --limit-ledger-size 50000000 &

VALIDATOR_PID=$!
sleep 5

# Configurar CLI para usar local
echo "   -> Configurando CLI para localhost..."
solana config set --url http://localhost:8899

echo -e "${GREEN}✅ Validator local iniciado (PID: $VALIDATOR_PID)${NC}"

# Carregar guardiões
GUARDIAN_1=$(solana-keygen pubkey $KEYS_DIR/guardian_1_keypair.json)
GUARDIAN_2=$(solana-keygen pubkey $KEYS_DIR/guardian_2_keypair.json)
GUARDIAN_3=$(solana-keygen pubkey $KEYS_DIR/guardian_3_keypair.json)

echo -e "${BLUE}🪙 Criando token USDT de teste...${NC}"

# Airdrop para o guardião 1 (será o pagador)
echo "   -> Fazendo airdrop para guardião 1..."
solana airdrop 10 $GUARDIAN_1

# Criar mint de USDT de teste
echo "   -> Criando mint de USDT..."
USDT_MINT=$(spl-token create-token --decimals 6 --fee-payer $KEYS_DIR/guardian_1_keypair.json | grep "Creating token" | awk '{print $3}')
echo "   -> USDT Mint criado: $USDT_MINT"

# Criar conta de token para o guardian 1
echo "   -> Criando conta de token para guardian 1..."
spl-token create-account $USDT_MINT --owner $GUARDIAN_1 --fee-payer $KEYS_DIR/guardian_1_keypair.json

# Mint 1 milhão de USDT de teste
echo "   -> Mintando 1,000,000 USDT de teste..."
spl-token mint $USDT_MINT 1000000 $GUARDIAN_1 --fee-payer $KEYS_DIR/guardian_1_keypair.json

echo -e "${BLUE}🏛️ Criando multisig local...${NC}"

# Criar autoridade multisig 3-de-5
echo "   -> Criando autoridade multisig..."
MULTISIG_AUTHORITY=$(spl-token create-multisig 3 $GUARDIAN_1 $GUARDIAN_2 $GUARDIAN_3 $GUARDIAN_1 $GUARDIAN_2 --fee-payer $KEYS_DIR/guardian_1_keypair.json | grep "Creating 3/" | awk '{print $4}')
echo "   -> Autoridade Multisig: $MULTISIG_AUTHORITY"

# Criar conta de token do tesouro controlada pelo multisig
echo "   -> Criando conta do tesouro..."
TREASURY_ACCOUNT=$(spl-token create-account $USDT_MINT --owner $MULTISIG_AUTHORITY --fee-payer $KEYS_DIR/guardian_1_keypair.json | awk '{print $3}')
echo "   -> Conta do Tesouro: $TREASURY_ACCOUNT"

# Transferir 500,000 USDT para o tesouro
echo "   -> Transferindo 500,000 USDT para o tesouro..."
spl-token transfer $USDT_MINT 500000 $TREASURY_ACCOUNT --owner $KEYS_DIR/guardian_1_keypair.json --fee-payer $KEYS_DIR/guardian_1_keypair.json

echo -e "${GREEN}🎉 --- Ambiente de Teste Local Configurado --- 🎉${NC}"

# Salvar configurações em arquivo
cat > $KEYS_DIR/local-test-config.env << EOF
# Configurações do Ambiente de Teste Local LUSDT
VALIDATOR_PID=$VALIDATOR_PID
NETWORK=localnet
RPC_URL=http://localhost:8899
USDT_TOKEN_MINT=$USDT_MINT
MULTISIG_AUTHORITY=$MULTISIG_AUTHORITY
TREASURY_ACCOUNT=$TREASURY_ACCOUNT

# Chaves Públicas dos Guardiões
GUARDIAN_1_PUBKEY=$GUARDIAN_1
GUARDIAN_2_PUBKEY=$GUARDIAN_2  
GUARDIAN_3_PUBKEY=$GUARDIAN_3
EOF

echo -e "${YELLOW}📄 Configurações salvas em: $KEYS_DIR/local-test-config.env${NC}"

echo ""
echo "Configuração Final:"
echo "------------------------------------------------------------------"
echo "Rede Solana...................: localnet (http://localhost:8899)"
echo "Validator PID.................: $VALIDATOR_PID"
echo "Token USDT....................: $USDT_MINT"
echo "Autoridade Multisig...........: $MULTISIG_AUTHORITY"
echo "Conta do Tesouro..............: $TREASURY_ACCOUNT"
echo "Saldo do Tesouro..............: 500,000 USDT"
echo "------------------------------------------------------------------"
echo ""
echo -e "${GREEN}✅ Pronto para testes! Use './test-local-multisig.sh' para testar.${NC}"
echo -e "${YELLOW}⚠️  Para parar o validator: kill $VALIDATOR_PID${NC}"