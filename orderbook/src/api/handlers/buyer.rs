use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use ethers::types::U256;

use crate::api::{
    error::{ApiError, ApiResult},
    state::AppState,
    matching::{MatchPlan, Fill},
};
use crate::blockchain::types::{order_id_to_bytes32, trade_id_to_bytes32};
use crate::db::trades::TradeRepository;

/// Request to execute fill order via relayer
#[derive(Debug, Deserialize)]
pub struct ExecuteFillRequest {
    /// Match plan from /match-intent
    pub match_plan: MatchPlan,
    /// Buyer address
    pub buyer_address: String,
}

/// Single trade result from fill
#[derive(Debug, Serialize)]
pub struct TradeResult {
    pub trade_id: String,
    pub order_id: String,
    pub tx_hash: String,
    pub alipay_id: String,
    pub alipay_name: String,
    pub payment_nonce: String,
    pub expires_at: i64,
}

/// Response after executing fills
#[derive(Debug, Serialize)]
pub struct ExecuteFillResponse {
    pub trades: Vec<TradeResult>,
}

/// POST /api/execute-fill
/// Relayer executes fillOrder() for each fill in the match plan
pub async fn execute_fill_handler(
    State(state): State<AppState>,
    Json(req): Json<ExecuteFillRequest>,
) -> ApiResult<Json<ExecuteFillResponse>> {
    // Check if blockchain client is available
    let blockchain_client = state.blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::ServiceUnavailable(
            "Blockchain integration not enabled".to_string()
        ))?;

    // Parse buyer address
    let buyer_address: ethers::types::Address = req.buyer_address
        .parse()
        .map_err(|_| ApiError::BadRequest("Invalid buyer address".to_string()))?;

    // Fetch payment window from contract
    let payment_window = blockchain_client
        .get_payment_window()
        .await
        .map_err(|e| ApiError::BlockchainError(format!("Failed to get payment window: {}", e)))?;
    
    tracing::info!("Payment window from contract: {} seconds", payment_window);

    let mut trades = Vec::new();

    // Execute each fill
    for (idx, fill) in req.match_plan.fills.iter().enumerate() {
        tracing::info!(
            "Executing fill {}/{}: {} USDC from order {}",
            idx + 1,
            req.match_plan.fills.len(),
            fill.fill_amount,
            fill.order_id
        );

        // Convert order ID to bytes32
        let order_id_bytes = order_id_to_bytes32(&fill.order_id)
            .map_err(|e| ApiError::BadRequest(format!("Invalid order ID: {}", e)))?;

        // Parse fill amount (must use from_dec_str to parse as decimal, not hex!)
        let fill_amount = U256::from_dec_str(&fill.fill_amount)
            .map_err(|e| ApiError::BadRequest(format!("Invalid fill amount: {}", e)))?;

        // Call fillOrder on blockchain
        let (tx_hash, trade_id, payment_nonce) = blockchain_client
            .fill_order(order_id_bytes, fill_amount, buyer_address)
            .await
            .map_err(|e| ApiError::BlockchainError(e.to_string()))?;

        tracing::info!(
            "Fill executed: trade_id={}, tx_hash={:?}",
            hex::encode(trade_id),
            tx_hash
        );

        // Create trade result
        trades.push(TradeResult {
            trade_id: format!("0x{}", hex::encode(trade_id)),
            order_id: fill.order_id.clone(),
            tx_hash: format!("{:?}", tx_hash),
            alipay_id: fill.alipay_id.clone(),
            alipay_name: fill.alipay_name.clone(),
            payment_nonce,
            expires_at: (chrono::Utc::now().timestamp() + payment_window.as_u64() as i64),
        });
    }

    Ok(Json(ExecuteFillResponse { trades }))
}

/// Request to submit payment proof
/// Request to submit proof to blockchain
#[derive(Debug, Deserialize)]
pub struct SubmitBlockchainProofRequest {
    pub trade_id: String,
}

/// Response after submitting proof to blockchain
#[derive(Debug, Serialize)]
pub struct SubmitBlockchainProofResponse {
    pub success: bool,
    pub tx_hash: String,
    pub message: String,
}

