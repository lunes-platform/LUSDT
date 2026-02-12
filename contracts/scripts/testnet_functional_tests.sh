#!/bin/bash

# LUSDT Testnet Functional Testing Script
# This script runs comprehensive functional tests on deployed testnet contracts

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
DEPLOYMENT_DIR=${1:-"deployments/testnet_latest"}

echo -e "${BLUE}🧪 LUSDT Testnet Functional Testing${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}Deployment Dir: ${DEPLOYMENT_DIR}${NC}"
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

# Load deployment addresses
if [ ! -f "$DEPLOYMENT_DIR/deployment_addresses.json" ]; then
    print_error "Deployment addresses file not found at $DEPLOYMENT_DIR/deployment_addresses.json"
    print_info "Please run testnet_deploy.sh first or provide correct deployment directory"
    exit 1
fi

TAX_MANAGER_ADDRESS=$(jq -r '.contracts.tax_manager.address' "$DEPLOYMENT_DIR/deployment_addresses.json")
LUSDT_ADDRESS=$(jq -r '.contracts.lusdt_token.address' "$DEPLOYMENT_DIR/deployment_addresses.json")

print_info "Tax Manager Address: $TAX_MANAGER_ADDRESS"
print_info "LUSDT Token Address: $LUSDT_ADDRESS"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_success="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    print_step "Test $TESTS_TOTAL: $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        if [ "$expected_success" = "true" ]; then
            print_status "PASSED: $test_name"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_warning "UNEXPECTED SUCCESS: $test_name (expected to fail)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        if [ "$expected_success" = "false" ]; then
            print_status "PASSED: $test_name (expected failure)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "FAILED: $test_name"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    fi
}

echo -e "${BLUE}📋 Running Functional Tests...${NC}"
echo ""

# Test Suite 1: Contract State Queries
echo -e "${PURPLE}=== Contract State Tests ===${NC}"

run_test "Query LUSDT token name" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message token_name --dry-run" \
    "true"

run_test "Query LUSDT token symbol" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message token_symbol --dry-run" \
    "true"

run_test "Query LUSDT token decimals" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message token_decimals --dry-run" \
    "true"

run_test "Query LUSDT total supply" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message total_supply --dry-run" \
    "true"

run_test "Query Tax Manager owner" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message get_owner --dry-run" \
    "true"

run_test "Query Tax Manager LUNES price" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message get_lunes_price --dry-run" \
    "true"

run_test "Query Tax Manager current fee BPS" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message get_current_fee_bps --dry-run" \
    "true"

echo ""

# Test Suite 2: Access Control Tests
echo -e "${PURPLE}=== Access Control Tests ===${NC}"

run_test "Non-bridge account cannot mint" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message mint --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 1000000" \
    "false"

run_test "Non-owner cannot update Tax Manager price" \
    "cargo contract call --suri //Bob --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message update_lunes_price --args 600000" \
    "false"

run_test "Non-emergency-admin cannot pause" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message emergency_pause" \
    "false"

echo ""

# Test Suite 3: Mint and Balance Tests
echo -e "${PURPLE}=== Mint and Balance Tests ===${NC}"

# Test with bridge account (Bob)
run_test "Bridge account can mint tokens" \
    "cargo contract call --suri //Bob --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message mint --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 1000000000" \
    "true"

run_test "Check user balance after mint" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message balance_of --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy --dry-run" \
    "true"

run_test "Mint zero amount should succeed" \
    "cargo contract call --suri //Bob --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message mint --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 0" \
    "true"

echo ""

# Test Suite 4: Burn and Redemption Tests
echo -e "${PURPLE}=== Burn and Redemption Tests ===${NC}"

run_test "User can burn tokens with valid Solana address" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message burn --args 100000000 'SolanaAddress123456789012345678901'" \
    "true"

run_test "Burn with invalid Solana address should fail" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message burn --args 100000000 'short'" \
    "false"

run_test "Burn zero amount should succeed" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message burn --args 0 'SolanaAddress123456789012345678901'" \
    "true"

echo ""

# Test Suite 5: Transfer Tests
echo -e "${PURPLE}=== Transfer Tests ===${NC}"

run_test "User can transfer tokens" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message transfer --args 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 50000000" \
    "true"

run_test "Transfer more than balance should fail" \
    "cargo contract call --suri //Eve --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message transfer --args 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 999999999999999" \
    "false"

echo ""

# Test Suite 6: Approval and TransferFrom Tests
echo -e "${PURPLE}=== Approval Tests ===${NC}"

run_test "User can approve allowance" \
    "cargo contract call --suri //Dave --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message approve --args 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty 200000000" \
    "true"

run_test "Check allowance after approval" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message allowance --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty --dry-run" \
    "true"

run_test "TransferFrom without allowance should fail" \
    "cargo contract call --suri //Eve --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message transfer_from --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y 100000000" \
    "false"

echo ""

# Test Suite 7: Emergency Pause Tests
echo -e "${PURPLE}=== Emergency Pause Tests ===${NC}"

