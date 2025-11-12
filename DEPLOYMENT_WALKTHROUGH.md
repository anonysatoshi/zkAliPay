# 🚀 zkAliPay Deployment Walkthrough - Base Sepolia Beta

**Network:** Base Sepolia Testnet  
**Status:** Beta Release  
**Goal:** Anonymous, secure deployment

---

## ⚠️ BEFORE YOU START

### 1. Enable VPN (CRITICAL for anonymity)
```bash
# Use Mullvad VPN or similar
# Connect to a VPN location you'll use consistently
# Enable kill switch to prevent IP leaks
```

### 2. Create Anonymous Accounts (use VPN + burner email)
- [ ] GitHub account (new, anonymous)
- [ ] Vercel account (for frontend)
- [ ] Railway account (for backend + database)
- [ ] Cloudflare account (optional, for custom domain)

### 3. Generate Fresh Wallets (NEVER used before)
```bash
# Create new relay wallet for production
cast wallet new

# Save the output:
# Address: 0x...
# Private Key: 0x...

# Fund with ~0.01 ETH on Base Sepolia
# Get from: https://www.alchemy.com/faucets/base-sepolia
```

---

## 📝 PRE-DEPLOYMENT CHECKLIST

- [ ] VPN enabled and kill switch on
- [ ] Anonymous GitHub account created
- [ ] Fresh relay wallet generated and funded
- [ ] All .env files configured (NOT committed to git)
- [ ] Git identity set to anonymous
- [ ] NEXT_PUBLIC_ENABLE_DEBUG removed or set to false
- [ ] Tested locally and everything works

---

## STEP 1: Push to Anonymous GitHub

### 1.1 Create GitHub Repository
```bash
# On GitHub (while connected to VPN):
# 1. Go to https://github.com/new
# 2. Repository name: "zkalipay" or "anon-pay"
# 3. Make it PUBLIC (for credibility) or PRIVATE (for extra privacy)
# 4. DO NOT initialize with README
# 5. Click "Create repository"
```

### 1.2 Push Your Code
```bash
cd /Users/yinuo/Desktop/zkAliPay

# Verify git identity is anonymous
git config user.name   # Should be "Anonymous" or similar
git config user.email  # Should be anonymous email

# Add remote (use HTTPS, not SSH for anonymity)
git remote add origin https://github.com/YOUR_ANONYMOUS_USERNAME/zkalipay.git

# Push
git branch -M main
git push -u origin main

# Verify no secrets were pushed
# Check the GitHub repo - should see no .env files
```

### 1.3 Add Repository Description
```
On GitHub repo page, add description:
"Peer-to-peer CNY ↔ Crypto exchange powered by zkVM. Beta on Base Sepolia."
```

✅ **Checkpoint:** Your code is now on GitHub anonymously

---

## STEP 2: Deploy Database (Railway PostgreSQL)

### 2.1 Sign Up for Railway
```
1. Go to https://railway.app (with VPN on)
2. Sign up with burner email OR connect anonymous GitHub
3. Verify email
```

### 2.2 Create New Project
```
1. Click "New Project"
2. Select "Provision PostgreSQL"
3. Database will be created automatically
```

### 2.3 Get Database Credentials
```
1. Click on the PostgreSQL service
2. Go to "Variables" tab
3. Copy these values:
   - PGHOST
   - PGPORT
   - PGUSER
   - PGPASSWORD
   - PGDATABASE
   - DATABASE_URL (full connection string)
```

### 2.4 Apply Database Schema
```bash
# On your local machine (with VPN)
cd /Users/yinuo/Desktop/zkAliPay/orderbook

# Set the Railway database URL
export DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DATABASE"
# (use the DATABASE_URL from Railway)

# Run migrations
sqlx migrate run --database-url "$DATABASE_URL"

# Verify tables were created
# On Railway dashboard, click "Data" tab
# Should see: orders, trades, event_sync_state tables
```