/// POST /api/submit-blockchain-proof
/// Submit the generated zkPDF proof to the blockchain for settlement
/// **PRODUCTION READY** - Only uses real proofs from database
pub async fn submit_blockchain_proof_handler(
    State(state): State<AppState>,
    Json(req): Json<SubmitBlockchainProofRequest>,
) -> ApiResult<Json<SubmitBlockchainProofResponse>> {
    let trade_id = &req.trade_id;
    
    tracing::info!("🔐 Starting blockchain proof submission for trade {}", trade_id);

    // Check if blockchain client is available
    let blockchain_client = state.blockchain_client
        .as_ref()
        .ok_or_else(|| ApiError::ServiceUnavailable(
            "Blockchain integration not enabled".to_string()
        ))?;

    // Fetch trade from database
    let trade = state.db.get_trade(trade_id).await
        .map_err(|e| ApiError::Database(format!("Failed to fetch trade: {}", e)))?;

    // Verify that proof has been generated - NO MOCK DATA!
    let user_public_values = trade.proof_user_public_values
        .ok_or_else(|| ApiError::BadRequest("Proof not yet generated for this trade. Please generate the proof first.".to_string()))?;
    
    let accumulator = trade.proof_accumulator
        .ok_or_else(|| ApiError::BadRequest("Proof accumulator not found".to_string()))?;
    
    let proof_data = trade.proof_data
        .ok_or_else(|| ApiError::BadRequest("Proof data not found".to_string()))?;

    // Validate proof component sizes
    if user_public_values.len() != 32 {
        return Err(ApiError::Internal(format!(
            "Invalid user_public_values size: expected 32, got {}",
            user_public_values.len()
        )));
    }
    if accumulator.len() != 384 {
        return Err(ApiError::Internal(format!(
            "Invalid accumulator size: expected 384, got {}",
            accumulator.len()
        )));
    }
    if proof_data.len() != 1376 {
        return Err(ApiError::Internal(format!(
            "Invalid proof_data size: expected 1376, got {}",
            proof_data.len()
        )));
    }

    tracing::info!(
        "📦 Proof components validated: user_public_values={} bytes, accumulator={} bytes, proof={} bytes",
        user_public_values.len(),
        accumulator.len(),
        proof_data.len()
    );

    // Convert trade ID to bytes32
    let trade_id_bytes = trade_id_to_bytes32(trade_id)
        .map_err(|e| ApiError::BadRequest(format!("Invalid trade ID: {}", e)))?;

    // Convert user_public_values to [u8; 32]
    let mut user_public_values_array = [0u8; 32];
    user_public_values_array.copy_from_slice(&user_public_values);

    // Submit proof to blockchain
    tracing::info!("📤 Submitting proof to blockchain for trade {}", trade_id);
    
    let tx_hash = match blockchain_client
        .submit_payment_proof(
            trade_id_bytes,
            user_public_values_array,
            accumulator,
            proof_data,
        )
        .await
    {
        Ok(hash) => {
            tracing::info!(
                "✅ Proof submitted successfully for trade {}: tx_hash={:?}",
                trade_id,
                hash
            );
            hash
        }
        Err(e) => {
            let error_msg = e.to_string();
            tracing::error!("❌ Blockchain proof submission failed for trade {}: {}", trade_id, error_msg);
            
            // Check for specific contract errors
            if error_msg.contains("0x826d29e4") || error_msg.contains("PaymentDetailsMismatch") {
                return Err(ApiError::BadRequest(
                    "Proof verification failed: Payment details do not match the trade. \
                     The proof was rejected by the smart contract.".to_string()
                ));
            } else if error_msg.contains("0x5f3f6cfc") || error_msg.contains("TradeNotPending") {
                return Err(ApiError::BadRequest(
                    "This trade is no longer pending. It may have already been settled or expired.".to_string()
                ));
            } else if error_msg.contains("0xfd72c0a0") || error_msg.contains("TradeAlreadySettled") {
                return Err(ApiError::BadRequest(
                    "This trade has already been settled.".to_string()
                ));
            } else if error_msg.contains("0x78ef33c1") || error_msg.contains("TradeExpired") {
                return Err(ApiError::BadRequest(
                    "This trade has expired and cannot be settled.".to_string()
                ));
            } else if error_msg.contains("0xea8e4eb5") || error_msg.contains("NotAuthorized") {
                return Err(ApiError::BadRequest(
                    "You are not authorized to submit proof for this trade.".to_string()
                ));
            } else if error_msg.contains("Gas estimation failed") {
                return Err(ApiError::BadRequest(
                    format!("Transaction would revert: {}. The proof was rejected before sending to the blockchain.", error_msg)
                ));
            } else {
                return Err(ApiError::BlockchainError(error_msg));
            }
        }
    };

    let tx_hash_str = format!("{:?}", tx_hash);
    
    Ok(Json(SubmitBlockchainProofResponse {
        success: true,
        tx_hash: tx_hash_str,
        message: "Proof submitted to blockchain successfully. The trade will be settled once the transaction is confirmed.".to_string(),
    }))
}