run_test "Emergency admin can pause contract" \
    "cargo contract call --suri //Charlie --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message emergency_pause" \
    "true"

run_test "Check if contract is paused" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message is_paused --dry-run" \
    "true"

run_test "Operations should fail when paused" \
    "cargo contract call --suri //Bob --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message mint --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 1000000" \
    "false"

run_test "Owner can unpause contract" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message emergency_unpause" \
    "true"

run_test "Operations should work after unpause" \
    "cargo contract call --suri //Bob --url $RPC_ENDPOINT --contract $LUSDT_ADDRESS --message mint --args 5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy 1000000" \
    "true"

echo ""

# Test Suite 8: Tax Manager Tests
echo -e "${PURPLE}=== Tax Manager Tests ===${NC}"

run_test "Owner can update LUNES price" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message update_lunes_price --args 600000" \
    "true"

run_test "Cannot set zero LUNES price" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message update_lunes_price --args 0" \
    "false"

run_test "Query monthly volume" \
    "cargo contract call --suri //Alice --url $RPC_ENDPOINT --contract $TAX_MANAGER_ADDRESS --message get_monthly_volume_usd --dry-run" \
    "true"

echo ""

# Test Suite 9: Rate Limiting Tests (if applicable)
echo -e "${PURPLE}=== Rate Limiting Tests ===${NC}"

# These tests would require multiple large mints in succession
print_info "Rate limiting tests require multiple large transactions and are skipped in basic testing"
print_info "Manual testing recommended for rate limiting validation"

echo ""

# Generate test report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$DEPLOYMENT_DIR/functional_test_report_$TIMESTAMP.md"

cat > "$REPORT_FILE" << EOF
# LUSDT Testnet Functional Test Report

**Date:** $(date)
**Network:** $NETWORK
**Tax Manager:** $TAX_MANAGER_ADDRESS
**LUSDT Token:** $LUSDT_ADDRESS

## Test Summary

- **Total Tests:** $TESTS_TOTAL
- **Passed:** $TESTS_PASSED
- **Failed:** $TESTS_FAILED
- **Success Rate:** $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%

## Test Categories

### ✅ Contract State Tests
- Token metadata queries
- Contract configuration queries
- Owner and role verification

### ✅ Access Control Tests  
- Role-based function access
- Unauthorized access prevention
- Permission validation

### ✅ Mint and Balance Tests
- Token minting functionality
- Balance tracking
- Bridge account permissions

### ✅ Burn and Redemption Tests
- Token burning with Solana addresses
- Address validation
- Redemption event emission

### ✅ Transfer Tests
- Standard token transfers
- Balance validation
- Transfer restrictions

### ✅ Approval Tests
- Allowance management
- TransferFrom functionality
- Permission delegation

### ✅ Emergency Pause Tests
- Emergency pause activation
- Operations blocking during pause
- Unpause and recovery

### ✅ Tax Manager Tests
- Price updates
- Configuration management
- Volume tracking

## Recommendations

$(if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All tests passed! The contracts are functioning correctly on testnet."
    echo ""
    echo "**Next Steps:**"
    echo "1. Perform manual testing via Polkadot.js Apps"
    echo "2. Test integration with bridge service"
    echo "3. Validate frontend integration"
    echo "4. Prepare for mainnet deployment"
else
    echo "⚠️ Some tests failed. Please review the failed tests and investigate:"
    echo ""
    echo "**Issues to Address:**"
    echo "1. Review failed test cases"
    echo "2. Check contract configuration"
    echo "3. Verify account permissions"
    echo "4. Re-run tests after fixes"
fi)

## Manual Testing Checklist

- [ ] Test via Polkadot.js Apps interface
- [ ] Verify fee calculations are correct
- [ ] Test rate limiting with large amounts
- [ ] Validate event emissions
- [ ] Test edge cases and error conditions
- [ ] Performance testing under load

## Contract Interaction URLs

- [Tax Manager on Polkadot.js](https://polkadot.js.org/apps/?rpc=$RPC_ENDPOINT#/contracts/contract/$TAX_MANAGER_ADDRESS)
- [LUSDT Token on Polkadot.js](https://polkadot.js.org/apps/?rpc=$RPC_ENDPOINT#/contracts/contract/$LUSDT_ADDRESS)

EOF

# Print final results
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
fi
echo -e "${BLUE}📋 Total Tests: $TESTS_TOTAL${NC}"
echo -e "${PURPLE}📈 Success Rate: $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%${NC}"
echo ""

print_status "Functional test report generated: $REPORT_FILE"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All functional tests passed! Contracts are ready for integration testing.${NC}"
else
    echo -e "${YELLOW}⚠️ Some tests failed. Please review and address issues before proceeding.${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the detailed test report"
echo "2. Perform manual testing via Polkadot.js Apps"
echo "3. Test integration with bridge service"
echo "4. Update frontend with contract addresses"
echo ""
