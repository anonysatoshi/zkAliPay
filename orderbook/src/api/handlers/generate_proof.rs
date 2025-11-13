use axum::{
    extract::State,
    Json,
};
use serde::{Deserialize, Serialize};
use crate::api::{error::{ApiError, ApiResult}, state::AppState};
use crate::axiom_prover::AxiomProver;
use openvm::serde::to_vec as openvm_serialize;

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

// ============================================================================
// Helper Functions (moved from pdf_validation module)
// ============================================================================

#[derive(Debug, thiserror::Error)]
enum ValidationError {
    #[error("Failed to compute expected hash: {0}")]
    HashComputation(String),
    
    #[error("Invalid output format: {0}")]
    InvalidOutput(String),
}

/// Format CNY amount from cents to string with 2 decimal places
/// Example: 106000 cents → "1060.00"
fn format_cny_amount(cents: u64) -> String {
    let yuan = cents / 100;
    let cents_remainder = cents % 100;
    format!("{}.{:02}", yuan, cents_remainder)
}

/// Mask Alipay ID: show first 3 and last 2 digits, mask middle 6
/// Example: "13945908941" → "139******41"
fn mask_alipay_id(alipay_id: &str) -> Result<String, ValidationError> {
    if alipay_id.len() != 11 {
        return Err(ValidationError::HashComputation(
            format!("Invalid Alipay ID length: expected 11, got {}", alipay_id.len())
        ));
    }
    
    let first3 = &alipay_id[0..3];
    let last2 = &alipay_id[9..11];
    Ok(format!("{}******{}", first3, last2))
}

/// Compute expected hash locally (for validation)
/// Uses same logic as the zkVM guest program (OLD FORMAT)
fn compute_expected_hash(
    alipay_name: &str,
    alipay_id: &str,
    cny_amount_cents: u64,
    payment_nonce: &str,
    public_key_der_hash: &str,
) -> Result<[u8; 32], ValidationError> {
    use sha2::{Sha256, Digest};
    
    // Hardcoded line numbers: 20, 21, 29, 32
    let line_numbers: [u32; 4] = [20, 21, 29, 32];
    
    // Format CNY amount: 106000 cents → "1060.00"
    let cny_formatted = format_cny_amount(cny_amount_cents);
    
    // Mask Alipay ID: show first 3 and last 2 digits, mask middle 6
    let masked_alipay_id = mask_alipay_id(alipay_id)?;
    
    // Build line texts with Chinese prefixes
    let line20 = format!("账户名：{}", alipay_name);
    let line21 = format!("账号：{}", masked_alipay_id);
    let line29 = format!("小写：{}", cny_formatted);
    let line32 = payment_nonce.to_string(); // Just the nonce, no prefix
    
    // Compute lines hash (SHA256 of: line_num_0 || line_text_0 || line_num_1 || line_text_1 || ...)
    let mut lines_data = Vec::new();
    lines_data.extend_from_slice(&line_numbers[0].to_le_bytes());
    lines_data.extend_from_slice(line20.as_bytes());
    lines_data.extend_from_slice(&line_numbers[1].to_le_bytes());
    lines_data.extend_from_slice(line21.as_bytes());
    lines_data.extend_from_slice(&line_numbers[2].to_le_bytes());
    lines_data.extend_from_slice(line29.as_bytes());
    lines_data.extend_from_slice(&line_numbers[3].to_le_bytes());
    lines_data.extend_from_slice(line32.as_bytes());
    
    let lines_hash = Sha256::digest(&lines_data);
    
    // Compute final output hash: SHA256(result || publicKeyDerHash || linesHash)
    // result is always true (0x01)
    let mut final_data = Vec::new();
    final_data.push(0x01); // result = true (1 byte)
    
    // Decode public key DER hash from hex
    let pk_hash_bytes = hex::decode(public_key_der_hash)
        .map_err(|e| ValidationError::HashComputation(format!("Invalid public key hash: {}", e)))?;
    if pk_hash_bytes.len() != 32 {
        return Err(ValidationError::HashComputation(
            "Public key hash must be 32 bytes".to_string()
        ));
    }
    final_data.extend_from_slice(&pk_hash_bytes);
    final_data.extend_from_slice(&lines_hash);
    
    let final_hash = Sha256::digest(&final_data);
    Ok(final_hash.into())
}

