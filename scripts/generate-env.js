#!/usr/bin/env node

/**
 * Generate environment files from deployment.config.json
 * Usage: node scripts/generate-env.js [network]
 * Example: node scripts/generate-env.js base-sepolia
 */

const fs = require('fs');
const path = require('path');

// Load deployment config
const configPath = path.join(__dirname, '..', 'deployment.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Get network from command line or default to sepolia
const network = process.argv[2] || 'sepolia';

if (!config.networks[network]) {
  console.error(`❌ Network "${network}" not found in deployment.config.json`);
  console.error(`Available networks: ${Object.keys(config.networks).join(', ')}`);
  process.exit(1);
}

const networkConfig = config.networks[network];
const dbConfig = config.database.development;
const axiomConfig = config.axiom;
const walletConnectConfig = config.walletConnect;
const features = config.features;

console.log(`\n🔧 Generating environment files for: ${networkConfig.name}`);
console.log(`   Chain ID: ${networkConfig.chainId}`);
console.log(`   Escrow Contract: ${networkConfig.contracts.escrow}`);
console.log(`   Features: Axiom=${features.axiomProofGeneration}, Blockchain=${features.blockchainSubmission}\n`);

// ============================================================================
// Backend Environment File (orderbook/.env)
// ============================================================================

const backendEnv = `# zkAliPay Backend Configuration
# Generated from deployment.config.json for network: ${network}
# Generated at: ${new Date().toISOString()}

# Blockchain Configuration
SEPOLIA_RPC_URL=${networkConfig.rpcUrl}
CHAIN_ID=${networkConfig.chainId}
ESCROW_CONTRACT_ADDRESS=${networkConfig.contracts.escrow}
MOCK_USDC_ADDRESS=${networkConfig.contracts.mockUsdc || networkConfig.contracts.usdc}
RELAYER_PRIVATE_KEY=${networkConfig.relayWallet.privateKey}

# Database Configuration
DATABASE_URL=${dbConfig.url}

# Axiom Proving API
AXIOM_API_KEY=${axiomConfig.apiKey}
AXIOM_CONFIG_ID=${axiomConfig.configId}
AXIOM_PROGRAM_ID=${axiomConfig.programId}

# Feature Flags
AXIOM_PROOF_GENERATION=${features.axiomProofGeneration}
BLOCKCHAIN_SUBMISSION=${features.blockchainSubmission}

# Logging
RUST_LOG=info
`;

const backendEnvPath = path.join(__dirname, '..', 'orderbook', '.env');
fs.writeFileSync(backendEnvPath, backendEnv);
console.log(`✅ Backend environment file created: orderbook/.env`);

// ============================================================================
// Frontend Environment File (frontend/.env.local)
// ============================================================================

const frontendEnv = `# zkAliPay Frontend Configuration
# Generated from deployment.config.json for network: ${network}
# Generated at: ${new Date().toISOString()}

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=${networkConfig.chainId}
NEXT_PUBLIC_CHAIN_NAME=${networkConfig.name}
NEXT_PUBLIC_RPC_URL=${networkConfig.rpcUrl}
NEXT_PUBLIC_BLOCK_EXPLORER=${networkConfig.blockExplorer}

# Contract Addresses
NEXT_PUBLIC_ESCROW_ADDRESS=${networkConfig.contracts.escrow}
NEXT_PUBLIC_USDC_ADDRESS=${networkConfig.contracts.mockUsdc || networkConfig.contracts.usdc}

# WalletConnect Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${walletConnectConfig.projectId}

# Feature Flags
NEXT_PUBLIC_AXIOM_ENABLED=${features.axiomProofGeneration}
`;

const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.local');
fs.writeFileSync(frontendEnvPath, frontendEnv);
console.log(`✅ Frontend environment file created: frontend/.env.local`);

// ============================================================================
// Update wagmi.ts with correct chain configuration
// ============================================================================

const wagmiConfig = network === 'sepolia' 
  ? `import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

// Use Alchemy RPC for Sepolia
const sepoliaWithCustomRpc = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: ['${networkConfig.rpcUrl}'],
    },
    public: {
      http: ['${networkConfig.rpcUrl}'],
    },
  },
};

export const config = getDefaultConfig({
  appName: 'zkAliPay',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [sepoliaWithCustomRpc],
  transports: {
    [sepolia.id]: http('${networkConfig.rpcUrl}'),
  },
  ssr: true,
});
`
  : `import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { http } from 'wagmi';

// Use Base Sepolia public RPC
const baseSepoliaWithCustomRpc = {
  ...baseSepolia,
  rpcUrls: {
    default: {
      http: ['${networkConfig.rpcUrl}'],
    },
    public: {
      http: ['${networkConfig.rpcUrl}'],
    },
  },
};

export const config = getDefaultConfig({
  appName: 'zkAliPay',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [baseSepoliaWithCustomRpc],
  transports: {
    [baseSepolia.id]: http('${networkConfig.rpcUrl}'),
  },
  ssr: true,
});
`;

const wagmiPath = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'wagmi.ts');
fs.writeFileSync(wagmiPath, wagmiConfig);
console.log(`✅ Wagmi configuration updated: frontend/src/lib/wagmi.ts`);

