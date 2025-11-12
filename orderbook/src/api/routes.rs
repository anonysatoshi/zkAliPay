use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{CorsLayer, Any};

use crate::api::{handlers, state::AppState};

/// Create the API router with all endpoints
/// DB-based orderbook with direct query matching
pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health check
        .route("/health", get(handlers::health_check))
        
        // Order endpoints
        .route("/api/orders/active", get(handlers::get_active_orders))
        .route("/api/orders/:order_id", get(handlers::get_order))
        
        // Matching endpoint
        .route("/api/match-intent", post(handlers::match_buy_intent_handler))
        
        // Buyer endpoints
        .route("/api/execute-fill", post(handlers::execute_fill_handler))
        .route("/api/trades/:trade_id", get(handlers::get_trade_handler))
        .route("/api/trades/buyer/:buyer_address", get(handlers::get_trades_by_buyer_handler))
        .route("/api/submit-proof", post(handlers::submit_proof_handler))
        
        // PDF endpoints
        .route("/api/trades/:trade_id/pdf", post(handlers::upload_pdf_handler))
        .route("/api/trades/:trade_id/pdf", get(handlers::get_pdf_handler))
        .route("/api/validate-pdf", post(handlers::validate_pdf_handler))
        
        // Proof endpoints
        .route("/api/trades/:trade_id/proof", get(handlers::get_proof_handler))
        .route("/api/generate-proof", post(handlers::generate_proof_handler))
        .route("/api/submit-blockchain-proof", post(handlers::submit_blockchain_proof_handler))
        
        // Debug endpoint
        .route("/api/debug/database", get(handlers::get_database_dump))
        
        // Admin endpoints
        .route("/api/admin/config", get(handlers::get_config_handler))
        .route("/api/admin/update-config", post(handlers::update_config_handler))
        .route("/api/admin/update-verifier", post(handlers::update_verifier_handler))
        .route("/api/admin/update-zkpdf-config", post(handlers::update_zkpdf_config_handler))
        .route("/api/admin/pause", post(handlers::pause_contract_handler))
        .route("/api/admin/unpause", post(handlers::unpause_contract_handler))
        
        .layer(cors)
        .with_state(state)
}