/// Generate OpenVM input streams directly (OLD FORMAT - compatible with guest program)
/// Returns a vector of 44 hex-encoded input streams (with 0x01 prefix)
fn generate_openvm_streams(
    pdf_bytes: &[u8],
    page: u8,
    lines: Vec<(u32, String)>,
    public_key_der_hash_hex: &str,
) -> Result<Vec<String>, ValidationError> {
    use serde::Serialize;
    
    let mut streams = Vec::new();
    
    // Helper to add a serialized value as a stream (using OpenVM serialization)
    fn add_value_stream<T: Serialize>(streams: &mut Vec<String>, value: &T) -> Result<(), ValidationError> {
        // Use openvm::serde::to_vec which returns Vec<u32> (words)
        let words = openvm_serialize(value)
            .map_err(|e| ValidationError::InvalidOutput(format!("OpenVM serialization failed: {}", e)))?;
        
        // Convert words (u32) to bytes
        let bytes: Vec<u8> = words.into_iter().flat_map(|w| w.to_le_bytes()).collect();
        
        // OLD FORMAT: Use 0x01 prefix for everything
        streams.push(format!("0x01{}", hex::encode(&bytes)));
        Ok(())
    }
    
    // Stream 1: PDF bytes (raw, padded to 4-byte boundary)
    let padding = (4 - (pdf_bytes.len() % 4)) % 4;
    let mut pdf_padded = pdf_bytes.to_vec();
    pdf_padded.extend(vec![0u8; padding]);
    streams.push(format!("0x01{}", hex::encode(&pdf_padded)));
    
    // Stream 2: Page number (u8)
    add_value_stream(&mut streams, &page)?;
    
    // Stream 3: Line count (u32)
    let line_count = lines.len() as u32;
    add_value_stream(&mut streams, &line_count)?;
    
    // Streams 4+: Lines (line_count lines × 2 streams each)
    for (num, text) in &lines {
        add_value_stream(&mut streams, num)?;
        add_value_stream(&mut streams, text)?;
    }
    
    // Stream: Hash length (u32)
    add_value_stream(&mut streams, &32u32)?;
    
    // Streams: Hash bytes (32 × 1 stream each)
    let hash_bytes = hex::decode(public_key_der_hash_hex)
        .map_err(|e| ValidationError::InvalidOutput(format!("Invalid hash hex: {}", e)))?;
    
    if hash_bytes.len() != 32 {
        return Err(ValidationError::InvalidOutput(format!(
            "Hash must be 32 bytes, got {}",
            hash_bytes.len()
        )));
    }
    
    for byte in hash_bytes {
        add_value_stream(&mut streams, &byte)?;
    }
    
    tracing::info!("✅ Generated {} OpenVM input streams (OLD FORMAT)", streams.len());
    
    Ok(streams)
}

/// Generate input streams for Axiom API
async fn generate_input_streams_for_axiom(
    pdf_bytes: &[u8],
    alipay_name: &str,
    alipay_id: &str,
    cny_amount_cents: u64,
    payment_nonce: &str,
    public_key_der_hash: &str,
) -> Result<Vec<String>, ValidationError> {
    // Format CNY amount and mask Alipay ID
    let cny_formatted = format_cny_amount(cny_amount_cents);
    let masked_alipay_id = mask_alipay_id(alipay_id)?;
    
    // Build line text for OpenVM input
    let line_text = format!(
        "账户名：{}\n账号：{}\n小写：{}\n{}",
        alipay_name, masked_alipay_id, cny_formatted, payment_nonce
    );
    
    // Split into individual lines
    let line_texts: Vec<String> = line_text
        .split('\n')
        .map(|s| s.trim().to_string())
        .collect();
    
    // Line numbers (fixed for Alipay PDF format)
    let line_numbers = vec![20u32, 21, 29, 32];
    
    if line_numbers.len() != line_texts.len() {
        return Err(ValidationError::InvalidOutput(format!(
            "Line numbers ({}) must match line texts ({})",
            line_numbers.len(),
            line_texts.len()
        )));
    }
    
    // Combine into (line_number, text) pairs
    let lines: Vec<(u32, String)> = line_numbers.into_iter()
        .zip(line_texts.into_iter())
        .collect();
    
    // Generate streams
    let input_streams = generate_openvm_streams(
        pdf_bytes,
        0, // page 0
        lines,
        public_key_der_hash,
    )?;
    
    tracing::info!("✅ Generated {} input streams for Axiom API", input_streams.len());
    
    Ok(input_streams)
}

// ============================================================================
// Main Handler
// ============================================================================

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
    
    // TODO: TESTING ONLY - Remove hardcoded nonce in production
    // In production, use: let payment_nonce = &trade.payment_nonce;
    let payment_nonce = "18191527";
    
    tracing::info!("📋 Trade details: name={}, id={}, amount={} cents, nonce={} (HARDCODED FOR TESTING)", 
        alipay_name, alipay_id, cny_amount_cents, payment_nonce);
    
    // Step 3: Get public key DER hash from contract
    let blockchain_client = state.blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;
    
    let public_key_der_hash_bytes = blockchain_client.get_public_key_der_hash().await
        .map_err(|e| ApiError::Internal(format!("Failed to get public key hash: {}", e)))?;
    let public_key_der_hash = hex::encode(public_key_der_hash_bytes);
    
    tracing::info!("🔑 Public key DER hash: {}", public_key_der_hash);
    
    // Step 4: Try to get input streams from cache (from validation step)
    let input_streams = {
        let cache = state.input_streams_cache.read().await;
        cache.get(&trade_id).cloned()
    };
    
    let input_streams = if let Some(cached_streams) = input_streams {
        tracing::info!("✅ Reusing cached input streams ({} streams)", cached_streams.len());
        cached_streams
    } else {
        // Fallback: Generate input streams if not cached
        tracing::warn!("⚠️ No cached input streams found, generating new ones...");
        
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
        input_streams
    };
    
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

