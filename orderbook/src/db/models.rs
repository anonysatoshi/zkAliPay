use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Database model for Order - EXACTLY matches on-chain Order struct
/// Plus convenience field: syncedAt
/// NOTE: Orders never expire - they remain active until seller withdraws all funds.
///       Order "status" is implicit: active if remainingAmount > 0, inactive if = 0.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DbOrder {
    // On-chain fields (EXACT match with ZkAliPayEscrow.sol Order struct)
    #[sqlx(rename = "orderId")]
    pub order_id: String,                   // bytes32 as 0x-prefixed hex string (66 chars)
    pub seller: String,                     // address (0x-prefixed, 42 chars)
    pub token: String,                      // address (0x-prefixed, 42 chars)
    #[sqlx(rename = "totalAmount")]
    pub total_amount: String,               // uint256 as decimal string
    #[sqlx(rename = "remainingAmount")]
    pub remaining_amount: String,           // uint256 as decimal string (determines if order is active)
    #[sqlx(rename = "exchangeRate")]
    pub exchange_rate: String,              // uint256 (CNY cents per token)
    #[sqlx(rename = "alipayId")]
    pub alipay_id: String,                  // string
    #[sqlx(rename = "alipayName")]
    pub alipay_name: String,                // string
    #[sqlx(rename = "createdAt")]
    pub created_at: i64,                    // uint256 (unix timestamp)
    
    // Additional fields for convenience (NOT on-chain)
    #[sqlx(rename = "syncedAt")]
    pub synced_at: DateTime<Utc>,           // When record was synced to DB
}

/// Database model for Trade - EXACTLY matches on-chain Trade struct
/// Plus convenience fields: syncedAt, escrowTxHash, settlementTxHash, PDF storage, Axiom proof data
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DbTrade {
    // On-chain fields (EXACT match with ZkAliPayEscrow.sol Trade struct)
    #[sqlx(rename = "tradeId")]
    pub trade_id: String,                   // bytes32 as 0x-prefixed hex string (66 chars)
    #[sqlx(rename = "orderId")]
    pub order_id: String,                   // bytes32 reference to order (66 chars)
    pub buyer: String,                      // address (0x-prefixed, 42 chars)
    #[sqlx(rename = "tokenAmount")]
    pub token_amount: String,               // uint256 as decimal string
    #[sqlx(rename = "cnyAmount")]
    pub cny_amount: String,                 // uint256 (CNY in cents)
    #[sqlx(rename = "paymentNonce")]
    pub payment_nonce: String,              // string (unique nonce)
    #[sqlx(rename = "createdAt")]
    pub created_at: i64,                    // uint256 (unix timestamp)
    #[sqlx(rename = "expiresAt")]
    pub expires_at: i64,                    // uint256 (unix timestamp)
    pub status: i32,                        // TradeStatus: 0=PENDING, 1=SETTLED, 2=EXPIRED
    
    // Additional fields for convenience (NOT on-chain)
    #[sqlx(rename = "syncedAt")]
    pub synced_at: DateTime<Utc>,           // When record was synced to DB
    #[sqlx(rename = "escrowTxHash")]
    pub escrow_tx_hash: Option<String>,     // Transaction hash when trade created
    #[sqlx(rename = "settlementTxHash")]
    pub settlement_tx_hash: Option<String>, // Transaction hash when settled
    
    // Token address (joined from orders table, not in trades table directly)
    #[sqlx(default)]
    pub token: Option<String>,              // Token address from order (0x-prefixed, 42 chars)
    
    // PDF storage fields
    #[serde(skip_serializing)]              // Don't send binary data in JSON
    #[sqlx(rename = "pdf_file")]
    pub pdf_file: Option<Vec<u8>>,          // Binary PDF data
    #[sqlx(rename = "pdf_filename")]
    pub pdf_filename: Option<String>,       // Original filename
    #[sqlx(rename = "pdf_uploaded_at")]
    pub pdf_uploaded_at: Option<DateTime<Utc>>, // When PDF was uploaded
    
    // Axiom EVM proof fields
    #[serde(skip_serializing)]              // Don't send binary data in JSON by default
    #[sqlx(rename = "proof_user_public_values")]
    pub proof_user_public_values: Option<Vec<u8>>, // 32 bytes
    #[serde(skip_serializing)]
    #[sqlx(rename = "proof_accumulator")]
    pub proof_accumulator: Option<Vec<u8>>,  // 384 bytes
    #[serde(skip_serializing)]
    #[sqlx(rename = "proof_data")]
    pub proof_data: Option<Vec<u8>>,         // 1376 bytes
    #[sqlx(rename = "axiom_proof_id")]
    pub axiom_proof_id: Option<String>,      // Axiom API proof ID
    #[sqlx(rename = "proof_generated_at")]
    pub proof_generated_at: Option<DateTime<Utc>>, // When proof was generated
    #[sqlx(rename = "proof_json")]
    pub proof_json: Option<String>,          // Full Axiom EVM proof JSON
}
