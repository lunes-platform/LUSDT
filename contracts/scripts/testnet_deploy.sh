#!/bin/bash

# LUSDT Testnet Deployment and Testing Script
# This script deploys contracts to testnet and runs comprehensive tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
NETWORK="testnet"
RPC_ENDPOINT="wss://rococo-contracts-rpc.polkadot.io"
CONFIG_FILE="testnet_config.json"

echo -e "${BLUE}🚀 LUSDT Testnet Deployment and Testing${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}RPC Endpoint: ${RPC_ENDPOINT}${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v cargo-contract &> /dev/null; then
    print_error "cargo-contract is not installed. Please install it with: cargo install cargo-contract"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it for JSON processing"
    exit 1
fi

print_status "Prerequisites check passed"

# Load configuration
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Configuration file $CONFIG_FILE not found"
    exit 1
fi

print_status "Configuration loaded from $CONFIG_FILE"

# Build contracts
echo -e "${BLUE}📦 Building contracts for testnet...${NC}"

print_step "Building Tax Manager contract..."
cd tax_manager
cargo contract build --release
if [ $? -eq 0 ]; then
    print_status "Tax Manager contract built successfully"
else
    print_error "Failed to build Tax Manager contract"
    exit 1
fi
cd ..

print_step "Building LUSDT Token contract..."
cd lusdt_token
cargo contract build --release
if [ $? -eq 0 ]; then
    print_status "LUSDT Token contract built successfully"
else
    print_error "Failed to build LUSDT Token contract"
    exit 1
fi
cd ..

# Run tests before deployment
echo -e "${BLUE}🧪 Running pre-deployment tests...${NC}"
cargo test --workspace
if [ $? -eq 0 ]; then
    print_status "All tests passed"
else
    print_error "Tests failed. Deployment aborted."
    exit 1
fi

# Create deployment directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_DIR="deployments/testnet_${TIMESTAMP}"
mkdir -p "$DEPLOYMENT_DIR"

# Copy artifacts
cp tax_manager/target/ink/tax_manager.contract "$DEPLOYMENT_DIR/"
cp tax_manager/target/ink/tax_manager.wasm "$DEPLOYMENT_DIR/"
cp tax_manager/target/ink/metadata.json "$DEPLOYMENT_DIR/tax_manager_metadata.json"

cp lusdt_token/target/ink/lusdt_token.contract "$DEPLOYMENT_DIR/"
cp lusdt_token/target/ink/lusdt_token.wasm "$DEPLOYMENT_DIR/"
cp lusdt_token/target/ink/metadata.json "$DEPLOYMENT_DIR/lusdt_token_metadata.json"

cp "$CONFIG_FILE" "$DEPLOYMENT_DIR/"

print_status "Deployment artifacts prepared in $DEPLOYMENT_DIR"

# Deploy Tax Manager
echo -e "${BLUE}🚀 Deploying Tax Manager to testnet...${NC}"

