use async_trait::async_trait;
use sqlx::PgPool;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};

use super::{DbError, DbResult};
use super::models::DbTrade;

/// Repository for Trade operations - ONLY methods needed for event sync
#[async_trait]
pub trait TradeRepository: Send + Sync {
    /// Insert new trade from TradeCreated event
    async fn create(&self, trade: &DbTrade) -> DbResult<()>;
    
    /// Get trade by ID
    async fn get(&self, trade_id: &str) -> DbResult<DbTrade>;
    
    /// Update trade status from TradeSettled or TradeExpired events
    async fn update_status(&self, trade_id: &str, new_status: i32) -> DbResult<()>;
    
    /// Update proof hash from ProofSubmitted event (DEPRECATED)
    async fn update_proof_hash(&self, trade_id: &str, proof_hash: &str) -> DbResult<()>;
    
    /// Update settlement transaction hash from TradeSettled event
    async fn update_settlement_tx(&self, trade_id: &str, settlement_tx_hash: &str) -> DbResult<()>;
    
    /// Save PDF file for a trade
    async fn save_pdf(&self, trade_id: &str, pdf_data: &[u8], filename: &str) -> DbResult<DateTime<Utc>>;
    
    /// Save Axiom EVM proof data
    async fn save_proof(&self, trade_id: &str, user_public_values: &[u8], accumulator: &[u8], proof_data: &[u8], axiom_proof_id: &str, proof_json: &str) -> DbResult<()>;
}

pub struct PostgresTradeRepository {
    pool: PgPool,
}

impl PostgresTradeRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TradeRepository for PostgresTradeRepository {
    async fn create(&self, trade: &DbTrade) -> DbResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO trades (
                "tradeId", "orderId", "buyer", "tokenAmount", "cnyAmount",
                "paymentNonce", "createdAt", "expiresAt", "status",
                "escrowTxHash", "settlementTxHash"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT ("tradeId") DO NOTHING
            "#,
            trade.trade_id,
            trade.order_id,
            trade.buyer,
            Decimal::from_str(&trade.token_amount).unwrap(),
            Decimal::from_str(&trade.cny_amount).unwrap(),
            trade.payment_nonce,
            trade.created_at,
            trade.expires_at,
            trade.status,
            trade.escrow_tx_hash,
            trade.settlement_tx_hash
        )
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    async fn get(&self, trade_id: &str) -> DbResult<DbTrade> {
        let row = sqlx::query!(
            r#"
            SELECT 
                "tradeId", "orderId", "buyer", "tokenAmount"::text, "cnyAmount"::text,
                "paymentNonce", "createdAt", "expiresAt", "status",
                "escrowTxHash", "settlementTxHash", "syncedAt",
                pdf_file, pdf_filename, pdf_uploaded_at,
                proof_user_public_values, proof_accumulator, proof_data,
                axiom_proof_id, proof_generated_at, proof_json
            FROM trades
            WHERE "tradeId" = $1
            "#,
            trade_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| DbError::TradeNotFound(trade_id.to_string()))?;

        Ok(DbTrade {
            trade_id: row.tradeId,
            order_id: row.orderId,
            buyer: row.buyer,
            token_amount: row.tokenAmount.unwrap_or_default(),
            cny_amount: row.cnyAmount.unwrap_or_default(),
            payment_nonce: row.paymentNonce,
            created_at: row.createdAt,
            expires_at: row.expiresAt,
            status: row.status,
            escrow_tx_hash: row.escrowTxHash,
            settlement_tx_hash: row.settlementTxHash,
            synced_at: row.syncedAt,
            token: None, // Not available in single trade query (would need JOIN)
            pdf_file: row.pdf_file,
            pdf_filename: row.pdf_filename,
            pdf_uploaded_at: row.pdf_uploaded_at,
            proof_user_public_values: row.proof_user_public_values,
            proof_accumulator: row.proof_accumulator,
            proof_data: row.proof_data,
            axiom_proof_id: row.axiom_proof_id,
            proof_generated_at: row.proof_generated_at,
            proof_json: row.proof_json,
        })
    }

    async fn update_status(&self, trade_id: &str, new_status: i32) -> DbResult<()> {
        let result = sqlx::query!(
            r#"UPDATE trades SET "status" = $1 WHERE "tradeId" = $2"#,
            new_status,
            trade_id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::TradeNotFound(trade_id.to_string()));
        }

        Ok(())
    }
    
    async fn update_proof_hash(&self, trade_id: &str, _proof_hash: &str) -> DbResult<()> {
        // DEPRECATED: This method is no longer used (we use save_proof instead)
        // Kept for compatibility but does nothing
        tracing::warn!("update_proof_hash called but is deprecated, use save_proof instead");
        Ok(())
    }
    
    async fn update_settlement_tx(&self, trade_id: &str, settlement_tx_hash: &str) -> DbResult<()> {
        let result = sqlx::query!(
            r#"UPDATE trades SET "settlementTxHash" = $1 WHERE "tradeId" = $2"#,
            settlement_tx_hash,
            trade_id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::TradeNotFound(trade_id.to_string()));
        }

        Ok(())
    }
    
    async fn save_pdf(&self, trade_id: &str, pdf_data: &[u8], filename: &str) -> DbResult<DateTime<Utc>> {
        let uploaded_at = Utc::now();
        
        let result = sqlx::query!(
            r#"
            UPDATE trades 
            SET pdf_file = $1, pdf_filename = $2, pdf_uploaded_at = $3
            WHERE "tradeId" = $4
            "#,
            pdf_data,
            filename,
            uploaded_at,
            trade_id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::TradeNotFound(trade_id.to_string()));
        }

        Ok(uploaded_at)
    }
    
    async fn save_proof(&self, trade_id: &str, user_public_values: &[u8], accumulator: &[u8], proof_data: &[u8], axiom_proof_id: &str, proof_json: &str) -> DbResult<()> {
        let generated_at = Utc::now();
        
        let result = sqlx::query!(
            r#"
            UPDATE trades 
            SET proof_user_public_values = $1,
                proof_accumulator = $2,
                proof_data = $3,
                axiom_proof_id = $4,
                proof_generated_at = $5,
                proof_json = $6
            WHERE "tradeId" = $7
            "#,
            user_public_values,
            accumulator,
            proof_data,
            axiom_proof_id,
            generated_at,
            proof_json,
            trade_id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::TradeNotFound(trade_id.to_string()));
        }

        Ok(())
    }
}
