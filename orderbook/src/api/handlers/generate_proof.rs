use axum::{
    extract::State,
    Json,
};
use serde::{Deserialize, Serialize};
use crate::api::{error::{ApiError, ApiResult}, state::AppState};
use crate::axiom_prover::AxiomProver;
use crate::pdf_validation::generate_input_streams_for_axiom;

#[derive(Debug, Deserialize)]
pub struct GenerateProofRequest {
    pub trade_id: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateProofResponse {
    pub success: bool,
    pub message: String,
    pub proof_id: Option<String>,
}

/// POST /api/generate-proof
/// Generate Axiom EVM proof for a trade's PDF
pub async fn generate_proof_handler(
    State(state): State<AppState>,
    Json(req): Json<GenerateProofRequest>,
) -> ApiResult<Json<GenerateProofResponse>> {
    let trade_id = req.trade_id;
    tracing::info!("🔐 Starting proof generation for trade {}", trade_id);
    
    // Step 1: Get trade from database
    let trade = state.db.get_trade(&trade_id).await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    
    // Verify PDF exists
    let pdf_bytes = trade.pdf_file
        .ok_or_else(|| ApiError::BadRequest("No PDF uploaded for this trade".to_string()))?;
    
    tracing::info!("✅ PDF found ({} bytes)", pdf_bytes.len());
    
    // Step 2: Extract trade details
    let order = state.db.get_order(&trade.order_id).await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    
    let alipay_name = &order.alipay_name;
    let alipay_id = &order.alipay_id;
    let cny_amount_cents: u64 = trade.cny_amount.parse::<f64>()
        .map_err(|e| ApiError::Internal(format!("Invalid CNY amount: {}", e)))?
        .round() as u64;
    let payment_nonce = &trade.payment_nonce;
    
    tracing::info!("📋 Trade details: name={}, id={}, amount={} cents, nonce={}", 
        alipay_name, alipay_id, cny_amount_cents, payment_nonce);
    
    // Step 3: Get public key DER hash from contract
    let blockchain_client = state.blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;
    
    let public_key_der_hash_bytes = blockchain_client.get_public_key_der_hash().await
        .map_err(|e| ApiError::Internal(format!("Failed to get public key hash: {}", e)))?;
    let public_key_der_hash = hex::encode(public_key_der_hash_bytes);
    
    tracing::info!("🔑 Public key DER hash: {}", public_key_der_hash);
    
    // Step 4: Generate 46 input streams for Axiom
    tracing::info!("⚙️ Generating OpenVM input streams...");
    let input_streams = generate_input_streams_for_axiom(
        &pdf_bytes,
        alipay_name,
        alipay_id,
        cny_amount_cents,
        payment_nonce,
        &public_key_der_hash,
    ).await
        .map_err(|e| ApiError::Internal(format!("Failed to generate input streams: {}", e)))?;
    
    tracing::info!("✅ Generated {} input streams", input_streams.len());
    
    // Step 5: Initialize Axiom prover
    let api_key = std::env::var("AXIOM_API_KEY")
        .map_err(|_| ApiError::Internal("AXIOM_API_KEY not set".to_string()))?;
    let config_id = std::env::var("AXIOM_CONFIG_ID")
        .unwrap_or_else(|_| "cfg_01k3w1spnpnxzry017g5jzcy97".to_string());
    let program_id = std::env::var("AXIOM_PROGRAM_ID")
        .unwrap_or_else(|_| "prg_01k8vn94vy3hwve3np6dxgkgz8".to_string());
    
    let axiom_prover = AxiomProver::new(api_key, config_id, program_id);
    
    // Step 6: Generate EVM proof (this will take time - polling inside)
    tracing::info!("🚀 Submitting proof generation request to Axiom...");
    let generated_proof = axiom_prover.generate_evm_proof(&trade_id, input_streams).await
        .map_err(|e| ApiError::Internal(format!("Axiom proof generation failed: {}", e)))?;
    
    tracing::info!("✅ Proof generated! ID: {}", generated_proof.proof_id);
    
    // Step 7: Save proof to database
    let proof_json = serde_json::to_string(&generated_proof.full_json)
        .map_err(|e| ApiError::Internal(format!("Failed to serialize proof: {}", e)))?;
    
    state.db.save_trade_proof(
        &trade_id,
        &generated_proof.user_public_values,
        &generated_proof.accumulator,
        &generated_proof.proof_data,
        &generated_proof.proof_id,
        &proof_json,
    ).await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    
    tracing::info!("💾 Proof saved to database for trade {}", trade_id);
    
    Ok(Json(GenerateProofResponse {
        success: true,
        message: "Proof generated successfully".to_string(),
        proof_id: Some(generated_proof.proof_id),
    }))
}

