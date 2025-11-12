# 🚀 zkAliPay - Quick Start Guide

Complete guide to start the zkAliPay application with database, event listener, and frontend.

---

## 📋 Prerequisites

- Docker & Docker Compose installed
- Node.js 18+ installed
- Rust toolchain installed
- PostgreSQL client tools (psql, sqlx-cli)
- **WalletConnect Cloud Project ID** (required for frontend)

---

## 🔗 WalletConnect Setup (Required)

The frontend uses RainbowKit which requires a WalletConnect Cloud project ID.

### Get Your Project ID:

1. Go to https://cloud.walletconnect.com
2. Sign up or log in
3. Create a new project
4. Copy your Project ID
5. Update `deployment.config.json`:
   ```json
   "walletConnect": {
     "projectId": "YOUR_PROJECT_ID_HERE"
   }
   ```
6. Regenerate environment files:
   ```bash
   cd /path/to/zkAliPay
   node scripts/generate-env.js base-sepolia
   ```

**Note:** The dummy project ID in the config won't work. You must use a real WalletConnect project ID.

---

## 🗄️ Database Configuration

The PostgreSQL database is configured in `orderbook/docker-compose.yml` with the following credentials:

```
Database Name: zkalipay_orderbook
Username:      zkalipay
Password:      zkalipay_dev_password
Host:          localhost
Port:          5432
```

**⚠️ IMPORTANT:** The `DATABASE_URL` must use these exact credentials:

```bash
export DATABASE_URL="postgresql://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook"
```

