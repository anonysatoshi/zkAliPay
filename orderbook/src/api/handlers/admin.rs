use axum::{extract::State, Json};
use ethers::types::Address;
use serde::{Deserialize, Serialize};

use crate::api::{error::ApiError, state::AppState};

#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub min_trade_value_cny: Option<u64>, // CNY cents (e.g., 10000 = 100 CNY)
    pub max_trade_value_cny: Option<u64>, // CNY cents
    pub payment_window: Option<u64>,      // seconds
}

#[derive(Debug, Serialize)]
pub struct UpdateConfigResponse {
    pub tx_hash: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVerifierRequest {
    pub new_verifier_address: String, // Address of new zkPDF verifier
}

#[derive(Debug, Serialize)]
pub struct UpdateVerifierResponse {
    pub tx_hash: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateZkPDFConfigRequest {
    pub public_key_der_hash: String,
    pub app_exe_commit: String,
    pub app_vm_commit: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateZkPDFConfigResponse {
    pub tx_hash: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct PauseResponse {
    pub tx_hash: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ContractConfigResponse {
    pub min_trade_value_cny: String,
    pub max_trade_value_cny: String,
    pub payment_window: String,
    pub paused: bool,
    pub zk_verifier: String,
    pub public_key_der_hash: String,
    pub app_exe_commit: String,
    pub app_vm_commit: String,
}

/// Update contract configuration (minTradeValue, maxTradeValue, paymentWindow)
pub async fn update_config_handler(
    State(state): State<AppState>,
    Json(req): Json<UpdateConfigRequest>,
) -> Result<Json<UpdateConfigResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    tracing::info!(
        "Updating contract config: min={:?}, max={:?}, window={:?}",
        req.min_trade_value_cny,
        req.max_trade_value_cny,
        req.payment_window
    );

    let tx_hash = blockchain_client
        .update_config(
            req.min_trade_value_cny.unwrap_or(0),
            req.max_trade_value_cny.unwrap_or(0),
            req.payment_window.unwrap_or(0),
        )
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(UpdateConfigResponse {
        tx_hash: format!("{:#x}", tx_hash),
        message: "Contract configuration updated successfully".to_string(),
    }))
}

/// Update zkPDF verifier contract address
pub async fn update_verifier_handler(
    State(state): State<AppState>,
    Json(req): Json<UpdateVerifierRequest>,
) -> Result<Json<UpdateVerifierResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    let new_verifier: Address = req
        .new_verifier_address
        .parse()
        .map_err(|_| ApiError::BadRequest("Invalid verifier address".to_string()))?;

    tracing::info!("Updating zkPDF verifier to: {:?}", new_verifier);

    let tx_hash = blockchain_client
        .update_verifier(new_verifier)
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(UpdateVerifierResponse {
        tx_hash: format!("{:#x}", tx_hash),
        message: "Verifier contract updated successfully".to_string(),
    }))
}

/// Pause the contract
pub async fn pause_contract_handler(
    State(state): State<AppState>,
) -> Result<Json<PauseResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    tracing::info!("Pausing contract");

    let tx_hash = blockchain_client
        .pause_contract()
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(PauseResponse {
        tx_hash: format!("{:#x}", tx_hash),
        message: "Contract paused successfully".to_string(),
    }))
}

/// Unpause the contract
pub async fn unpause_contract_handler(
    State(state): State<AppState>,
) -> Result<Json<PauseResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    tracing::info!("Unpausing contract");

    let tx_hash = blockchain_client
        .unpause_contract()
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(PauseResponse {
        tx_hash: format!("{:#x}", tx_hash),
        message: "Contract unpaused successfully".to_string(),
    }))
}

/// Update zkPDF configuration (public key hash and commitments)
pub async fn update_zkpdf_config_handler(
    State(state): State<AppState>,
    Json(req): Json<UpdateZkPDFConfigRequest>,
) -> Result<Json<UpdateZkPDFConfigResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    // Parse hex strings to bytes32
    let public_key_der_hash = hex_to_bytes32(&req.public_key_der_hash)
        .map_err(|e| ApiError::BadRequest(format!("Invalid public_key_der_hash: {}", e)))?;
    let app_exe_commit = hex_to_bytes32(&req.app_exe_commit)
        .map_err(|e| ApiError::BadRequest(format!("Invalid app_exe_commit: {}", e)))?;
    let app_vm_commit = hex_to_bytes32(&req.app_vm_commit)
        .map_err(|e| ApiError::BadRequest(format!("Invalid app_vm_commit: {}", e)))?;

    tracing::info!(
        "Updating zkPDF config: publicKeyDerHash={}, appExeCommit={}, appVmCommit={}",
        req.public_key_der_hash,
        req.app_exe_commit,
        req.app_vm_commit
    );

    let tx_hash = blockchain_client
        .update_zkpdf_config(public_key_der_hash, app_exe_commit, app_vm_commit)
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(UpdateZkPDFConfigResponse {
        tx_hash: format!("{:#x}", tx_hash),
        message: "zkPDF configuration updated successfully".to_string(),
    }))
}

/// Helper function to convert hex string to bytes32
fn hex_to_bytes32(hex_str: &str) -> Result<[u8; 32], String> {
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(hex_str).map_err(|e| format!("Hex decode error: {}", e))?;
    if bytes.len() != 32 {
        return Err(format!("Expected 32 bytes, got {}", bytes.len()));
    }
    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes);
    Ok(result)
}

/// Get current contract configuration
pub async fn get_config_handler(
    State(state): State<AppState>,
) -> Result<Json<ContractConfigResponse>, ApiError> {
    let blockchain_client = state
        .blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;

    let config = blockchain_client
        .get_contract_config()
        .await
        .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

    Ok(Json(ContractConfigResponse {
        min_trade_value_cny: config.0.to_string(),
        max_trade_value_cny: config.1.to_string(),
        payment_window: config.2.to_string(),
        paused: config.3,
        zk_verifier: format!("{:#x}", config.4),
        public_key_der_hash: format!("0x{}", hex::encode(config.5)),
        app_exe_commit: format!("0x{}", hex::encode(config.6)),
        app_vm_commit: format!("0x{}", hex::encode(config.7)),
    }))
}

