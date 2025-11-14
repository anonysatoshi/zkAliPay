-- ============================================================================
-- zkAlipay Orderbook Database Schema
-- Version: 3.0 (Multi-Token Support + Rebrand)
-- Date: 2025-11-12
-- Purpose: Complete database schema for zkAlipay escrow with multi-token support
-- ============================================================================

-- ============================================================================
-- ORDERS TABLE - Exact match with Order struct in ZkAliPayEscrow.sol
-- ============================================================================
-- On-chain struct Order:
--   bytes32 orderId;
--   address seller;
--   address token;           // ✅ Multi-token support
--   uint256 totalAmount;
--   uint256 remainingAmount;
--   uint256 exchangeRate;    // CNY cents per token unit
--   string alipayId;
--   string alipayName;
--   uint256 createdAt;
--
-- NOTE: Orders never expire - they remain active until seller withdraws all funds.
--       Order "status" is implicit: active if remainingAmount > 0, otherwise inactive.

CREATE TABLE IF NOT EXISTS orders (
    -- On-chain fields (EXACT match)
    "orderId" VARCHAR(66) PRIMARY KEY,                    -- bytes32 as hex string with 0x prefix
    "seller" VARCHAR(42) NOT NULL,                        -- address
    "token" VARCHAR(42) NOT NULL,                         -- address (USDC, USDT, DAI, WETH, etc.)
    "totalAmount" NUMERIC(78,0) NOT NULL,                 -- uint256 (up to 2^256-1)
    "remainingAmount" NUMERIC(78,0) NOT NULL,             -- uint256 (determines if order is still active)
    "exchangeRate" NUMERIC(78,0) NOT NULL,                -- uint256 (CNY cents per token unit, adjusted for decimals)
    "alipayId" TEXT NOT NULL,                             -- string
    "alipayName" TEXT NOT NULL,                           -- string
    "createdAt" BIGINT NOT NULL,                          -- uint256 (unix timestamp)
    
    -- Additional fields for convenience (NOT on-chain)
    "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT "orders_remainingAmount_lte_totalAmount" CHECK ("remainingAmount" <= "totalAmount")
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS "idx_orders_seller" ON orders("seller");
CREATE INDEX IF NOT EXISTS "idx_orders_token" ON orders("token");
CREATE INDEX IF NOT EXISTS "idx_orders_remainingAmount" ON orders("remainingAmount");
CREATE INDEX IF NOT EXISTS "idx_orders_createdAt" ON orders("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_token_remainingAmount" ON orders("token", "remainingAmount");

-- ============================================================================
-- TRADES TABLE - Exact match with Trade struct in ZkAliPayEscrow.sol
-- ============================================================================
-- On-chain struct Trade:
--   bytes32 tradeId;
--   bytes32 orderId;         // References order (contains token info)
--   address buyer;
--   uint256 tokenAmount;
--   uint256 cnyAmount;
--   string paymentNonce;
--   uint256 createdAt;
--   uint256 expiresAt;
--   TradeStatus status;

CREATE TABLE IF NOT EXISTS trades (
    -- On-chain fields (EXACT match)
    "tradeId" VARCHAR(66) PRIMARY KEY,                    -- bytes32 as hex string with 0x prefix
    "orderId" VARCHAR(66) NOT NULL,                       -- bytes32 (references orders.orderId)
    "buyer" VARCHAR(42) NOT NULL,                         -- address
    "tokenAmount" NUMERIC(78,0) NOT NULL,                 -- uint256
    "cnyAmount" NUMERIC(78,0) NOT NULL,                   -- uint256 (CNY in cents)
    "paymentNonce" TEXT NOT NULL UNIQUE,                  -- string
    "createdAt" BIGINT NOT NULL,                          -- uint256 (unix timestamp)
    "expiresAt" BIGINT NOT NULL,                          -- uint256 (unix timestamp)
    "status" INTEGER NOT NULL,                            -- TradeStatus enum (0=PENDING, 1=SETTLED, 2=EXPIRED)
    
    -- Additional fields for convenience (NOT on-chain)
    "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "escrowTxHash" VARCHAR(66),                           -- Transaction hash when trade created
    "settlementTxHash" VARCHAR(66),                       -- Transaction hash when settled
    
    -- PDF storage
    "pdf_file" BYTEA,                                     -- Binary data of uploaded Alipay payment PDF
    "pdf_filename" TEXT,                                  -- Original filename of uploaded PDF
    "pdf_uploaded_at" TIMESTAMPTZ,                        -- Timestamp when PDF was uploaded
    
    -- Axiom proof storage
    "proof_user_public_values" BYTEA,                  -- User public values (32 bytes)
    "proof_accumulator" BYTEA,                         -- Halo2 accumulator (384 bytes)
    "proof_data" BYTEA,                                -- Halo2 proof data (1376 bytes)
    "axiom_proof_id" VARCHAR(100),                     -- Axiom API proof ID
    "proof_generated_at" TIMESTAMPTZ,                  -- Timestamp when proof generated
    "proof_json" TEXT,                                 -- Full proof JSON from Axiom API
    
    -- Foreign key
    FOREIGN KEY ("orderId") REFERENCES orders("orderId") ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT "trades_status_valid" CHECK ("status" IN (0, 1, 2))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS "idx_trades_orderId" ON trades("orderId");
CREATE INDEX IF NOT EXISTS "idx_trades_buyer" ON trades("buyer");
CREATE INDEX IF NOT EXISTS "idx_trades_status" ON trades("status");
CREATE INDEX IF NOT EXISTS "idx_trades_paymentNonce" ON trades("paymentNonce");
CREATE INDEX IF NOT EXISTS "idx_trades_createdAt" ON trades("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_trades_status_createdAt" ON trades("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_trades_pdf_uploaded" ON trades("pdf_uploaded_at") WHERE "pdf_file" IS NOT NULL;

-- ============================================================================
-- EVENT SYNC STATE TABLE - Track blockchain event sync progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_sync_state (
    contract_address VARCHAR(42) PRIMARY KEY,  -- Contract address (0x-prefixed, lowercase)
    last_synced_block BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE orders IS 'Mirror of on-chain Order struct from ZkAliPayEscrow.sol - Multi-token support';
COMMENT ON TABLE trades IS 'Mirror of on-chain Trade struct from ZkAliPayEscrow.sol';
COMMENT ON TABLE event_sync_state IS 'Tracks last synced blockchain block for event listener';

COMMENT ON COLUMN orders."orderId" IS 'Unique order identifier (bytes32)';
COMMENT ON COLUMN orders."token" IS 'ERC20 token address (USDC, USDT, DAI, WETH, etc.)';
COMMENT ON COLUMN orders."exchangeRate" IS 'CNY cents per token unit (e.g., 735 = 7.35 CNY/USDC)';
COMMENT ON COLUMN orders."remainingAmount" IS 'Remaining tokens - order is active if > 0, inactive if = 0';

COMMENT ON COLUMN trades."tradeId" IS 'Unique trade identifier (bytes32)';
COMMENT ON COLUMN trades."orderId" IS 'References order (token info derived from order)';
COMMENT ON COLUMN trades."status" IS 'TradeStatus: 0=PENDING, 1=SETTLED, 2=EXPIRED';
COMMENT ON COLUMN trades."paymentNonce" IS 'Unique nonce for Alipay payment verification';
COMMENT ON COLUMN trades."pdf_file" IS 'Binary data of the uploaded Alipay payment PDF';
COMMENT ON COLUMN trades."pdf_filename" IS 'Original filename of the uploaded PDF';
COMMENT ON COLUMN trades."pdf_uploaded_at" IS 'Timestamp when the PDF was uploaded';

