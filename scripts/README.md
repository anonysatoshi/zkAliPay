# 🛠️ Deployment Scripts

Automated scripts for managing zkAliPay deployment configuration.

---

## ⚠️ **IMPORTANT: WalletConnect Setup Required**

Before using these scripts, you **MUST** set up a WalletConnect Cloud project:

1. 🌐 Go to https://cloud.walletconnect.com
2. 📝 Create a free account (if you don't have one)
3. ➕ Create a new project
4. 📋 Copy your Project ID
5. ✏️ Update `deployment.config.json`:
   ```json
   "walletConnect": {
     "projectId": "YOUR_REAL_PROJECT_ID_HERE"
   }
   ```

**⚠️ The dummy project ID (`dummy-project-id-for-local-testing`) won't work!**

The frontend will crash with a runtime error if you don't provide a valid WalletConnect project ID.

---

## 📋 Available Scripts

### `generate-env.js` - Environment File Generator

Automatically generates environment files for backend and frontend from the centralized `deployment.config.json`.

**Usage**:
```bash
# Generate for Base Sepolia (recommended for testing)
node scripts/generate-env.js base-sepolia

# Generate for Ethereum Sepolia (current)
node scripts/generate-env.js sepolia

# Generate for Base Mainnet (production)
node scripts/generate-env.js base-mainnet
```

**Generated Files**:
- `orderbook/.env` - Backend configuration
- `frontend/.env.local` - Frontend configuration
- `DEPLOYMENT_INFO.txt` - Deployment summary

**Example Output**:
```
🔧 Generating environment files for: Base Sepolia Testnet
   Chain ID: 84532
   Escrow Contract: 0x...
   Features: Axiom=false, Blockchain=false

✅ Backend environment file created: orderbook/.env
✅ Frontend environment file created: frontend/.env.local
✅ Deployment info file created: DEPLOYMENT_INFO.txt
```

---

## 🔧 Configuration

All configuration is managed in `deployment.config.json` at the project root.

**Structure**:
```json
{
  "networks": {
    "sepolia": { ... },
    "base-sepolia": { ... },
    "base-mainnet": { ... }
  },
  "axiom": { ... },
  "database": { ... },
  "features": {
    "axiomProofGeneration": false,
    "blockchainSubmission": false
  }
}
```

---

## 🚀 Workflow

### 1. Update Configuration
Edit `deployment.config.json`:
```json
"base-sepolia": {
  "rpcUrl": "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY",
  "contracts": {
    "escrow": "0xYOUR_DEPLOYED_ADDRESS",
    "mockUsdc": "0xYOUR_MOCK_USDC_ADDRESS"
  },
  "relayWallet": {
    "address": "0xYOUR_WALLET",
    "privateKey": "0xYOUR_KEY"
  }
}
```

### 2. Generate Environment Files
```bash
node scripts/generate-env.js base-sepolia
```

### 3. Start Services
```bash
# Backend
cd orderbook && cargo run --bin api-server

# Frontend (in another terminal)
cd frontend && npm run dev
```

---

## ⚠️ Important Notes

1. **Never commit `.env` files** - They are auto-generated and may contain sensitive data
2. **Always use `deployment.config.json`** - Single source of truth for all configs
3. **Test wallet only** - The default relay wallet is for testing only, never use on mainnet
4. **Feature flags** - Use `features` section to enable/disable Axiom API and blockchain submission

---

## 📝 Adding New Networks

To add a new network:

1. Edit `deployment.config.json`:
```json
"networks": {
  "your-network": {
    "name": "Your Network Name",
    "chainId": 12345,
    "rpcUrl": "https://...",
    "blockExplorer": "https://...",
    "contracts": {
      "escrow": "TO_BE_DEPLOYED",
      "usdc": "0x..."
    },
    "relayWallet": {
      "address": "TO_BE_SET",
      "privateKey": "TO_BE_SET"
    }
  }
}
```

2. Generate environment files:
```bash
node scripts/generate-env.js your-network
```

---

## 🔒 Security

- **Private Keys**: Store securely, never commit to git
- **Production**: Use hardware wallets or secure key management
- **Environment Files**: Added to `.gitignore` automatically
- **Test Keys**: Clearly marked as "TEST ONLY" in config

---

*Last Updated: November 11, 2025*

