#!/bin/bash

# Universal deployment script for zkAliPay contracts
# Reads configuration from ../deployment.config.json

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if network argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Network argument required${NC}"
    echo "Usage: ./deploy.sh <network>"
    echo ""
    echo "Available networks:"
    echo "  - sepolia       (Ethereum Sepolia Testnet)"
    echo "  - base-sepolia  (Base Sepolia Testnet)"
    echo "  - base-mainnet  (Base Mainnet - Production)"
    echo ""
    exit 1
fi

NETWORK=$1
CONFIG_FILE="../deployment.config.json"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         zkAliPay Contract Deployment                           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: $CONFIG_FILE not found${NC}"
    exit 1
fi

# Read network configuration
echo -e "${CYAN}Reading configuration for network: $NETWORK${NC}"
NETWORK_CONFIG=$(jq -r ".networks[\"$NETWORK\"]" "$CONFIG_FILE")

if [ "$NETWORK_CONFIG" == "null" ]; then
    echo -e "${RED}Error: Network '$NETWORK' not found in $CONFIG_FILE${NC}"
    exit 1
fi

# Extract configuration
RPC_URL=$(echo "$NETWORK_CONFIG" | jq -r '.rpcUrl')
CHAIN_ID=$(echo "$NETWORK_CONFIG" | jq -r '.chainId')
BLOCK_EXPLORER=$(echo "$NETWORK_CONFIG" | jq -r '.blockExplorer')
DEPLOYER_PRIVATE_KEY=$(echo "$NETWORK_CONFIG" | jq -r '.relayWallet.privateKey')

# Read zkPDF configuration
PUBLIC_KEY_DER_HASH=$(jq -r '.axiom.programHash' "$CONFIG_FILE")
APP_EXE_COMMIT="0x004b0a628c0a43a8474d07d7d7f5e3651bae5ddd73f66fc6680c2afd14b8986b"
APP_VM_COMMIT="0x0053b850b281802e42a58b63fe114a0797f8092777f9bbf01df5800fba3c761c"

# Determine if we should deploy MockUSDC
DEPLOY_MOCK_USDC="false"
if [ "$NETWORK" == "sepolia" ] || [ "$NETWORK" == "base-sepolia" ]; then
    DEPLOY_MOCK_USDC="true"
fi

# Verifier address (use existing or deploy new)
VERIFIER_ADDRESS="0x0000000000000000000000000000000000000000"  # 0x0 = deploy new

echo ""
echo -e "${CYAN}Network:${NC}          $NETWORK"
echo -e "${CYAN}Chain ID:${NC}         $CHAIN_ID"
echo -e "${CYAN}RPC URL:${NC}          ${RPC_URL:0:50}..."
echo -e "${CYAN}Block Explorer:${NC}   $BLOCK_EXPLORER"
echo -e "${CYAN}Deploy MockUSDC:${NC}  $DEPLOY_MOCK_USDC"
echo ""

# Confirm deployment
read -p "$(echo -e ${YELLOW}Proceed with deployment? [y/N]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo -e "${CYAN}Starting deployment...${NC}"
echo ""

# Export environment variables for Forge script
export DEPLOYER_PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
export RPC_URL="$RPC_URL"
export VERIFIER_ADDRESS="$VERIFIER_ADDRESS"
export PUBLIC_KEY_DER_HASH="0x$PUBLIC_KEY_DER_HASH"
export APP_EXE_COMMIT="$APP_EXE_COMMIT"
export APP_VM_COMMIT="$APP_VM_COMMIT"
export DEPLOY_MOCK_USDC="$DEPLOY_MOCK_USDC"

# Run Forge deployment script
forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         ✅ DEPLOYMENT SUCCESSFUL! ✅                           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}NEXT STEPS:${NC}"
    echo "1. Copy the deployed contract addresses from above"
    echo "2. Update deployment.config.json with the new addresses"
    echo "3. Run: cd .. && node scripts/generate-env.js $NETWORK"
    echo "4. Restart backend and frontend services"
    echo ""
else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║         ❌ DEPLOYMENT FAILED! ❌                               ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi

