use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::api::{error::{ApiError, ApiResult}, state::AppState};

/// GET /api/trades/:trade_id/proof
/// Download the Axiom EVM proof JSON file
pub async fn get_proof_handler(
    Path(trade_id): Path<String>,
    State(state): State<AppState>,
) -> ApiResult<impl IntoResponse> {
    tracing::info!("📥 Retrieving proof for trade {}", trade_id);
    
    // Query trade from database
    let trade = sqlx::query!(
        r#"
        SELECT proof_json, axiom_proof_id
        FROM trades
        WHERE "tradeId" = $1
        "#,
        trade_id
    )
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?
    .ok_or_else(|| ApiError::NotFound(format!("Trade not found: {}", trade_id)))?;
    
    // Check if proof exists
    let proof_json = trade.proof_json
        .ok_or_else(|| ApiError::NotFound("Proof not generated yet".to_string()))?;
    
    tracing::info!(
        "✅ Returning proof for trade {}, proof_id: {:?}", 
        trade_id,
        trade.axiom_proof_id
    );
    
    // Return as JSON with proper content type
    Ok((
        StatusCode::OK,
        [("Content-Type", "application/json")],
        proof_json
    ))
}

