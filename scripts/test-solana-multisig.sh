#!/bin/bash
#
# Script de Teste de Integração para o Cofre Multisig na Solana.
#
# Este script assume que `setup-solana-multisig.sh` já foi executado
# e que o diretório `solana-keys/` existe e está populado.
#
# Cenários de Teste:
# 1. Transferência com 2/5 assinaturas -> DEVE FALHAR
# 2. Transferência com 3/5 assinaturas -> DEVE SUCEDER
#

set -e

# --- Configurações ---
NETWORK_URL="devnet"
USDT_MINT_ADDRESS="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
KEYS_DIR="solana-keys"
AMOUNT_TO_TRANSFER=10 # Quantidade de tokens para transferir no teste

# --- Validações Iniciais ---
if [ ! -d "$KEYS_DIR" ]; then
  echo "❌ Erro: Diretório de chaves '$KEYS_DIR' não encontrado."
  echo "   Por favor, execute 'scripts/setup-solana-multisig.sh' primeiro."
  exit 1
fi

echo "--- Script de Teste do Cofre Multisig LUSDT ---"
echo ""

# --- Carregar Endereços e Chaves ---
echo "🔑 Carregando endereços e chaves do diretório '$KEYS_DIR'..."
MULTISIG_AUTHORITY=$(cat "$KEYS_DIR/multisig_authority_address.txt")
TREASURY_ACCOUNT=$(cat "$KEYS_DIR/treasury_token_account_address.txt")
GUARDIAN_1_KEYPATH="$KEYS_DIR/guardian_1_keypair.json"
GUARDIAN_2_KEYPATH="$KEYS_DIR/guardian_2_keypair.json"
GUARDIAN_3_KEYPATH="$KEYS_DIR/guardian_3_keypair.json"

echo "   -> Autoridade Multisig: $MULTISIG_AUTHORITY"
echo "   -> Conta do Tesouro:    $TREASURY_ACCOUNT"
echo ""

# --- Preparar Contas para o Teste ---
echo "🛠️  Preparando o ambiente de teste..."

# Criar uma conta de destino para receber a transferência
RECIPIENT_KEYPATH="$KEYS_DIR/test_recipient_keypair.json"
if [ ! -f "$RECIPIENT_KEYPATH" ]; then
  solana-keygen new --no-passphrase --outfile "$RECIPIENT_KEYPATH" > /dev/null
fi
RECIPIENT_PUBKEY=$(solana-keygen pubkey "$RECIPIENT_KEYPATH")
echo "   -> Conta de destino do teste: $RECIPIENT_PUBKEY"

# Criar a conta de token associada para o destinatário
echo "   -> Criando conta de token para o destinatário..."
RECIPIENT_TOKEN_ACCOUNT=$(spl-token create-account "$USDT_MINT_ADDRESS" --owner "$RECIPIENT_PUBKEY" --fee-payer "$GUARDIAN_1_KEYPATH" | head -n 1 | awk '{print $3}')
echo "   -> Conta de token do destino: $RECIPIENT_TOKEN_ACCOUNT"
echo ""

# Verificar e popular o saldo do tesouro se necessário
echo "💰 Verificando saldo do tesouro..."
TREASURY_BALANCE=$(spl-token balance "$TREASURY_ACCOUNT" | head -n 1 | awk '{print $2}' | sed 's/\..*//') # Pega apenas a parte inteira
echo "   -> Saldo atual do tesouro: $TREASURY_BALANCE USDT"

if [ "$TREASURY_BALANCE" -lt "$AMOUNT_TO_TRANSFER" ]; then
  echo "   -> Saldo insuficiente. Enviando 100 USDT de teste para o tesouro..."
  spl-token transfer "$USDT_MINT_ADDRESS" 100 "$TREASURY_ACCOUNT" --fund-recipient --allow-unfunded-recipient --fee-payer "$GUARDIAN_1_KEYPATH"
  echo "   -> Saldo do tesouro atualizado."