**Common Mistakes:**
- ❌ Using `zkalipay` as database name (wrong - it's `zkalipay_orderbook`)
- ❌ Using `zkalipay_password` as password (wrong - it's `zkalipay_dev_password`)
- ❌ Forgetting to export `DATABASE_URL` before running commands

---

## 🔑 Relay Wallet Configuration

The application uses a **relay wallet** to execute blockchain transactions on behalf of users, so buyers don't need ETH for gas fees.

### Test Relay Wallet (Base Sepolia Testnet Only)

```
Address: 0x5B9719f72b654fb07Fd95eae61087B261E4e01fe
Private Key: 62fe1a033a8b98f006ac1895572967d6319944fd0a2eac34f3f746418a4106e0
```

⚠️ **IMPORTANT:** This wallet is for **TESTING ONLY** on Base Sepolia testnet. Never use this wallet on mainnet!

### What the Relay Wallet Does:

- **Executes `fillOrder()`** when buyers match with sellers (no gas cost to buyer)
- **Submits `submitPaymentProof()`** after buyers send Alipay payment (no gas cost to buyer)
- **Cancels expired trades** via `cancelExpiredTrade()` (auto-cancel service)

### Configuration:

The relay wallet is configured via the `RELAYER_PRIVATE_KEY` environment variable. Make sure this wallet has sufficient ETH on Base Sepolia for gas fees (~0.001 ETH recommended - much cheaper than Ethereum mainnet).

### Payment Window:

- **Current Setting:** 90 seconds (1.5 minutes)
- Buyers must submit payment proof within 90 seconds after trade creation
- After expiration, trades can be cancelled and funds returned to order pool
- Can be updated via smart contract's `updateConfig()` admin function

---

## 🎯 Quick Start (4 Steps)

### Step 1: Start Database & Event Listener

```bash
cd /path/to/zkAliPay/orderbook

# Start PostgreSQL container
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 3

# Verify database exists and run migrations
export DATABASE_URL="postgresql://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook"
sqlx migrate run --database-url "$DATABASE_URL"

# Get current Base Sepolia block number
CURRENT_BLOCK=$(cast block-number --rpc-url https://sepolia.base.org)
echo "Current Base Sepolia block: $CURRENT_BLOCK"

# Update event sync state to start from current block
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "INSERT INTO event_sync_state (contract_address, last_synced_block, last_synced_at) 
   VALUES ('0xe03c7b74a7c4338e397c65d8b60b18faf56e3546', $CURRENT_BLOCK, NOW()) 
   ON CONFLICT (contract_address) 
   DO UPDATE SET last_synced_block = $CURRENT_BLOCK, last_synced_at = NOW();"

# Start API server with event listener
export RUST_LOG=info
export DATABASE_URL="postgresql://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook"
export SEPOLIA_RPC_URL="https://sepolia.base.org"
export ESCROW_CONTRACT_ADDRESS="0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546"
export MOCK_USDC_ADDRESS="0xd4B280FFB336e2061cB39347Bd599cB88FF1617A"
export RELAYER_PRIVATE_KEY="0x62fe1a033a8b98f006ac1895572967d6319944fd0a2eac34f3f746418a4106e0"
export CHAIN_ID=84532

./target/release/api-server > /tmp/zkalipay_api.log 2>&1 &

# Wait for API to start
sleep 5

# Verify API is running
curl -s http://localhost:3000/health | jq .

echo "✅ Database and Event Listener started!"
```

### Step 2: Start Auto-Cancel Service

```bash
cd /path/to/zkAliPay/orderbook

# Use same environment variables as API server
export RUST_LOG=info
export DATABASE_URL="postgresql://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook"
export SEPOLIA_RPC_URL="https://sepolia.base.org"
export ESCROW_CONTRACT_ADDRESS="0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546"
export MOCK_USDC_ADDRESS="0xd4B280FFB336e2061cB39347Bd599cB88FF1617A"
export RELAYER_PRIVATE_KEY="0x62fe1a033a8b98f006ac1895572967d6319944fd0a2eac34f3f746418a4106e0"
export CHAIN_ID=84532

./target/release/auto-cancel-service > /tmp/zkalipay_autocancel.log 2>&1 &

# Wait for service to start
sleep 3

echo "✅ Auto-Cancel Service started!"
```

### Step 3: Start Frontend

```bash
cd /path/to/zkAliPay/frontend

# Start Next.js development server
PORT=3002 npm run dev > /tmp/zkalipay_frontend.log 2>&1 &

# Wait for frontend to start
sleep 8

echo "✅ Frontend started on http://localhost:3002"
```

### Step 4: Verify Everything is Running

```bash
echo "=== Service Status ==="
echo ""
echo "1. PostgreSQL:"
docker ps | grep zkalipay-postgres
echo ""
echo "2. API Server:"
ps aux | grep api-server | grep -v grep
echo ""
echo "3. Auto-Cancel Service:"
ps aux | grep auto-cancel-service | grep -v grep
echo ""
echo "4. Frontend:"
ps aux | grep "npm run dev" | grep -v grep | head -1
echo ""
echo "5. Health Check:"
curl -s http://localhost:3000/health
echo ""
echo ""
echo "✅ All services running!"
echo ""
echo "🌐 Access Points:"
echo "  - Frontend:        http://localhost:3002"
echo "  - Seller Dashboard: http://localhost:3002/sell"
echo "  - Debug Panel:     http://localhost:3002/debug"
echo "  - API Health:      http://localhost:3000/health"
```

---

## 📊 Monitoring

### Watch API Logs (Event Listener)
```bash
tail -f /tmp/zkalipay_api.log
```

### Watch Auto-Cancel Service Logs
```bash
tail -f /tmp/zkalipay_autocancel.log
```

### Watch Frontend Logs
```bash
tail -f /tmp/zkalipay_frontend.log
```

### Check Database State
```bash
docker exec -it zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook

# Inside psql:
SELECT * FROM orders ORDER BY "createdAt" DESC LIMIT 5;
SELECT * FROM trades ORDER BY "createdAt" DESC LIMIT 5;
SELECT * FROM event_sync_state;
\q
```

### Check Event Sync Status
```bash
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "SELECT contract_address, last_synced_block, last_synced_at FROM event_sync_state;"
```

---

## 🛑 Stopping Services

```bash
# Stop all processes
pkill -f api-server
pkill -f auto-cancel-service
pkill -f "npm run dev"

# Stop PostgreSQL (optional - keeps data)
cd /path/to/zkAliPay/orderbook
docker-compose down

# Or just stop without removing container
docker-compose stop postgres
```

---

## 🔧 Troubleshooting

### Database Authentication Failed

If you see `password authentication failed for user "zkalipay"`:

```bash
# 1. Check the database container environment
docker inspect zkalipay-postgres | grep -A 5 "Env"

# You should see:
# POSTGRES_DB=zkp2p_orderbook
# POSTGRES_USER=zkp2p
# POSTGRES_PASSWORD=zkp2p_dev_password

# 2. Verify you're using the correct DATABASE_URL
echo $DATABASE_URL
# Should be: postgresql://zkp2p:zkp2p_dev_password@localhost:5432/zkp2p_orderbook

# 3. If wrong, export the correct one
export DATABASE_URL="postgresql://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook"

# 4. Restart the API server
pkill -f api-server
cd /path/to/zkAliPay/orderbook
# ... (re-run Step 1 start command with correct DATABASE_URL)
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep zkalipay-postgres

# Check PostgreSQL logs
docker logs zkp2p-postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Event Listener Not Syncing
```bash
# Check current block
cast block-number --rpc-url https://sepolia.base.org

# Check last synced block
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "SELECT contract_address, last_synced_block FROM event_sync_state;"

# If far behind, update to current block
CURRENT_BLOCK=$(cast block-number --rpc-url https://sepolia.base.org)
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "UPDATE event_sync_state SET last_synced_block = $CURRENT_BLOCK, last_synced_at = NOW() 
   WHERE contract_address = '0xe03c7b74a7c4338e397c65d8b60b18faf56e3546';"

# Restart API server
pkill -f api-server
cd /path/to/zkAliPay/orderbook
# ... (re-run Step 1 start command)
```

### Frontend Not Loading
```bash
# Check if port 3002 is in use
lsof -ti:3002

# Kill process on port 3002
lsof -ti:3002 | xargs kill -9

# Restart frontend
cd /path/to/zkAliPay/frontend
PORT=3002 npm run dev
```

### API Server Won't Start
```bash
# Check logs
tail -50 /tmp/zkp2p_api.log

# Common issues:
# 1. Database password wrong - check docker-compose.yml
# 2. Port 3000 in use - kill process: lsof -ti:3000 | xargs kill -9
# 3. Missing env vars - check all exports in Step 1
```

### PDF Upload Fails with "OpenVM binary not found"
If you moved or renamed the project directory, the compiled binaries have the old path hardcoded. You need to force a clean rebuild:

```bash
# Clean and rebuild binaries with correct path
cd /path/to/zkAliPay/orderbook
cargo clean
cargo build --release --bins

# Restart services
pkill -f api-server && pkill -f auto-cancel-service
# Then run Step 1 and Step 2 again to restart with new binaries
```

---

## 🧪 Testing the Application

### Test Order Creation
1. Go to http://localhost:3002/sell
2. Click "Create Order" tab
3. Enter amount (e.g., 100 USDC)
4. Enter exchange rate (e.g., 730 for 7.30 CNY/USDC)
5. Enter Alipay ID and Name
6. Click "Create Order"
7. Approve USDC in MetaMask
8. Confirm order creation in MetaMask
9. Wait for confirmation (~10-20 seconds)
10. Check "My Orders" tab - order should appear

### Test Withdrawal
1. Go to http://localhost:3002/sell → "My Orders" tab
2. Find an order with remaining balance
3. Enter withdrawal amount
4. Click "Withdraw"
5. Confirm in MetaMask
6. Watch logs: `tail -f /tmp/zkalipay_api.log`
7. You should see "OrderPartiallyWithdrawn" event
8. UI auto-refreshes in ~10 seconds
9. Remaining amount should decrease

### Test Event Synchronization
```bash
# In one terminal, watch the logs
tail -f /tmp/zkalipay_api.log

# In another terminal, check database before withdrawal
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "SELECT \"orderId\", \"remainingAmount\" FROM orders WHERE \"remainingAmount\" > 0;"

# Perform withdrawal in UI

# Check database after (wait 10-20 seconds)
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "SELECT \"orderId\", \"remainingAmount\" FROM orders WHERE \"remainingAmount\" > 0;"

# Should see decreased remaining amount
```

---

## 📁 Important Files & Directories

```
zkAliPay/
├── orderbook/                      # Backend (Rust)
│   ├── src/
│   │   ├── bin/api-server.rs      # Main API server
│   │   ├── blockchain/events.rs   # Event listener
│   │   ├── db/                    # Database layer
│   │   └── api/                   # API handlers
│   ├── target/release/api-server  # Compiled binary
│   ├── docker-compose.yml         # PostgreSQL setup
│   └── migrations/                # Database migrations
│
├── frontend/                       # Frontend (Next.js)
│   ├── src/
│   │   ├── app/                   # Pages
│   │   ├── components/            # React components
│   │   ├── hooks/                 # Custom hooks
│   │   └── lib/                   # Utilities
│   └── package.json
│
├── contracts/                      # Smart contracts (Solidity)
│   ├── src/ZkP2PEscrowV2.sol     # Main escrow contract
│   └── out/                       # Compiled contracts
│
└── START_GUIDE.md                 # This file
```

---

## 🔐 Environment Variables

### Required for API Server:
- `DATABASE_URL`: PostgreSQL connection string
- `SEPOLIA_RPC_URL`: Base Sepolia RPC endpoint (https://sepolia.base.org)
- `ESCROW_CONTRACT_ADDRESS`: Deployed escrow contract (0xe03C7b74A7c4338E397c65d8B60b18FAF56E3546)
- `MOCK_USDC_ADDRESS`: USDC token address (0xd4B280FFB336e2061cB39347Bd599cB88FF1617A)
- `RELAYER_PRIVATE_KEY`: Private key for relayer wallet
- `CHAIN_ID`: Network chain ID (84532 for Base Sepolia)
- `RUST_LOG`: Log level (info/debug/trace)

### Required for Frontend:
- `NEXT_PUBLIC_API_URL`: API server URL (default: http://localhost:3000)
- `NEXT_PUBLIC_ESCROW_ADDRESS`: Escrow contract address
- `NEXT_PUBLIC_USDC_ADDRESS`: USDC token address

---

## 📝 Notes

- **Event Listener**: Starts from current block to avoid long catch-up times
- **Auto-Refresh**: Frontend auto-refreshes data every 10 seconds
- **Database**: PostgreSQL data persists in Docker volume
- **Logs**: Stored in `/tmp/zkp2p_api.log` and `/tmp/zkp2p_frontend.log`
- **Network**: Base Sepolia testnet (Chain ID: 84532)
- **RPC**: Public Base Sepolia endpoint (https://sepolia.base.org)
- **Block Explorer**: https://sepolia.basescan.org

---

## 🎯 Common Workflows

### Daily Development Start
```bash
# Quick start (if database already exists)
cd /path/to/zkAliPay/orderbook
docker-compose start postgres
./target/release/api-server > /tmp/zkalipay_api.log 2>&1 &
cd /path/to/zkAliPay/frontend
PORT=3002 npm run dev > /tmp/zkalipay_frontend.log 2>&1 &
```

### Fresh Start (Clean Database)
```bash
# Stop everything
pkill -f api-server && pkill -f "npm run dev"
cd /path/to/zkAliPay/orderbook
docker-compose down -v

# Start fresh (follow Step 1-3 above)
```

### Update Event Listener to Current Block
```bash
CURRENT_BLOCK=$(cast block-number --rpc-url https://sepolia.base.org)
docker exec zkalipay-postgres psql -U zkalipay -d zkalipay_orderbook -c \
  "UPDATE event_sync_state SET last_synced_block = $CURRENT_BLOCK, last_synced_at = NOW() 
   WHERE contract_address = '0xe03c7b74a7c4338e397c65d8b60b18faf56e3546';"
pkill -f api-server
# Restart API server (Step 1)
```

---

## ✅ Success Indicators

You know everything is working when:

1. ✅ `curl http://localhost:3000/health` returns `{"status":"ok"}`
2. ✅ `http://localhost:3002` loads the homepage
3. ✅ API logs show: `🚀 Starting event listener...`
4. ✅ Creating an order appears in "My Orders" within 10-20 seconds
5. ✅ Withdrawing updates the remaining amount within 10-20 seconds
6. ✅ Debug panel shows current database state

---

**Last Updated**: November 12, 2025 (Base Sepolia Migration)  
**Version**: 4.0.0