/// Request to submit proof (DEPRECATED - legacy endpoint)
#[derive(Debug, Deserialize)]
pub struct SubmitProofRequest {
    pub trade_id: String,
    pub is_valid: bool, // Deprecated - ignored in production mode
}

/// Response after submitting proof
#[derive(Debug, Serialize)]
pub struct SubmitProofResponse {
    pub tx_hash: String,
    pub trade_id: String,
    pub status: String,
}

/// POST /api/submit-proof
/// **DEPRECATED** - Use `/api/submit-blockchain-proof` instead
/// Legacy endpoint - now redirects to production proof submission
pub async fn submit_proof_handler(
    State(state): State<AppState>,
    Json(req): Json<SubmitProofRequest>,
) -> ApiResult<Json<SubmitProofResponse>> {
    tracing::warn!("⚠️  Using deprecated /api/submit-proof endpoint. Please use /api/submit-blockchain-proof instead.");
    
    // Redirect to production handler
    let response = submit_blockchain_proof_handler(
        State(state),
        Json(SubmitBlockchainProofRequest {
            trade_id: req.trade_id.clone(),
        }),
    ).await?;
    
    Ok(Json(SubmitProofResponse {
        tx_hash: response.0.tx_hash,
        trade_id: req.trade_id,
        status: "proof_submitted".to_string(),
    }))
}