fi
echo ""

# --- Cenário 1: Teste de Falha (2 de 5 assinaturas) ---
echo "--- 🔬 Cenário 1: Teste de Falha (Abaixo do Threshold) ---"
echo "Tentando transferir $AMOUNT_TO_TRANSFER USDT com apenas 2 assinaturas. Esta operação DEVE FALHAR."
echo ""

set +e # Desativar 'exit on error' temporariamente para capturar a falha esperada
spl-token transfer "$USDT_MINT_ADDRESS" "$AMOUNT_TO_TRANSFER" "$RECIPIENT_TOKEN_ACCOUNT" \
  --owner "$MULTISIG_AUTHORITY" \
  --multisig-signer "$GUARDIAN_1_KEYPATH" \
  --multisig-signer "$GUARDIAN_2_KEYPATH" > test_output.log 2>&1
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
  echo "✅ SUCESSO: A transferência falhou como esperado."
  grep -q "Error: Insufficient signers" test_output.log && echo "   -> Motivo da falha: 'Insufficient signers', que é o esperado." || echo "   -> A falha ocorreu por outro motivo (ver test_output.log)."
else
  echo "❌ FALHA NO TESTE: A transferência foi bem-sucedida com menos de 3 assinaturas!"
  exit 1
fi
rm test_output.log
echo ""


# --- Cenário 2: Teste de Sucesso (3 de 5 assinaturas) ---
echo "--- 🔬 Cenário 2: Teste de Sucesso (Threshold Atingido) ---"
echo "Transferindo $AMOUNT_TO_TRANSFER USDT com 3 assinaturas. Esta operação DEVE SUCEDER."
echo ""

echo "   -> Saldo do destinatário ANTES da transferência:"
spl-token balance "$RECIPIENT_TOKEN_ACCOUNT" || echo "   -> (conta ainda não tem saldo)"
echo ""

echo "   1. Guardião 1 assina e propõe a transação..."
spl-token transfer "$USDT_MINT_ADDRESS" "$AMOUNT_TO_TRANSFER" "$RECIPIENT_TOKEN_ACCOUNT" \
  --owner "$MULTISIG_AUTHORITY" \
  --multisig-signer "$GUARDIAN_1_KEYPATH"

echo "   2. Guardião 2 assina a transação pendente..."
spl-token transfer "$USDT_MINT_ADDRESS" "$AMOUNT_TO_TRANSFER" "$RECIPIENT_TOKEN_ACCOUNT" \
  --owner "$MULTISIG_AUTHORITY" \
  --multisig-signer "$GUARDIAN_2_KEYPATH"

echo "   3. Guardião 3 assina e executa a transação (atinge o threshold)..."
spl-token transfer "$USDT_MINT_ADDRESS" "$AMOUNT_TO_TRANSFER" "$RECIPIENT_TOKEN_ACCOUNT" \
  --owner "$MULTISIG_AUTHORITY" \
  --multisig-signer "$GUARDIAN_3_KEYPATH"

echo ""
echo "   -> Transação executada. Verificando o saldo final do destinatário..."
echo ""
spl-token balance "$RECIPIENT_TOKEN_ACCOUNT"

RECIPIENT_FINAL_BALANCE=$(spl-token balance "$RECIPIENT_TOKEN_ACCOUNT" | head -n 1 | awk '{print $2}' | sed 's/\..*//')

if [ "$RECIPIENT_FINAL_BALANCE" -ge "$AMOUNT_TO_TRANSFER" ]; then
  echo "✅ SUCESSO: O saldo do destinatário foi atualizado corretamente."
else
  echo "❌ FALHA NO TESTE: O saldo do destinatário não foi atualizado após a transferência!"
  exit 1
fi
echo ""


echo "🎉 --- Todos os cenários de teste do cofre multisig foram concluídos com sucesso! --- 🎉" 