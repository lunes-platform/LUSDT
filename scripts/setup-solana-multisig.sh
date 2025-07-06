#!/bin/bash
#
# Script para configurar um cofre multisig 3-de-5 na Solana para o LUSDT Bridge Treasury.
#
# AVISO: Este script gera novas chaves privadas. Manuseie os arquivos gerados com
# extremo cuidado. Em um ambiente de produção, as chaves dos guardiões devem
# ser geradas em dispositivos seguros e isolados (preferencialmente hardware wallets).
#

set -e

# --- Configurações ---
# Altere para --url mainnet-beta para produção
NETWORK_URL="devnet"
# Endereço do token USDT na rede escolhida
# Devnet: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
# Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDT_MINT_ADDRESS="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
# Número de guardiões
NUM_GUARDIANS=5
# Threshold de assinaturas necessárias
THRESHOLD=3

# Diretório para salvar as chaves
KEYS_DIR="solana-keys"
mkdir -p $KEYS_DIR
echo "🔑 Chaves e configurações serão salvas no diretório: $KEYS_DIR"
echo ""

# --- Passo 1: Configurar a CLI da Solana ---
echo "📡 Configurando a CLI da Solana para usar a rede: $NETWORK_URL"
solana config set --url $NETWORK_URL
echo ""

# --- Passo 2: Gerar Chaves para os Guardiões ---
GUARDIAN_PUBKEYS=()
echo "🔐 Gerando $NUM_GUARDIANS pares de chaves para os guardiões..."
for i in $(seq 1 $NUM_GUARDIANS); do
  KEY_PATH="$KEYS_DIR/guardian_${i}_keypair.json"
  if [ ! -f "$KEY_PATH" ]; then
    solana-keygen new --no-passphrase --outfile "$KEY_PATH" > /dev/null
    echo "   -> Chave do Guardião $i criada em: $KEY_PATH"
  else
    echo "   -> Chave do Guardião $i já existe em: $KEY_PATH"
  fi
  PUBKEY=$(solana-keygen pubkey "$KEY_PATH")
  GUARDIAN_PUBKEYS+=("$PUBKEY")
done
echo "✅ Chaves dos guardiões geradas."
echo ""

# --- Passo 3: Criar a Conta de Autoridade Multisig ---
# Esta conta não guarda os fundos, ela apenas tem a autoridade para assinar.
echo "🏛️ Criando a conta de autoridade multisig $THRESHOLD-de-$NUM_GUARDIANS..."

# O primeiro guardião paga pela criação da conta.
# Precisamos garantir que ele tenha fundos.
GUARDIAN_1_KEYPATH="$KEYS_DIR/guardian_1_keypair.json"
GUARDIAN_1_PUBKEY=${GUARDIAN_PUBKEYS[0]}

echo "   -> Verificando saldo do pagador (Guardião 1: $GUARDIAN_1_PUBKEY)..."
solana balance "$GUARDIAN_1_KEYPATH" || true
echo "   -> Solicitando airdrop para o pagador (pode demorar um pouco)..."
solana airdrop 2 "$GUARDIAN_1_KEYPATH"
echo "   -> Saldo atualizado:"
solana balance "$GUARDIAN_1_KEYPATH"
echo ""

MULTISIG_ADDRESS_FILE="$KEYS_DIR/multisig_authority_address.txt"

if [ ! -f "$MULTISIG_ADDRESS_FILE" ]; then
  echo "   -> Executando comando para criar a autoridade multisig..."
  MULTISIG_ADDRESS=$(spl-token create-multisig --threshold $THRESHOLD ${GUARDIAN_PUBKEYS[@]} --fee-payer "$GUARDIAN_1_KEYPATH" | head -n 1 | awk '{print $3}')
  echo "$MULTISIG_ADDRESS" > "$MULTISIG_ADDRESS_FILE"
  echo "   -> Autoridade multisig criada com sucesso!"
else
  MULTISIG_ADDRESS=$(cat "$MULTISIG_ADDRESS_FILE")
  echo "   -> Autoridade multisig já existe."
fi
echo "   -> Endereço da Autoridade Multisig: $MULTISIG_ADDRESS"
echo "✅ Conta de autoridade multisig configurada."
echo ""


# --- Passo 4: Criar a Conta de Token do Tesouro (Treasury) ---
# Esta é a conta que efetivamente guardará os tokens USDT.
# Seu "proprietário" é a conta de autoridade multisig.
echo "🏦 Criando a conta de token do Tesouro (Treasury) para USDT..."
TREASURY_ACCOUNT_FILE="$KEYS_DIR/treasury_token_account_address.txt"

if [ ! -f "$TREASURY_ACCOUNT_FILE" ]; then
  echo "   -> Executando comando para criar a conta de token do tesouro..."
  # A conta de token é criada, e o --owner é a autoridade multisig.
  TREASURY_TOKEN_ACCOUNT=$(spl-token create-account "$USDT_MINT_ADDRESS" --owner "$MULTISIG_ADDRESS" --fee-payer "$GUARDIAN_1_KEYPATH" | head -n 1 | awk '{print $3}')
  echo "$TREASURY_TOKEN_ACCOUNT" > "$TREASURY_ACCOUNT_FILE"
  echo "   -> Conta do Tesouro criada com sucesso!"
else
  TREASURY_TOKEN_ACCOUNT=$(cat "$TREASURY_ACCOUNT_FILE")
  echo "   -> Conta do Tesouro já existe."
fi
echo "   -> Endereço da Conta de Token do Tesouro: $TREASURY_TOKEN_ACCOUNT"
echo "✅ Conta de token do tesouro configurada."
echo ""


# --- Resumo Final ---
echo "🎉 --- Configuração do Cofre Multisig Finalizada --- 🎉"
echo ""
echo "Rede Solana.....................: $NETWORK_URL"
echo "Token USDT (Mint Address).......: $USDT_MINT_ADDRESS"
echo "Threshold de Assinaturas........: $THRESHOLD de $NUM_GUARDIANS"
echo ""
echo "Endereços Públicos Gerados:"
echo "------------------------------------------------------------------"
echo "Autoridade Multisig (Owner).....: $MULTISIG_ADDRESS"
echo "Conta do Tesouro (Guarda os USDT): $TREASURY_TOKEN_ACCOUNT"
echo "------------------------------------------------------------------"
echo ""
echo "Guardiões (Chaves Públicas):"
for i in $(seq 1 $NUM_GUARDIANS); do
  echo "Guardião $i...................: ${GUARDIAN_PUBKEYS[$i-1]}"
done
echo ""
echo "Para interagir com o cofre, use o endereço da 'Conta do Tesouro'."
echo "Para configurar o Bridge Service, use o endereço da 'Conta do Tesouro' como TREASURY_ACCOUNT_ADDRESS."
echo "As chaves privadas dos guardiões estão salvas em: $KEYS_DIR/"
echo "PROTEJA ESTES ARQUIVOS. NÃO OS COMMIT NO GIT."
echo ""
echo "Para testar, envie alguns USDT (de Devnet) para o endereço da 'Conta do Tesouro'."
echo "spl-token transfer $USDT_MINT_ADDRESS 100 $TREASURY_TOKEN_ACCOUNT --fund-recipient --fee-payer $GUARDIAN_1_KEYPATH"
echo ""
echo "Setup completo." 