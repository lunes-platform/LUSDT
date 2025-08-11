#!/bin/bash

set -e

echo "--- Teste do Cofre Multisig LUSDT (Ambiente Local) ---"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

KEYS_DIR="solana-keys"

# Verificar se o ambiente foi configurado
if [ ! -f "$KEYS_DIR/local-test-config.env" ]; then
    echo -e "${RED}❌ Ambiente de teste não configurado. Execute './setup-local-test.sh' primeiro.${NC}"
    exit 1
fi

# Carregar configurações
source $KEYS_DIR/local-test-config.env

echo -e "${BLUE}🔑 Carregando configurações...${NC}"
echo "   -> Rede: $NETWORK"
echo "   -> RPC: $RPC_URL"
echo "   -> USDT Mint: $USDT_TOKEN_MINT"
echo "   -> Autoridade Multisig: $MULTISIG_AUTHORITY"
echo "   -> Conta do Tesouro: $TREASURY_ACCOUNT"

# Configurar CLI
solana config set --url $RPC_URL

# Criar conta de destino para teste
echo -e "${BLUE}🛠️  Preparando teste...${NC}"
TEST_DEST_KEYPAIR=$(mktemp)
solana-keygen new --no-bip39-passphrase --silent --outfile $TEST_DEST_KEYPAIR
TEST_DEST_PUBKEY=$(solana-keygen pubkey $TEST_DEST_KEYPAIR)
echo "   -> Conta de destino do teste: $TEST_DEST_PUBKEY"

# Criar conta de token para o destinatário
echo "   -> Criando conta de token para o destinatário..."
TEST_DEST_TOKEN_ACCOUNT=$(spl-token create-account $USDT_TOKEN_MINT --owner $TEST_DEST_PUBKEY --fee-payer $KEYS_DIR/guardian_1_keypair.json 2>/dev/null | awk '{print $3}')
echo "   -> Conta de token do destino: $TEST_DEST_TOKEN_ACCOUNT"

# Verificar saldo do tesouro
echo -e "${BLUE}💰 Verificando saldo do tesouro...${NC}"
TREASURY_BALANCE=$(spl-token balance --address $TREASURY_ACCOUNT 2>/dev/null || echo "0")
echo "   -> Saldo atual do tesouro: $TREASURY_BALANCE USDT"

if [ "${TREASURY_BALANCE%%.*}" -lt 20 ]; then
    echo -e "${RED}❌ Saldo insuficiente no tesouro para testes (< 20 USDT).${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}--- 🔬 Cenário 1: Teste de Falha (Abaixo do Threshold) ---${NC}"
echo "Tentando transferir 10 USDT com apenas 2 assinaturas. Esta operação DEVE FALHAR."

# Tentar com apenas 2 assinaturas (deve falhar)
spl-token transfer --multisig-signer $KEYS_DIR/guardian_1_keypair.json \
                   --multisig-signer $KEYS_DIR/guardian_2_keypair.json \
                   --from $TREASURY_ACCOUNT \
                   $USDT_TOKEN_MINT 10 $TEST_DEST_TOKEN_ACCOUNT \
                   --fee-payer $KEYS_DIR/guardian_1_keypair.json \
                   --owner $MULTISIG_AUTHORITY 2>&1 | tee test_output.log || true

if grep -q "error\|Error\|insufficient" test_output.log; then
    echo -e "${GREEN}✅ SUCESSO: A transferência falhou como esperado (threshold não atingido).${NC}"
else
    echo -e "${RED}❌ FALHA: A transferência deveria ter falhado mas não falhou.${NC}"
fi

echo ""
echo -e "${YELLOW}--- 🔬 Cenário 2: Teste de Sucesso (Threshold Atingido) ---${NC}"
echo "Transferindo 10 USDT com 3 assinaturas. Esta operação DEVE SUCEDER."