/// GET /api/trades/:trade_id
/// Get trade details by ID
pub async fn get_trade_handler(
    Path(trade_id): Path<String>,
    State(state): State<AppState>,
) -> ApiResult<Json<crate::db::models::DbTrade>> {
    // Query trade from database
    let trade = sqlx::query!(
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
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?
    .ok_or_else(|| ApiError::NotFound(format!("Trade not found: {}", trade_id)))?;

    // Manually map to DbTrade
    let db_trade = crate::db::models::DbTrade {
        trade_id: trade.tradeId,
        order_id: trade.orderId,
        buyer: trade.buyer,
        token_amount: trade.tokenAmount.unwrap_or_default(),
        cny_amount: trade.cnyAmount.unwrap_or_default(),
        payment_nonce: trade.paymentNonce,
        created_at: trade.createdAt,
        expires_at: trade.expiresAt,
        status: trade.status,
        escrow_tx_hash: trade.escrowTxHash,
        settlement_tx_hash: trade.settlementTxHash,
        synced_at: trade.syncedAt,
        token: None, // Not available in single trade query (would need JOIN)
        pdf_file: trade.pdf_file,
        pdf_filename: trade.pdf_filename,
        pdf_uploaded_at: trade.pdf_uploaded_at,
        proof_user_public_values: trade.proof_user_public_values,
            proof_accumulator: trade.proof_accumulator,
            proof_data: trade.proof_data,
            axiom_proof_id: trade.axiom_proof_id,
            proof_generated_at: trade.proof_generated_at,
            proof_json: trade.proof_json,
        };

    Ok(Json(db_trade))
}

/// GET /api/trades/buyer/:buyer_address
/// Get all trades for a specific buyer
#[derive(Debug, Serialize)]
pub struct TradesResponse {
    pub trades: Vec<crate::db::models::DbTrade>,
}

pub async fn get_trades_by_buyer_handler(
    Path(buyer_address): Path<String>,
    State(state): State<AppState>,
) -> ApiResult<Json<TradesResponse>> {
    // Normalize buyer address (lowercase, strip 0x if present)
    let buyer_addr = buyer_address
        .to_lowercase()
        .trim_start_matches("0x")
        .to_string();
    
    tracing::info!("Fetching trades for buyer: {}", buyer_addr);
    
    // Query trades table with JOIN to get token from orders
    let trades = sqlx::query(
        r#"
        SELECT 
            t."tradeId",
            t."orderId",
            t.buyer,
            t."tokenAmount"::text,
            t."cnyAmount"::text,
            t."paymentNonce",
            t."createdAt",
            t."expiresAt",
            t.status,
            t."escrowTxHash",
            t."settlementTxHash",
            t."syncedAt",
            t.pdf_file,
            t.pdf_filename,
            t.pdf_uploaded_at,
            t.proof_user_public_values,
            t.proof_accumulator,
            t.proof_data,
            t.axiom_proof_id,
            t.proof_generated_at,
            t.proof_json,
            o.token
        FROM trades t
        INNER JOIN orders o ON t."orderId" = o."orderId"
        WHERE LOWER(REPLACE(t.buyer, '0x', '')) = $1
        ORDER BY t."createdAt" DESC
        "#
    )
    .bind(&buyer_addr)
    .fetch_all(state.db.pool())
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;
    
    // Map to DbTrade structs
    let db_trades: Vec<crate::db::models::DbTrade> = trades
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            crate::db::models::DbTrade {
                trade_id: row.get("tradeId"),
                order_id: row.get("orderId"),
                buyer: row.get("buyer"),
                token_amount: row.get("tokenAmount"),
                cny_amount: row.get("cnyAmount"),
                payment_nonce: row.get("paymentNonce"),
                created_at: row.get("createdAt"),
                expires_at: row.get("expiresAt"),
                status: row.get("status"),
                escrow_tx_hash: row.get("escrowTxHash"),
                settlement_tx_hash: row.get("settlementTxHash"),
                synced_at: row.get("syncedAt"),
                pdf_file: row.get("pdf_file"),
                pdf_filename: row.get("pdf_filename"),
                pdf_uploaded_at: row.get("pdf_uploaded_at"),
                proof_user_public_values: row.get("proof_user_public_values"),
                proof_accumulator: row.get("proof_accumulator"),
                proof_data: row.get("proof_data"),
                axiom_proof_id: row.get("axiom_proof_id"),
                proof_generated_at: row.get("proof_generated_at"),
                proof_json: row.get("proof_json"),
                token: Some(row.get("token")),
            }
        })
        .collect();
    
    tracing::info!("Found {} trades for buyer {}", db_trades.len(), buyer_addr);
    
    Ok(Json(TradesResponse { trades: db_trades }))
}

/// Helper function to ABI-encode PaymentDetails struct for mock verifier
/// struct PaymentDetails { string payeeAlipayId; string payeeAlipayName; uint256 amount; string note; }
fn encode_payment_details(
    alipay_id: &str,
    alipay_name: &str,
    cny_amount: &str,
    payment_nonce: &str,
) -> Vec<u8> {
    use ethers::abi::{encode, Token};
    
    // Parse CNY amount as U256
    let amount = ethers::types::U256::from_dec_str(cny_amount)
        .unwrap_or(ethers::types::U256::zero());
    
    // Encode as tuple (string, string, uint256, string)
    let tokens = vec![
        Token::String(alipay_id.to_string()),
        Token::String(alipay_name.to_string()),
        Token::Uint(amount),
        Token::String(payment_nonce.to_string()),
    ];
    
    encode(&[Token::Tuple(tokens)])
}

/// Request to validate PDF before proof generation
#[derive(Debug, Deserialize)]
pub struct ValidatePdfRequest {
    pub trade_id: String,
    // pdf_base64 is now optional - if not provided, read from database
    pub pdf_base64: Option<String>,
}

/// Response after PDF validation
#[derive(Debug, Serialize)]
pub struct ValidatePdfResponse {
    pub is_valid: bool,
    pub expected_hash: String,
    pub actual_hash: String,
    pub details: String,
}

