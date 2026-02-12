#!/bin/bash
# LUSDT Local Testnet Deployment Script
# Deploys to ws://localhost:9944 using dev accounts (//Alice, //Bob, //Charlie)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RPC_ENDPOINT="ws://localhost:9944"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

echo -e "${BLUE}🚀 LUSDT Local Deployment${NC}"
echo -e "${BLUE}RPC: ${RPC_ENDPOINT}${NC}"
echo ""

# Prerequisites
if ! command -v cargo-contract &>/dev/null; then
    echo -e "${RED}❌ cargo-contract not found. Install: cargo install cargo-contract${NC}"
    exit 1
fi

# Check node connectivity
echo -e "${BLUE}📡 Checking node connectivity...${NC}"
if ! timeout 5 bash -c "echo > /dev/tcp/localhost/9944" 2>/dev/null; then
    echo -e "${RED}❌ Cannot connect to localhost:9944. Is the Lunes node running?${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node reachable${NC}"

# Create deployment dir
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOY_DIR="$CONTRACTS_DIR/deployments/local_${TIMESTAMP}"
mkdir -p "$DEPLOY_DIR"

# === DEPLOY TAX MANAGER ===
echo -e "${BLUE}📦 Deploying Tax Manager...${NC}"

TAX_UPLOAD=$(cargo contract upload \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path "$CONTRACTS_DIR/tax_manager/Cargo.toml" \
    --output-json 2>/dev/null) || {
    echo -e "${YELLOW}⚠️  Upload may have already been done (code exists). Continuing...${NC}"
}

echo -e "${BLUE}🔨 Instantiating Tax Manager...${NC}"
TAX_INSTANTIATE=$(cargo contract instantiate \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path "$CONTRACTS_DIR/tax_manager/Cargo.toml" \
    --constructor new \
    --args "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
           "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
           '{"dev_solana":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","dev_lunes":"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty","insurance_fund":"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"}' \
           500000 \
    --output-json 2>/dev/null)

TAX_MANAGER_ADDRESS=$(echo "$TAX_INSTANTIATE" | jq -r '.contract')
echo -e "${GREEN}✅ Tax Manager deployed at: $TAX_MANAGER_ADDRESS${NC}"

# === DEPLOY LUSDT TOKEN ===
echo -e "${BLUE}📦 Deploying LUSDT Token...${NC}"

LUSDT_UPLOAD=$(cargo contract upload \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path "$CONTRACTS_DIR/lusdt_token/Cargo.toml" \
    --output-json 2>/dev/null) || {
    echo -e "${YELLOW}⚠️  Upload may have already been done. Continuing...${NC}"
}

# Constructor: new(tax_manager, bridge_account, emergency_admin)
# //Alice = owner (deployer)
# //Alice = bridge_account (for dev testing — can mint)
# //Charlie = emergency_admin
echo -e "${BLUE}🔨 Instantiating LUSDT Token...${NC}"
LUSDT_INSTANTIATE=$(cargo contract instantiate \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path "$CONTRACTS_DIR/lusdt_token/Cargo.toml" \
    --constructor new \
    --args "$TAX_MANAGER_ADDRESS" \
           "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
           "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y" \
    --output-json 2>/dev/null)

LUSDT_ADDRESS=$(echo "$LUSDT_INSTANTIATE" | jq -r '.contract')
echo -e "${GREEN}✅ LUSDT Token deployed at: $LUSDT_ADDRESS${NC}"

# === SAVE RESULTS ===
cat > "$DEPLOY_DIR/deployment_addresses.json" <<EOF
{
  "network": "local",
  "timestamp": "$TIMESTAMP",
  "rpc_endpoint": "$RPC_ENDPOINT",
  "contracts": {
    "tax_manager": "$TAX_MANAGER_ADDRESS",
    "lusdt_token": "$LUSDT_ADDRESS"
  },
  "accounts": {
    "owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY (//Alice)",
    "bridge": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY (//Alice)",
    "emergency_admin": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y (//Charlie)"
  }
}
EOF

# Copy contract artifacts
cp "$ROOT_DIR/target/ink/tax_manager/tax_manager.contract" "$DEPLOY_DIR/"
cp "$ROOT_DIR/target/ink/lusdt_token/lusdt_token.contract" "$DEPLOY_DIR/"

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}  Tax Manager: $TAX_MANAGER_ADDRESS${NC}"
echo -e "${GREEN}  LUSDT Token: $LUSDT_ADDRESS${NC}"
echo -e "${BLUE}  Deployment dir: $DEPLOY_DIR${NC}"
echo ""
echo -e "${YELLOW}Next: Update bridge-service/.env with LUSDT_CONTRACT_ADDRESS=$LUSDT_ADDRESS${NC}"