# Verificar saldo antes
echo "   -> Saldo do destinatário ANTES da transferência:"
DEST_BALANCE_BEFORE=$(spl-token balance --address $TEST_DEST_TOKEN_ACCOUNT 2>/dev/null || echo "0")
echo "   -> $DEST_BALANCE_BEFORE USDT"

# Transferir com 3 assinaturas (deve funcionar)
echo "   -> Executando transferência com 3 assinaturas..."
spl-token transfer --multisig-signer $KEYS_DIR/guardian_1_keypair.json \
                   --multisig-signer $KEYS_DIR/guardian_2_keypair.json \
                   --multisig-signer $KEYS_DIR/guardian_3_keypair.json \
                   --from $TREASURY_ACCOUNT \
                   $USDT_TOKEN_MINT 10 $TEST_DEST_TOKEN_ACCOUNT \
                   --fee-payer $KEYS_DIR/guardian_1_keypair.json \
                   --owner $MULTISIG_AUTHORITY 2>&1 | tee test_output_success.log

# Verificar saldo depois
echo "   -> Saldo do destinatário APÓS a transferência:"
DEST_BALANCE_AFTER=$(spl-token balance --address $TEST_DEST_TOKEN_ACCOUNT 2>/dev/null || echo "0")
echo "   -> $DEST_BALANCE_AFTER USDT"

# Verificar se a transferência foi bem-sucedida
if [ "${DEST_BALANCE_AFTER%%.*}" -gt "${DEST_BALANCE_BEFORE%%.*}" ]; then
    echo -e "${GREEN}✅ SUCESSO: Transferência de 10 USDT realizada com sucesso!${NC}"
else
    echo -e "${RED}❌ FALHA: A transferência não foi realizada corretamente.${NC}"
    echo "Saída do comando:"
    cat test_output_success.log
fi

echo ""
echo -e "${YELLOW}--- 🔬 Cenário 3: Teste de Múltiplas Transferências ---${NC}"
echo "Testando múltiplas transferências pequenas..."

# Realizar 3 transferências de 5 USDT cada
for i in {1..3}; do
    echo "   -> Transferência $i de 3 (5 USDT)..."
    spl-token transfer --multisig-signer $KEYS_DIR/guardian_1_keypair.json \
                       --multisig-signer $KEYS_DIR/guardian_2_keypair.json \
                       --multisig-signer $KEYS_DIR/guardian_3_keypair.json \
                       --from $TREASURY_ACCOUNT \
                       $USDT_TOKEN_MINT 5 $TEST_DEST_TOKEN_ACCOUNT \
                       --fee-payer $KEYS_DIR/guardian_1_keypair.json \
                       --owner $MULTISIG_AUTHORITY > /dev/null 2>&1
    sleep 1
done

# Verificar saldo final
DEST_BALANCE_FINAL=$(spl-token balance --address $TEST_DEST_TOKEN_ACCOUNT 2>/dev/null || echo "0")
TREASURY_BALANCE_FINAL=$(spl-token balance --address $TREASURY_ACCOUNT 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Múltiplas transferências concluídas.${NC}"

echo ""
echo -e "${BLUE}📊 --- Resultados Finais ---${NC}"
echo "Saldo Final do Destinatário: $DEST_BALANCE_FINAL USDT"
echo "Saldo Final do Tesouro: $TREASURY_BALANCE_FINAL USDT"
echo "Total Transferido: $((${DEST_BALANCE_FINAL%%.*} - ${DEST_BALANCE_BEFORE%%.*})) USDT"

# Limpeza
rm -f $TEST_DEST_KEYPAIR test_output.log test_output_success.log

if [ "${DEST_BALANCE_FINAL%%.*}" -eq 25 ]; then
    echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM! O multisig está funcionando corretamente.${NC}"
else
    echo -e "${YELLOW}⚠️  Alguns testes podem ter falhado. Verifique os logs acima.${NC}"
fi