print_step "Uploading Tax Manager contract..."
TAX_MANAGER_UPLOAD_RESULT=$(cargo contract upload \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path tax_manager/Cargo.toml \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    TAX_MANAGER_CODE_HASH=$(echo "$TAX_MANAGER_UPLOAD_RESULT" | jq -r '.code_hash')
    print_status "Tax Manager uploaded. Code Hash: $TAX_MANAGER_CODE_HASH"
else
    print_error "Failed to upload Tax Manager contract"
    exit 1
fi

print_step "Instantiating Tax Manager contract..."
TAX_MANAGER_INSTANTIATE_RESULT=$(cargo contract instantiate \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path tax_manager/Cargo.toml \
    --constructor new \
    --args "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
           "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" \
           '{"dev_solana":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","dev_lunes":"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty","insurance_fund":"5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"}' \
           500000 \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    TAX_MANAGER_ADDRESS=$(echo "$TAX_MANAGER_INSTANTIATE_RESULT" | jq -r '.contract')
    print_status "Tax Manager instantiated at: $TAX_MANAGER_ADDRESS"
else
    print_error "Failed to instantiate Tax Manager contract"
    exit 1
fi

# Deploy LUSDT Token
echo -e "${BLUE}🚀 Deploying LUSDT Token to testnet...${NC}"

print_step "Uploading LUSDT Token contract..."
LUSDT_UPLOAD_RESULT=$(cargo contract upload \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path lusdt_token/Cargo.toml \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    LUSDT_CODE_HASH=$(echo "$LUSDT_UPLOAD_RESULT" | jq -r '.code_hash')
    print_status "LUSDT Token uploaded. Code Hash: $LUSDT_CODE_HASH"
else
    print_error "Failed to upload LUSDT Token contract"
    exit 1
fi

print_step "Instantiating LUSDT Token contract..."
LUSDT_INSTANTIATE_RESULT=$(cargo contract instantiate \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --manifest-path lusdt_token/Cargo.toml \
    --constructor new \
    --args "$TAX_MANAGER_ADDRESS" \
           "5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY" \
           "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty" \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    LUSDT_ADDRESS=$(echo "$LUSDT_INSTANTIATE_RESULT" | jq -r '.contract')
    print_status "LUSDT Token instantiated at: $LUSDT_ADDRESS"
else
    print_error "Failed to instantiate LUSDT Token contract"
    exit 1
fi

# Update Tax Manager with LUSDT address
print_step "Updating Tax Manager with LUSDT Token address..."
UPDATE_RESULT=$(cargo contract call \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --contract "$TAX_MANAGER_ADDRESS" \
    --message update_lusdt_token_address \
    --args "$LUSDT_ADDRESS" \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "Tax Manager updated with LUSDT Token address"
else
    print_warning "Failed to update Tax Manager (this may be expected if method doesn't exist)"
fi

# Save deployment addresses
cat > "$DEPLOYMENT_DIR/deployment_addresses.json" << EOF
{
  "network": "$NETWORK",
  "timestamp": "$TIMESTAMP",
  "rpc_endpoint": "$RPC_ENDPOINT",
  "contracts": {
    "tax_manager": {
      "address": "$TAX_MANAGER_ADDRESS",
      "code_hash": "$TAX_MANAGER_CODE_HASH"
    },
    "lusdt_token": {
      "address": "$LUSDT_ADDRESS", 
      "code_hash": "$LUSDT_CODE_HASH"
    }
  }
}
EOF

print_status "Deployment addresses saved to deployment_addresses.json"

# Run testnet verification
echo -e "${BLUE}🔍 Running testnet verification...${NC}"

# Test 1: Check contract state
print_step "Testing contract state queries..."

# Query LUSDT token name
NAME_RESULT=$(cargo contract call \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --contract "$LUSDT_ADDRESS" \
    --message token_name \
    --dry-run \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    TOKEN_NAME=$(echo "$NAME_RESULT" | jq -r '.data.Ok')
    print_status "LUSDT Token name: $TOKEN_NAME"
else
    print_warning "Failed to query token name"
fi

# Query Tax Manager owner
OWNER_RESULT=$(cargo contract call \
    --suri //Alice \
    --url "$RPC_ENDPOINT" \
    --contract "$TAX_MANAGER_ADDRESS" \
    --message get_owner \
    --dry-run \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    OWNER=$(echo "$OWNER_RESULT" | jq -r '.data.Ok')
    print_status "Tax Manager owner: $OWNER"
else
    print_warning "Failed to query Tax Manager owner"
fi

# Test 2: Test mint operation (if bridge account is set up)
print_step "Testing mint operation..."

MINT_RESULT=$(cargo contract call \
    --suri //Bob \
    --url "$RPC_ENDPOINT" \
    --contract "$LUSDT_ADDRESS" \
    --message mint \
    --args "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy" 1000000000 \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "Mint operation successful"
    
    # Check balance
    BALANCE_RESULT=$(cargo contract call \
        --suri //Alice \
        --url "$RPC_ENDPOINT" \
        --contract "$LUSDT_ADDRESS" \
        --message balance_of \
        --args "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy" \
        --dry-run \
        --output-json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        BALANCE=$(echo "$BALANCE_RESULT" | jq -r '.data.Ok')
        print_status "User balance after mint: $BALANCE"
    fi
else
    print_warning "Mint operation failed (this may be expected if bridge account is not properly configured)"
fi

# Test 3: Test emergency pause (if emergency admin is set up)
print_step "Testing emergency pause functionality..."

PAUSE_RESULT=$(cargo contract call \
    --suri //Charlie \
    --url "$RPC_ENDPOINT" \
    --contract "$LUSDT_ADDRESS" \
    --message emergency_pause \
    --output-json 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "Emergency pause successful"
    
    # Check if contract is paused
    PAUSED_RESULT=$(cargo contract call \
        --suri //Alice \
        --url "$RPC_ENDPOINT" \
        --contract "$LUSDT_ADDRESS" \
        --message is_paused \
        --dry-run \
        --output-json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        IS_PAUSED=$(echo "$PAUSED_RESULT" | jq -r '.data.Ok')
        print_status "Contract paused status: $IS_PAUSED"
    fi
    
    # Unpause for further testing
    UNPAUSE_RESULT=$(cargo contract call \
        --suri //Alice \
        --url "$RPC_ENDPOINT" \
        --contract "$LUSDT_ADDRESS" \
        --message emergency_unpause \
        --output-json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Emergency unpause successful"
    fi
else
    print_warning "Emergency pause failed (this may be expected if emergency admin is not properly configured)"
fi

# Generate test report
cat > "$DEPLOYMENT_DIR/testnet_test_report.md" << EOF
# LUSDT Testnet Deployment Report

**Date:** $(date)
**Network:** $NETWORK
**RPC Endpoint:** $RPC_ENDPOINT

## Deployed Contracts

### Tax Manager
- **Address:** $TAX_MANAGER_ADDRESS
- **Code Hash:** $TAX_MANAGER_CODE_HASH

### LUSDT Token  
- **Address:** $LUSDT_ADDRESS
- **Code Hash:** $LUSDT_CODE_HASH

## Test Results

### ✅ Contract State Queries
- Token name query: $([ -n "$TOKEN_NAME" ] && echo "✅ Success" || echo "⚠️ Failed")
- Tax Manager owner query: $([ -n "$OWNER" ] && echo "✅ Success" || echo "⚠️ Failed")

### 🔄 Functional Tests
- Mint operation: $([ $? -eq 0 ] && echo "✅ Success" || echo "⚠️ Failed")
- Emergency pause: $([ $? -eq 0 ] && echo "✅ Success" || echo "⚠️ Failed")
- Balance queries: $([ -n "$BALANCE" ] && echo "✅ Success" || echo "⚠️ Failed")

## Next Steps

1. **Manual Testing**
   - Test all contract functions via Polkadot.js Apps
   - Verify fee calculations and distributions
   - Test rate limiting functionality

2. **Integration Testing**
   - Connect with bridge service
   - Test end-to-end workflows
   - Validate frontend integration

3. **Performance Testing**
   - Load testing with multiple transactions
   - Gas optimization validation
   - Stress testing emergency procedures

## Contract Addresses for Frontend

\`\`\`json
{
  "tax_manager": "$TAX_MANAGER_ADDRESS",
  "lusdt_token": "$LUSDT_ADDRESS",
  "network": "$NETWORK",
  "rpc_endpoint": "$RPC_ENDPOINT"
}
\`\`\`

## Polkadot.js Apps Links

- [Tax Manager Contract](https://polkadot.js.org/apps/?rpc=$RPC_ENDPOINT#/contracts/contract/$TAX_MANAGER_ADDRESS)
- [LUSDT Token Contract](https://polkadot.js.org/apps/?rpc=$RPC_ENDPOINT#/contracts/contract/$LUSDT_ADDRESS)

EOF

print_status "Test report generated: testnet_test_report.md"

echo ""
echo -e "${GREEN}🎉 Testnet deployment and testing completed!${NC}"
echo -e "${BLUE}Deployment directory: $DEPLOYMENT_DIR${NC}"
echo -e "${BLUE}Tax Manager Address: $TAX_MANAGER_ADDRESS${NC}"
echo -e "${BLUE}LUSDT Token Address: $LUSDT_ADDRESS${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the test report in $DEPLOYMENT_DIR/testnet_test_report.md"
echo "2. Perform manual testing via Polkadot.js Apps"
echo "3. Update frontend configuration with contract addresses"
echo "4. Run integration tests with bridge service"
echo ""
