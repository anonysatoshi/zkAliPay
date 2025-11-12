use axum::{extract::State, Json};
use serde::Serialize;

use crate::api::{error::ApiResult, state::AppState};
use crate::db::models::{DbOrder, DbTrade};

/// Debug response with full database dump
#[derive(Debug, Serialize)]
pub struct DatabaseDump {
    pub orders: Vec<DbOrder>,
    pub trades: Vec<DbTrade>,
}

/// GET /api/debug/database
/// Returns complete database state for debugging
pub async fn get_database_dump(
    State(state): State<AppState>,
) -> ApiResult<Json<DatabaseDump>> {
    // Fetch all orders
    let orders = sqlx::query!(
        r#"
        SELECT 
            "orderId", "seller", "token", "totalAmount"::text, "remainingAmount"::text,
            "exchangeRate", "alipayId", "alipayName", 
            "createdAt", "syncedAt"
        FROM orders
        ORDER BY "createdAt" DESC
        "#
    )
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| crate::api::error::ApiError::Database(e.to_string()))?;

    let orders: Vec<DbOrder> = orders
        .into_iter()
        .map(|row| DbOrder {
            order_id: row.orderId,
            seller: row.seller,
            token: row.token,
            total_amount: row.totalAmount.unwrap_or_default(),
            remaining_amount: row.remainingAmount.unwrap_or_default(),
            exchange_rate: row.exchangeRate.to_string(),
            alipay_id: row.alipayId,
            alipay_name: row.alipayName,
            created_at: row.createdAt,
            synced_at: row.syncedAt,
        })
        .collect();

    // Fetch all trades
    let trades = sqlx::query!(
        r#"
        SELECT 
            "tradeId", "orderId", "buyer", "tokenAmount"::text, "cnyAmount"::text,
            "paymentNonce", "createdAt", "expiresAt", "status",
            "escrowTxHash", "settlementTxHash", "syncedAt",
            pdf_file, pdf_filename, pdf_uploaded_at,
            proof_user_public_values, proof_accumulator, proof_data,
            axiom_proof_id, proof_generated_at, proof_json
        FROM trades
        ORDER BY "createdAt" DESC
        "#
    )
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| crate::api::error::ApiError::Database(e.to_string()))?;

    let trades: Vec<DbTrade> = trades
        .into_iter()
        .map(|row| DbTrade {
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
            token: None, // Not available in debug dump (would need JOIN)
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
        .collect();

    Ok(Json(DatabaseDump { orders, trades }))
}

