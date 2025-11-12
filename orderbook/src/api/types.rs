use serde::{Deserialize, Serialize};

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub orderbook: String,
    pub timestamp: String,
}

/// Generic success response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: String,
}