### 2.5 Initialize Event Sync State
```bash
# Get current Base Sepolia block
CURRENT_BLOCK=$(cast block-number --rpc-url https://sepolia.base.org)
echo "Current block: $CURRENT_BLOCK"

# Connect to Railway database and initialize
# (Railway provides a psql command in the "Data" tab - use that)
# Or use this:
psql "$DATABASE_URL" -c "
INSERT INTO event_sync_state (contract_address, last_synced_block, last_synced_at) 
VALUES ('0xe03c7b74a7c4338e397c65d8b60b18faf56e3546', $CURRENT_BLOCK, NOW()) 
ON CONFLICT (contract_address) 
DO UPDATE SET last_synced_block = $CURRENT_BLOCK, last_synced_at = NOW();
"
```

✅ **Checkpoint:** Database is ready with schema and initialized

---

## STEP 3: Deploy Backend (Railway)

### 3.1 Create New Service for API
```
On Railway:
1. Click "New" → "GitHub Repo"
2. Select your zkAliPay repository
3. Railway will detect it's a Rust project
4. Click "Deploy"
```

### 3.2 Configure Build Settings
```
On Railway project:
1. Click on the service
2. Go to "Settings" tab
3. Under "Build":
   - Root Directory: /orderbook
   - Build Command: cargo build --release --bin api-server
   - Start Command: ./target/release/api-server
```

### 3.3 Add Environment Variables
```
Go to "Variables" tab, add these:

DATABASE_URL=${{Postgres.DATABASE_URL}}  
# (Railway auto-links if you provisioned PostgreSQL in same project)

SEPOLIA_RPC_URL=https://sepolia.base.org

ESCROW_CONTRACT_ADDRESS=0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546

MOCK_USDC_ADDRESS=0xd4B280FFB336e2061cB39347Bd599cB88FF1617A

RELAYER_PRIVATE_KEY=0xYOUR_FRESH_WALLET_PRIVATE_KEY
# ⚠️ Use the NEW wallet you generated, NOT the test one

CHAIN_ID=84532

RUST_LOG=info

PORT=3000
```

### 3.4 Deploy
```
1. Click "Deploy" or push to GitHub (auto-deploys)
2. Wait for build to complete (~5-10 minutes for first build)
3. Check logs for "Server started successfully!"
4. Note the public URL: https://YOUR-SERVICE.up.railway.app
```

### 3.5 Test API
```bash
# Test health endpoint
curl https://YOUR-SERVICE.up.railway.app/health

# Should return:
# {"status":"ok"}
```

✅ **Checkpoint:** Backend API is live and connected to database

---

## STEP 4: Deploy Auto-Cancel Service (Railway)

### 4.1 Create Second Service
```
On Railway (same project):
1. Click "New" → "GitHub Repo"
2. Select your zkAliPay repository again
3. Railway will create a second service
```

### 4.2 Configure Build Settings
```
On the new service:
1. Go to "Settings" tab
2. Under "Build":
   - Root Directory: /orderbook
   - Build Command: cargo build --release --bin auto-cancel-service
   - Start Command: ./target/release/auto-cancel-service
```

### 4.3 Add Environment Variables
```
(Same as API server, copy from Step 3.3)

DATABASE_URL=${{Postgres.DATABASE_URL}}
SEPOLIA_RPC_URL=https://sepolia.base.org
ESCROW_CONTRACT_ADDRESS=0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546
MOCK_USDC_ADDRESS=0xd4B280FFB336e2061cB39347Bd599cB88FF1617A
RELAYER_PRIVATE_KEY=0xYOUR_FRESH_WALLET_PRIVATE_KEY
CHAIN_ID=84532
RUST_LOG=info
```

### 4.4 Deploy
```
1. Click "Deploy"
2. Wait for build
3. Check logs for "Auto-cancel service running"
```

✅ **Checkpoint:** Auto-cancel service is running

---

## STEP 5: Deploy Frontend (Vercel)

### 5.1 Sign Up for Vercel
```
1. Go to https://vercel.com (with VPN)
2. Sign up with anonymous GitHub account
3. Authorize Vercel to access your repository
```

### 5.2 Import Project
```
1. Click "Add New" → "Project"
2. Select your zkAliPay repository
3. Vercel auto-detects Next.js
4. Under "Configure Project":
   - Root Directory: /frontend
   - Framework Preset: Next.js (auto-detected)
   - Build Command: npm run build (default)
   - Output Directory: .next (default)
```