// ============================================================================
// Deployment Info File
// ============================================================================

const deploymentInfo = `# Deployment Information
Network: ${networkConfig.name}
Chain ID: ${networkConfig.chainId}
Block Explorer: ${networkConfig.blockExplorer}

## Contracts
- Escrow: ${networkConfig.contracts.escrow}
- USDC: ${networkConfig.contracts.mockUsdc || networkConfig.contracts.usdc}

## Relay Wallet
- Address: ${networkConfig.relayWallet.address}
- Note: ${networkConfig.relayWallet.note}

## Database
- Host: ${dbConfig.host}
- Database: ${dbConfig.database}
- URL: ${dbConfig.url}

## Features
- Axiom Proof Generation: ${features.axiomProofGeneration ? '✅ Enabled' : '❌ Disabled'}
- Blockchain Submission: ${features.blockchainSubmission ? '✅ Enabled' : '❌ Disabled'}

Generated at: ${new Date().toISOString()}
`;

const deploymentInfoPath = path.join(__dirname, '..', 'DEPLOYMENT_INFO.txt');
fs.writeFileSync(deploymentInfoPath, deploymentInfo);
console.log(`✅ Deployment info file created: DEPLOYMENT_INFO.txt`);

// ============================================================================
// Summary
// ============================================================================

console.log(`\n📋 Summary:`);
console.log(`   Network: ${networkConfig.name}`);
console.log(`   Chain ID: ${networkConfig.chainId}`);
console.log(`   Escrow: ${networkConfig.contracts.escrow}`);
console.log(`   USDC: ${networkConfig.contracts.mockUsdc || networkConfig.contracts.usdc}`);
console.log(`\n⚠️  Important Notes:`);
if (networkConfig.relayWallet.privateKey.includes('TO_BE_SET')) {
  console.log(`   - ⚠️  Relay wallet not configured! Set it in deployment.config.json`);
}
if (networkConfig.contracts.escrow === 'TO_BE_DEPLOYED') {
  console.log(`   - ⚠️  Contracts not deployed! Deploy them first.`);
}
if (!features.axiomProofGeneration) {
  console.log(`   - ⚠️  Axiom proof generation is DISABLED (cleanup mode)`);
}
if (!features.blockchainSubmission) {
  console.log(`   - ⚠️  Blockchain submission is DISABLED (cleanup mode)`);
}

console.log(`\n✅ Environment files generated successfully!`);
console.log(`   Run the following to start services:\n`);
console.log(`   # Backend`);
console.log(`   cd orderbook && cargo run --bin api-server\n`);
console.log(`   # Frontend`);
console.log(`   cd frontend && npm run dev\n`);

