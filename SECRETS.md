# 🔐 Secrets Management Guide

**⚠️ CRITICAL: This file explains how to manage secrets. Never commit actual secrets to git!**

---

## 📋 Where to Store Secrets

All sensitive information should be stored in `.env` files, which are gitignored:

```
zkAliPay/
├── orderbook/.env              ← Backend secrets (gitignored)
├── frontend/.env.local         ← Frontend secrets (gitignored)
└── contracts/.env              ← Deployment secrets (gitignored, temporary)
```

**✅ SAFE:** .env files (gitignored)  
**❌ NEVER:** deployment.config.json, documentation, or any committed file

---

## 🔑 Required Secrets

### Backend (orderbook/.env)

```bash
# Database
DATABASE_URL="postgresql://zkalipay:PASSWORD@localhost:5432/zkalipay_orderbook"

# Blockchain
SEPOLIA_RPC_URL="https://sepolia.base.org"  # or your Alchemy URL with API key
ESCROW_CONTRACT_ADDRESS="0x..."
MOCK_USDC_ADDRESS="0x..."
CHAIN_ID=84532

# Relayer Wallet (CRITICAL - NEVER COMMIT)
RELAYER_PRIVATE_KEY="0x..."

# Axiom API (if enabled)
AXIOM_API_KEY="key_..."
AXIOM_CONFIG_ID="cfg_..."
AXIOM_PROGRAM_ID="prg_..."
```

### Frontend (frontend/.env.local)

```bash
# API
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Blockchain
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL="https://sepolia.base.org"
NEXT_PUBLIC_BLOCK_EXPLORER="https://sepolia.basescan.org"

# Contracts
NEXT_PUBLIC_ESCROW_ADDRESS="0x..."
NEXT_PUBLIC_USDC_ADDRESS="0x..."

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="..."

# Debug Panel (set to 'false' or remove for production)
NEXT_PUBLIC_ENABLE_DEBUG="true"
```

### Contracts (contracts/.env) - Temporary, delete after deployment

```bash
# Deployment
DEPLOYER_PRIVATE_KEY="0x..."
SEPOLIA_RPC_URL="https://sepolia.base.org"

# Contract Parameters
MIN_TRADE_VALUE_CNY=70000
MAX_TRADE_VALUE_CNY=7200000
PAYMENT_WINDOW=900
PUBLIC_KEY_DER_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"
```

---

## 🛡️ Security Best Practices

### 1. Never Commit Secrets
```bash
# Always verify before committing
git status --ignored

# Check for accidentally committed secrets
git log --all --full-history -- "*/.env" "*/.env.local"
```

### 2. Use Different Secrets for Each Environment
```
Development:  Use test wallets, public RPCs
Staging:      Use dedicated wallets, private RPCs
Production:   Use hardware wallets, managed secrets
```

### 3. Rotate Secrets Regularly
- **Relay Wallet**: Every 3-6 months
- **API Keys**: Every 6-12 months
- **Deployer Wallet**: One-time use, delete immediately

### 4. Use Secret Management Services (Production)
- AWS Secrets Manager
- HashiCorp Vault
- Railway/Vercel Environment Variables
- Google Cloud Secret Manager

---

## 🚨 What If Secrets Are Leaked?

If you accidentally commit secrets:

1. **Immediately rotate the compromised keys**
2. **Check wallet balances** (if private key leaked)
3. **Revoke API keys** (Alchemy, Axiom, WalletConnect)
4. **Clean git history**:
   ```bash
   # If not yet pushed
   git reset --hard HEAD~1
   
   # If already pushed (requires force push)
   git filter-repo --path .env --invert-paths
   git push --force
   ```

---

## 📝 Deployment Checklist

Before deploying to production:

- [ ] All secrets stored in .env files only
- [ ] No secrets in deployment.config.json
- [ ] No secrets in documentation
- [ ] .gitignore includes .env, .env.local, .env.*
- [ ] Git history clean (no committed secrets)
- [ ] Different secrets for dev/staging/prod
- [ ] Debug panel disabled (NEXT_PUBLIC_ENABLE_DEBUG=false)
- [ ] Using fresh wallets (never used elsewhere)
- [ ] Hardware wallet or managed secrets for prod

---

## 🔍 Example: Generate New Secrets

### Generate New Relay Wallet
```bash
# Using cast (Foundry)
cast wallet new

# Save to .env file manually (never in git!)
echo "RELAYER_PRIVATE_KEY=0x..." >> orderbook/.env
```

### Get New API Keys
- Alchemy: https://dashboard.alchemy.com/
- WalletConnect: https://cloud.walletconnect.com/
- Axiom: https://axiom.xyz/

---

**Remember: Secrets in .env files only. Never in git!**