### 5.3 Add Environment Variables
```
On Vercel, add these:

NEXT_PUBLIC_API_URL=https://YOUR-API-SERVICE.up.railway.app
# (use the Railway API URL from Step 3.4)

NEXT_PUBLIC_CHAIN_ID=84532

NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

NEXT_PUBLIC_BLOCK_EXPLORER=https://sepolia.basescan.org

NEXT_PUBLIC_ESCROW_ADDRESS=0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546

NEXT_PUBLIC_USDC_ADDRESS=0xd4B280FFB336e2061cB39347Bd599cB88FF1617A

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
# Get from https://cloud.walletconnect.com

# DO NOT SET NEXT_PUBLIC_ENABLE_DEBUG (debug panel will be disabled)
```

### 5.4 Deploy
```
1. Click "Deploy"
2. Wait 2-3 minutes
3. Your site will be live at: https://YOUR-PROJECT.vercel.app
```

### 5.5 Test Frontend
```
1. Visit https://YOUR-PROJECT.vercel.app
2. Connect wallet (MetaMask on Base Sepolia)
3. Try viewing orders
4. Visit /debug → should redirect to home (protected!)
```

✅ **Checkpoint:** Frontend is live and connected to backend

---

## STEP 6: Custom Domain (Optional but Recommended)

### 6.1 Buy Anonymous Domain
```
Option A: Namecheap + WHOIS Privacy
1. Go to https://namecheap.com (with VPN)
2. Search for domain (e.g., zkalipay.io)
3. Enable WHOIS privacy (free)
4. Pay with Bitcoin if possible

Option B: Njalla (Most Anonymous)
1. Go to https://njal.la (with VPN)
2. Search for domain
3. Pay with Bitcoin/Monero
4. They own the domain (you rent it) - maximum anonymity
```

### 6.2 Configure Domain for Frontend
```
On Vercel:
1. Go to your project settings
2. Click "Domains"
3. Add your custom domain
4. Follow instructions to add DNS records

On your domain provider (Namecheap/Njalla):
1. Add CNAME record:
   - Name: @ (or www)
   - Value: cname.vercel-dns.com
   - TTL: Automatic
2. Wait 5-60 minutes for propagation
```

### 6.3 Configure Domain for Backend (Optional)
```
On Railway:
1. Go to your API service settings
2. Click "Networking" → "Custom Domain"
3. Add: api.yourdomain.com
4. Add CNAME record on your domain:
   - Name: api
   - Value: [Railway provides this]
```

### 6.4 Update Frontend Environment
```
On Vercel, update:
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
# (or keep the Railway URL if not using custom domain)

Redeploy frontend
```

✅ **Checkpoint:** Custom domain is working

---

## STEP 7: Enable CORS (Backend)

Your backend needs to allow requests from your frontend domain.

### 7.1 Update Backend Code (if needed)
```rust
// This should already be in your code
// orderbook/src/api/mod.rs or main.rs

let cors = CorsLayer::new()
    .allow_origin([
        "http://localhost:3002".parse().unwrap(),
        "https://YOUR-PROJECT.vercel.app".parse().unwrap(),
        "https://yourdomain.com".parse().unwrap(), // if using custom domain
    ])
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers([CONTENT_TYPE, AUTHORIZATION]);
```

### 7.2 Redeploy Backend
```bash
# Push changes to GitHub
git add -A
git commit -m "chore: update CORS for production domain"
git push

# Railway will auto-redeploy
```

---

## STEP 8: Final Testing

### 8.1 Test Complete Flow
```
1. Visit your site: https://yourdomain.com
2. Connect wallet (MetaMask on Base Sepolia)
3. Get test USDC:
   https://sepolia.basescan.org/address/0xd4B280FFB336e2061cB39347Bd599cB88FF1617A#writeContract
   (Call "mint" function)

4. Create sell order:
   - Go to /sell
   - Enter amount, rate, Alipay details
   - Approve USDC
   - Create order
   - Wait 10-20 seconds
   - Check "My Orders" - should appear

5. Test buy flow (use different wallet):
   - Go to /buy
   - Enter desired amount
   - Review match
   - Execute (relayer pays gas)
   - Follow payment instructions

6. Test withdrawal:
   - Go to /sell → My Orders
   - Click "Withdraw"
   - Confirm transaction
   - Balance should update

7. Verify /debug is protected:
   - Visit /debug
   - Should redirect to home
```