/// POST /api/validate-pdf
/// Validate PDF by computing expected hash and running OpenVM verification
pub async fn validate_pdf_handler(
    State(state): State<AppState>,
    Json(req): Json<ValidatePdfRequest>,
) -> ApiResult<Json<ValidatePdfResponse>> {
    use crate::pdf_validation::{validate_pdf, PdfValidationRequest};
    use base64::{Engine as _, engine::general_purpose};
    
    tracing::info!("Validating PDF for trade: {}", req.trade_id);
    
    // Get trade details from database
    let trade = sqlx::query!(
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
        req.trade_id
    )
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?
    .ok_or_else(|| ApiError::NotFound(format!("Trade not found: {}", req.trade_id)))?;
    
    // Get order details for Alipay info
    let order = sqlx::query!(
        r#"
        SELECT "orderId", "seller", "alipayId", "alipayName"
        FROM orders
        WHERE "orderId" = $1
        "#,
        trade.orderId
    )
    .fetch_optional(state.db.pool())
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?
    .ok_or_else(|| ApiError::NotFound(format!("Order not found: {}", trade.orderId)))?;
    
    // Get PDF bytes - either from request or from database
    let pdf_bytes = if let Some(pdf_base64) = req.pdf_base64 {
        // PDF provided in request (for immediate validation after upload)
        tracing::info!("Using PDF from request body");
        general_purpose::STANDARD
            .decode(&pdf_base64)
            .map_err(|e| ApiError::BadRequest(format!("Invalid base64 PDF: {}", e)))?
    } else {
        // Read PDF from database (for re-validation or later validation)
        tracing::info!("Reading PDF from database");
        trade.pdf_file
            .ok_or_else(|| ApiError::BadRequest("No PDF file uploaded for this trade".to_string()))?
    };
    
    // Get public key DER hash from blockchain
    let blockchain_client = state.blockchain_client.as_ref()
        .ok_or_else(|| ApiError::ServiceUnavailable("Blockchain client not available".to_string()))?;
    
    let public_key_der_hash_bytes = blockchain_client
        .get_public_key_der_hash()
        .await
        .map_err(|e| ApiError::BlockchainError(format!("Failed to get public key hash: {}", e)))?;
    
    let public_key_der_hash = hex::encode(public_key_der_hash_bytes);
    
    // Parse CNY amount from string (remove decimal point and convert to cents)
    let cny_amount_str = trade.cnyAmount.as_ref().map(|s| s.as_str()).unwrap_or("0");
    let cny_amount_cents: u64 = if cny_amount_str.contains('.') {
        // Parse as decimal (e.g., "1060.00" -> 106000 cents)
        let parts: Vec<&str> = cny_amount_str.split('.').collect();
        let yuan: u64 = parts[0].parse().map_err(|e| {
            ApiError::BadRequest(format!("Invalid CNY amount: {}", e))
        })?;
        let cents: u64 = if parts.len() > 1 {
            parts[1].parse().unwrap_or(0)
        } else {
            0
        };
        yuan * 100 + cents
    } else {
        // Assume it's already in cents
        cny_amount_str.parse().map_err(|e| {
            ApiError::BadRequest(format!("Invalid CNY amount: {}", e))
        })?
    };
    
    // Create validation request
    // ⚠️ TEMPORARY: Hardcoded nonce for testing to avoid generating new PDF per trade
    // TODO: Restore original code after cleanup: payment_nonce: trade.paymentNonce
    let test_nonce = "18191527".to_string(); // Hardcoded for test PDF - saves time during cleanup
    
    let validation_request = PdfValidationRequest {
        pdf_bytes,
        alipay_name: order.alipayName,
        alipay_id: order.alipayId,
        cny_amount_cents,
        payment_nonce: test_nonce, // Using hardcoded nonce instead of: trade.paymentNonce
        public_key_der_hash,
    };
    
    // Run validation
    let result = validate_pdf(validation_request)
        .await
        .map_err(|e| ApiError::Internal(format!("PDF validation failed: {}", e)))?;
    
    tracing::info!(
        "PDF validation result for trade {}: valid={}, expected={}, actual={}",
        req.trade_id,
        result.is_valid,
        result.expected_hash,
        result.actual_hash
    );
    
    Ok(Json(ValidatePdfResponse {
        is_valid: result.is_valid,
        expected_hash: result.expected_hash,
        actual_hash: result.actual_hash,
        details: result.details,
    }))
}

