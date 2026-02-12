#!/bin/bash

# LUSDT Contracts Deployment Script
# This script builds and deploys the LUSDT Token and Tax Manager contracts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${1:-"local"}
ENVIRONMENT=${2:-"development"}

echo -e "${BLUE}🚀 LUSDT Contracts Deployment Script${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
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

# Check if cargo-contract is installed
if ! command -v cargo-contract &> /dev/null; then
    print_error "cargo-contract is not installed. Please install it with: cargo install cargo-contract"
    exit 1
fi

print_status "cargo-contract is installed"

# Check if substrate node is running (for local deployment)
if [ "$NETWORK" = "local" ]; then
    if ! curl -s http://localhost:9944 > /dev/null; then
        print_warning "Local substrate node is not running on port 9944"
        print_warning "Please start a local node with: substrate-contracts-node --dev"
    else
        print_status "Local substrate node is running"
    fi
fi

# Build contracts
echo -e "${BLUE}📦 Building contracts...${NC}"

# Build Tax Manager
echo "Building Tax Manager contract..."
cd tax_manager
cargo contract build --release
if [ $? -eq 0 ]; then
    print_status "Tax Manager contract built successfully"
else
    print_error "Failed to build Tax Manager contract"
    exit 1
fi
cd ..

# Build LUSDT Token
echo "Building LUSDT Token contract..."
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
echo -e "${BLUE}🧪 Running tests...${NC}"
cargo test --workspace
if [ $? -eq 0 ]; then
    print_status "All tests passed"
else
    print_error "Tests failed. Deployment aborted."
    exit 1
fi

# Generate deployment artifacts
echo -e "${BLUE}📋 Generating deployment artifacts...${NC}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_DIR="deployments/${NETWORK}_${ENVIRONMENT}_${TIMESTAMP}"
mkdir -p "$DEPLOYMENT_DIR"

# Copy contract artifacts
cp tax_manager/target/ink/tax_manager.contract "$DEPLOYMENT_DIR/"
cp tax_manager/target/ink/tax_manager.wasm "$DEPLOYMENT_DIR/"
cp tax_manager/target/ink/metadata.json "$DEPLOYMENT_DIR/tax_manager_metadata.json"

cp lusdt_token/target/ink/lusdt_token.contract "$DEPLOYMENT_DIR/"
cp lusdt_token/target/ink/lusdt_token.wasm "$DEPLOYMENT_DIR/"
cp lusdt_token/target/ink/metadata.json "$DEPLOYMENT_DIR/lusdt_token_metadata.json"

print_status "Deployment artifacts generated in $DEPLOYMENT_DIR"

# Generate deployment configuration
cat > "$DEPLOYMENT_DIR/deployment_config.json" << EOF
{
  "network": "$NETWORK",
  "environment": "$ENVIRONMENT",
  "timestamp": "$TIMESTAMP",
  "contracts": {
    "tax_manager": {
      "wasm": "tax_manager.wasm",
      "contract": "tax_manager.contract",
      "metadata": "tax_manager_metadata.json"
    },
    "lusdt_token": {
      "wasm": "lusdt_token.wasm",
      "contract": "lusdt_token.contract", 
      "metadata": "lusdt_token_metadata.json"
    }
  },
  "deployment_order": [
    "tax_manager",
    "lusdt_token"
  ],
  "constructor_params": {
    "tax_manager": {
      "lunes_token_address": "REPLACE_WITH_LUNES_TOKEN_ADDRESS",
      "lusdt_token_address": "REPLACE_WITH_LUSDT_TOKEN_ADDRESS",
      "distribution_wallets": {
        "dev": "REPLACE_WITH_DEV_WALLET",
        "dao": "REPLACE_WITH_DAO_WALLET", 
        "backing_fund": "REPLACE_WITH_BACKING_FUND_WALLET",
        "rewards_fund": "REPLACE_WITH_REWARDS_FUND_WALLET",
        "burn_address": "REPLACE_WITH_BURN_ADDRESS"
      },
      "initial_lunes_price": 500000
    },
    "lusdt_token": {
      "tax_manager": "REPLACE_WITH_TAX_MANAGER_ADDRESS",
      "bridge_account": "REPLACE_WITH_BRIDGE_ACCOUNT",
      "emergency_admin": "REPLACE_WITH_EMERGENCY_ADMIN"
    }
  }
}
EOF

print_status "Deployment configuration generated"

# Generate deployment summary
cat > "$DEPLOYMENT_DIR/DEPLOYMENT_SUMMARY.md" << EOF
# LUSDT Contracts Deployment Summary

**Network:** $NETWORK  
**Environment:** $ENVIRONMENT  
**Timestamp:** $TIMESTAMP  

## Contracts Built

### Tax Manager
- **File:** tax_manager.contract
- **WASM:** tax_manager.wasm  
- **Metadata:** tax_manager_metadata.json

### LUSDT Token
- **File:** lusdt_token.contract
- **WASM:** lusdt_token.wasm
- **Metadata:** lusdt_token_metadata.json

## Deployment Steps

1. Deploy Tax Manager contract first
2. Deploy LUSDT Token contract with Tax Manager address
3. Update Tax Manager with LUSDT Token address
4. Configure distribution wallets
5. Set initial LUNES price
6. Transfer ownership to multisig (production only)

## Security Checklist

- [ ] All tests passed
- [ ] Code reviewed and audited
- [ ] Constructor parameters validated
- [ ] Emergency admin configured
- [ ] Rate limits configured
- [ ] Distribution wallets verified
- [ ] Bridge account configured
- [ ] Ownership transferred (production)

## Next Steps

1. Review deployment_config.json and update placeholder addresses
2. Use cargo-contract to deploy contracts
3. Verify contract deployment
4. Run integration tests
5. Update frontend configuration

EOF

print_status "Deployment summary generated"

echo ""
echo -e "${GREEN}🎉 Deployment preparation completed successfully!${NC}"
echo -e "${BLUE}Deployment artifacts are available in: $DEPLOYMENT_DIR${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review and update deployment_config.json with actual addresses"
echo "2. Deploy contracts using cargo-contract or Polkadot.js Apps"
echo "3. Run post-deployment verification"
echo ""