### 8.2 Monitor Logs
```
Railway:
- Check API server logs (should see event sync logs)
- Check auto-cancel logs (should check every 60 seconds)

Vercel:
- Check function logs for any errors
```

### 8.3 Check Database
```
On Railway PostgreSQL:
1. Go to "Data" tab
2. Run queries:
   SELECT * FROM orders LIMIT 10;
   SELECT * FROM trades LIMIT 10;
   SELECT * FROM event_sync_state;
```

✅ **Checkpoint:** Everything is working end-to-end!

---

## STEP 9: Security Hardening

### 9.1 Enable Rate Limiting
```rust
// Add to your backend (already might be there)
// orderbook/src/api/mod.rs

use tower::limit::RateLimitLayer;

let rate_limit = RateLimitLayer::new(
    100, // requests
    Duration::from_secs(60) // per minute
);
```

### 9.2 Enable HTTPS Only
```
On Vercel: Automatic (forced HTTPS)
On Railway: Automatic (forced HTTPS)
```

### 9.3 Add Security Headers
```typescript
// frontend/next.config.mjs
export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};
```

### 9.4 Monitor Wallet Balance
```bash
# Check relay wallet has enough gas
cast balance 0xYOUR_RELAY_WALLET --rpc-url https://sepolia.base.org

# Should have at least 0.001 ETH
# Get more from: https://www.alchemy.com/faucets/base-sepolia
```

---

## STEP 10: Go Live Announcement

### 10.1 Create Announcement
```
Example tweet (from anonymous account):

"🚀 Introducing zkAliPay - P2P CNY ↔ Crypto exchange

✅ Trade USDC/BTC/ETH/SOL for CNY
✅ zkPDF proofs (Alipay receipts)
✅ Non-custodial escrow
✅ Beta on Base Sepolia

Try it: https://yourdomain.com

Built with @base @OpenVM_Official"
```

### 10.2 Share in Communities
```
- Crypto Twitter (anonymous account)
- Reddit: r/cryptocurrency, r/base
- Discord: Base, DeFi communities
- Telegram: Crypto groups
```

### 10.3 Create Simple Landing Page (Optional)
```
Add to your homepage:
- What is zkAliPay?
- How it works (3 steps)
- Security features
- Beta disclaimer
- Links to docs
```

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks
```bash
# Check relay wallet balance
cast balance 0xYOUR_WALLET --rpc-url https://sepolia.base.org

# Check if services are up
curl https://YOUR-API.railway.app/health

# Check logs for errors
# Railway → Deployments → Logs
# Vercel → Deployments → Functions
```

### Weekly Tasks
```
- Review transaction volume
- Check for failed trades
- Monitor database size
- Review error logs
- Check for security issues
```

### If Something Breaks
```
1. Check Railway/Vercel status pages
2. Check logs for errors
3. Verify environment variables
4. Check relay wallet has funds
5. Verify RPC endpoint is working
6. Check database connection
```

---

## 🎉 DEPLOYMENT COMPLETE!

Your zkAliPay is now live on:
- **Frontend**: https://yourdomain.com (or .vercel.app)
- **Backend**: https://YOUR-API.railway.app
- **Network**: Base Sepolia Testnet
- **Contract**: 0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546

**Status**: ✅ Anonymous, ✅ Secure, ✅ Live

---

## 📞 TROUBLESHOOTING

### Frontend can't connect to backend
```
- Check NEXT_PUBLIC_API_URL is correct
- Check CORS settings on backend
- Check backend is running (curl health endpoint)
```

### Orders not appearing in UI
```
- Check event listener logs (Railway)
- Verify event_sync_state is updating
- Check database has data
- Frontend auto-refreshes every 10s
```

### Trades not executing
```
- Check relay wallet has ETH for gas
- Check RELAYER_PRIVATE_KEY is correct
- Check ESCROW_CONTRACT_ADDRESS matches
- Check CHAIN_ID is 84532
```

### Debug panel accessible in production
```
- Verify NEXT_PUBLIC_ENABLE_DEBUG is not set
- Redeploy frontend
- Clear browser cache
```

---

**Last Updated**: November 12, 2025  
**Network**: Base Sepolia Testnet  
**Version**: Beta 1.0

**🕶️ Stay anonymous. Use VPN always.**