// ============================================================================
// PDF Validation Handler (using Axiom Execute Mode)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ValidatePdfAxiomRequest {
    pub trade_id: String,
}

#[derive(Debug, Serialize)]
pub struct ValidatePdfAxiomResponse {
    pub is_valid: bool,
    pub expected_hash: String,
    pub actual_hash: String,
    pub details: String,
}

/// POST /api/validate-pdf-axiom
/// Validate PDF using Axiom Execute Mode (fast validation)
pub async fn validate_pdf_axiom_handler(
    State(state): State<AppState>,
    Json(req): Json<ValidatePdfAxiomRequest>,
) -> ApiResult<Json<ValidatePdfAxiomResponse>> {
    let trade_id = req.trade_id;
    tracing::info!("⚡ Starting PDF validation via Axiom execute mode for trade {}", trade_id);
    
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
    
    // TODO: TESTING ONLY - Remove hardcoded nonce in production
    // In production, use: let payment_nonce = &trade.payment_nonce;
    let payment_nonce = "18191527";
    
    tracing::info!("📋 Trade details: name={}, id={}, amount={} cents, nonce={} (HARDCODED FOR TESTING)", 
        alipay_name, alipay_id, cny_amount_cents, payment_nonce);
    
    // Step 3: Get public key DER hash from contract
    let blockchain_client = state.blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::Internal("Blockchain client not available".to_string()))?;
    
    let public_key_der_hash_bytes = blockchain_client.get_public_key_der_hash().await
        .map_err(|e| ApiError::Internal(format!("Failed to get public key hash: {}", e)))?;
    let public_key_der_hash = hex::encode(public_key_der_hash_bytes);
    
    tracing::info!("🔑 Public key DER hash: {}", public_key_der_hash);
    
    // Step 4: Compute expected_hash locally (fast)
    let expected_hash = compute_expected_hash(
        alipay_name,
        alipay_id,
        cny_amount_cents,
        payment_nonce,
        &public_key_der_hash,
    ).map_err(|e| ApiError::Internal(format!("Failed to compute expected hash: {}", e)))?;
    
    tracing::info!("🔑 Expected hash: {}", hex::encode(expected_hash));
    
    // Step 5: Generate 44 input streams (OLD FORMAT)
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
    
    // Step 6: Save input streams to in-memory cache for reuse in proof generation
    {
        let mut cache = state.input_streams_cache.write().await;
        cache.insert(trade_id.clone(), input_streams.clone());
        tracing::info!("💾 Cached input streams for trade {}", trade_id);
    }
    
    // Step 7: Initialize Axiom prover
    let api_key = std::env::var("AXIOM_API_KEY")
        .map_err(|_| ApiError::Internal("AXIOM_API_KEY not set".to_string()))?;
    let config_id = std::env::var("AXIOM_CONFIG_ID")
        .unwrap_or_else(|_| "cfg_01k3w1spnpnxzry017g5jzcy97".to_string());
    let program_id = std::env::var("AXIOM_PROGRAM_ID")
        .unwrap_or_else(|_| "prg_01k8vn94vy3hwve3np6dxgkgz8".to_string());
    
    let axiom_prover = AxiomProver::new(api_key, config_id, program_id);
    
    // Step 8: Call Axiom Execute API (fast validation)
    tracing::info!("🚀 Submitting execution request to Axiom...");
    let actual_hash = axiom_prover.execute_program(&trade_id, input_streams).await
        .map_err(|e| ApiError::Internal(format!("Axiom execution failed: {}", e)))?;
    
    tracing::info!("✅ Execution completed! Actual hash: {}", hex::encode(&actual_hash));
    
    // Step 9: Compare hashes
    let is_valid = expected_hash.as_slice() == actual_hash.as_slice();
    
    let details = if is_valid {
        "PDF validation successful - hashes match".to_string()
    } else {
        "PDF validation failed - hash mismatch".to_string()
    };
    
    tracing::info!("🎯 Validation result: {}", if is_valid { "VALID ✅" } else { "INVALID ❌" });
    
    Ok(Json(ValidatePdfAxiomResponse {
        is_valid,
        expected_hash: hex::encode(expected_hash),
        actual_hash: hex::encode(actual_hash),
        details,
    }))
}
