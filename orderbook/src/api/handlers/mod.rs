pub mod admin;
pub mod buyer;
pub mod debug;
pub mod orders;
pub mod pdf;
pub mod proof;
pub mod generate_proof;

use axum::{extract::State, Json};
use chrono::Utc;

use crate::api::{
    error::ApiResult,
    state::AppState,
    types::HealthResponse,
};

pub use admin::{
    get_config_handler, pause_contract_handler, unpause_contract_handler, update_config_handler,
    update_verifier_handler, update_zkpdf_config_handler,
};
pub use buyer::{execute_fill_handler, get_trade_handler, get_trades_by_buyer_handler, submit_proof_handler, validate_pdf_handler, submit_blockchain_proof_handler};
pub use debug::get_database_dump;
pub use orders::{get_active_orders, get_order, match_buy_intent_handler};
pub use pdf::{upload_pdf_handler, get_pdf_handler};
pub use proof::get_proof_handler;
pub use generate_proof::generate_proof_handler;

/// Health check endpoint
pub async fn health_check(State(state): State<AppState>) -> ApiResult<Json<HealthResponse>> {
    // Check database health
    let db_status = match state.db.health_check().await {
        Ok(_) => "healthy",
        Err(_) => "unhealthy",
    };

    // Get orderbook status (DB-based matching)
    let orderbook_status = match state.db.get_active_orders(Some(1)).await {
        Ok(_) => "active (DB-based)",
        Err(_) => "unavailable",
    };

    Ok(Json(HealthResponse {
        status: "ok".to_string(),
        database: db_status.to_string(),
        orderbook: orderbook_status.to_string(),
        timestamp: Utc::now().to_rfc3339(),
    }))
}

