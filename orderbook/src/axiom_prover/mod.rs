use anyhow::{Result, anyhow};
use reqwest;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

const AXIOM_API_BASE: &str = "https://api.axiom.xyz";

/// Axiom Prover client
pub struct AxiomProver {
    api_key: String,
    config_id: String,
    program_id: String,
    client: reqwest::Client,
}

impl AxiomProver {
    pub fn new(api_key: String, config_id: String, program_id: String) -> Self {
        Self {
            api_key,
            config_id,
            program_id,
            client: reqwest::Client::new(),
        }
    }
    
    /// Execute program (fast validation mode) - returns output hash only
    pub async fn execute_program(&self, trade_id: &str, input_streams: Vec<String>) -> Result<Vec<u8>> {
        tracing::info!("⚡ [{}] Starting Axiom program execution (validation mode)", trade_id);
        tracing::info!("📋 [{}] Input streams count: {}", trade_id, input_streams.len());
        
        // Step 1: Submit execution request
        let execution_id = self.submit_execution_request(input_streams).await?;
        tracing::info!("📤 [{}] Execution request submitted, execution_id: {}", trade_id, execution_id);
        
        // Step 2: Poll for completion
        self.poll_execution_status(&execution_id).await?;
        tracing::info!("✅ [{}] Execution completed: {}", trade_id, execution_id);
        
        // Step 3: Get execution result
        let result = self.get_execution_result(&execution_id).await?;
        
        // Log the full response for debugging
        tracing::debug!("📊 [{}] Full execution result: {}", trade_id, serde_json::to_string_pretty(&result).unwrap_or_else(|_| "Failed to serialize".to_string()));
        
        // Step 4: Extract public_values (32 bytes)
        // Check if public_values is null (execution failed or no output)
        if result["public_values"].is_null() {
            let error_msg = result["error_message"]
                .as_str()
                .unwrap_or("No error message provided");
            let status = result["status"]
                .as_str()
                .unwrap_or("Unknown");
            return Err(anyhow!("Execution failed with status '{}': {}", status, error_msg));
        }
        
        // public_values can be either a hex string or an array of numbers
        let public_values = if let Some(hex_str) = result["public_values"].as_str() {
            // It's a hex string
            hex::decode(hex_str.trim_start_matches("0x"))?
        } else if let Some(array) = result["public_values"].as_array() {
            // It's an array of numbers (bytes)
            array.iter()
                .map(|v| v.as_u64().ok_or_else(|| anyhow!("Invalid byte value in public_values array")))
                .collect::<Result<Vec<_>, _>>()?
                .into_iter()
                .map(|v| v as u8)
                .collect()
        } else {
            return Err(anyhow!("public_values is neither a string nor an array. Value: {:?}", result["public_values"]));
        };
        
        if public_values.len() != 32 {
            return Err(anyhow!("Invalid public_values size: expected 32 bytes, got {}", public_values.len()));
        }
        
        tracing::info!("📥 [{}] Execution result: {} bytes", trade_id, public_values.len());
        
        Ok(public_values)
    }
    
    /// Generate EVM proof - orchestrates the full flow
    pub async fn generate_evm_proof(&self, trade_id: &str, input_streams: Vec<String>) -> Result<GeneratedProof> {
        tracing::info!("🚀 [{}] Starting Axiom EVM proof generation", trade_id);
        tracing::info!("📋 [{}] Input streams count: {}", trade_id, input_streams.len());
        
        // Step 1: Submit proof request
        let proof_id = self.submit_proof_request(input_streams).await?;
        tracing::info!("📤 [{}] Proof request submitted, proof_id: {}", trade_id, proof_id);
        
        // Step 2: Poll for completion
        self.poll_proof_status(&proof_id).await?;
        tracing::info!("✅ [{}] Proof generation completed: {}", trade_id, proof_id);
        
        // Step 3: Download proof
        let evm_proof = self.download_evm_proof(&proof_id).await?;
        tracing::info!("📥 [{}] Proof downloaded", trade_id);
        
        // Step 4: Parse into GeneratedProof
        let generated_proof = parse_evm_proof(proof_id, evm_proof)?;
        
        Ok(generated_proof)
    }
    
    /// Submit a proof generation request to Axiom
    async fn submit_proof_request(&self, input_streams: Vec<String>) -> Result<String> {
        // Request body only contains input - NO proof_type here
        let request_body = serde_json::json!({
            "input": input_streams,  // Direct list
        });
        
        let response = self.client
            .post(format!("{}/v1/proofs", AXIOM_API_BASE))
            // Both program_id AND proof_type must be query parameters!
            .query(&[
                ("program_id", self.program_id.as_str()),
                ("proof_type", "evm"),  // CRITICAL: Must be in query params, not body!
            ])
            .header("Axiom-API-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to submit proof request ({}): {}", status, error_text));
        }
        
        // Log the response body for debugging
        let response_text = response.text().await?;
        tracing::info!("Axiom API response: {}", response_text);
        
        let submit_response: ProofSubmitResponse = serde_json::from_str(&response_text)
            .map_err(|e| anyhow!("Failed to parse Axiom response: {}. Response: {}", e, response_text))?;
        Ok(submit_response.id)  // Use "id" field
    }
    
    /// Poll proof status until completion or timeout
    async fn poll_proof_status(&self, proof_id: &str) -> Result<()> {
        let max_attempts = 120; // 120 attempts * 10 seconds = 20 minutes max
        let mut attempt = 0;
        let mut delay_secs = 10;
        
        loop {
            attempt += 1;
            if attempt > max_attempts {
                return Err(anyhow!("Proof generation timed out after {} attempts", max_attempts));
            }
            
            // Poll status
            let response = self.client
                .get(format!("{}/v1/proofs/{}", AXIOM_API_BASE, proof_id))
                .header("Axiom-API-Key", &self.api_key)
                .send()
                .await?;
            
            if !response.status().is_success() {
                let status = response.status();
                let error_text = response.text().await?;
                return Err(anyhow!("Failed to poll proof status ({}): {}", status, error_text));
            }
            
            // Log response for debugging
            let response_text = response.text().await?;
            tracing::info!("📊 Status poll response: {}", response_text);
            
            let status_response: ProofStatusResponse = serde_json::from_str(&response_text)
                .map_err(|e| anyhow!("Failed to parse status response: {}. Response: {}", e, response_text))?;
            
            tracing::info!("Proof status: {} (type: {})", status_response.state, status_response.proof_type);
            
            match status_response.state.as_str() {
                // According to Axiom API docs, the terminal success state is "Succeeded"
                "Succeeded" => {
                    tracing::info!("✅ Proof completed after {} attempts", attempt);
                    return Ok(());
                }
                "Failed" => {
                    let error_msg = status_response.error_message.unwrap_or_else(|| "Unknown error".to_string());
                    return Err(anyhow!("Proof generation failed: {}", error_msg));
                }
                // Valid in-progress states from Axiom API
                "Queued" | "Executing" | "Executed" | "AppProving" | "AppProvingDone" | "PostProcessing" => {
                    tracing::info!("⏳ Proof status: {} (attempt {}/{})", status_response.state, attempt, max_attempts);
                    sleep(Duration::from_secs(delay_secs)).await;
                    
                    // Exponential backoff (cap at 30 seconds)
                    if delay_secs < 30 {
                        delay_secs = (delay_secs * 3 / 2).min(30);
                    }
                }
                _ => {
                    tracing::warn!("Unknown proof status: {}", status_response.state);
                    sleep(Duration::from_secs(delay_secs)).await;
                }
            }
        }
    }
    
    /// Download the completed EVM proof
    async fn download_evm_proof(&self, proof_id: &str) -> Result<EvmProof> {
        // According to Axiom API docs: GET /v1/proofs/{proof_id}/proof/{proof_type}
        let response = self.client
            .get(format!("{}/v1/proofs/{}/proof/evm", AXIOM_API_BASE, proof_id))
            .header("Axiom-API-Key", &self.api_key)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to download EVM proof ({}): {}", status, error_text));
        }
        
        let evm_proof: EvmProof = response.json().await?;
        Ok(evm_proof)
    }
}

/// Response from submitting a proof request
#[derive(Debug, Deserialize)]
struct ProofSubmitResponse {
    id: String,  // Axiom returns "id", not "proof_id"
}

/// Response from polling proof status
#[derive(Debug, Deserialize)]
struct ProofStatusResponse {
    id: String,  // Axiom uses "id", not "proof_id"
    state: String,  // "Queued", "Running", "Completed", "Failed" - uses "state" not "status"
    proof_type: String,  // "stark" or "evm"
    #[serde(default)]
    error_message: Option<String>,
}

/// EVM Proof data structure returned by Axiom
#[derive(Debug, Deserialize)]
pub struct EvmProof {
    pub version: String,
    pub app_exe_commit: String,      // 32 bytes hex (without 0x)
    pub app_vm_commit: String,       // 32 bytes hex (without 0x)
    pub user_public_values: String,  // 32 bytes hex (without 0x)
    pub proof_data: ProofData,
}

#[derive(Debug, Deserialize)]
pub struct ProofData {
    pub accumulator: String,  // 384 bytes hex (without 0x)
    pub proof: String,        // 1376 bytes hex (without 0x)
}

/// High-level struct for proof generation result
#[derive(Debug)]
pub struct GeneratedProof {
    pub proof_id: String,
    pub user_public_values: Vec<u8>,  // 32 bytes
    pub accumulator: Vec<u8>,          // 384 bytes
    pub proof_data: Vec<u8>,           // 1376 bytes
    pub app_exe_commit: Vec<u8>,       // 32 bytes
    pub app_vm_commit: Vec<u8>,        // 32 bytes
    pub full_json: serde_json::Value,  // Full proof JSON
}

/// Parse EVM proof into format ready for smart contract submission
fn parse_evm_proof(proof_id: String, evm_proof: EvmProof) -> Result<GeneratedProof> {
    // Helper to decode hex string (with or without 0x prefix)
    fn decode_hex(s: &str) -> Result<Vec<u8>> {
        let s = s.strip_prefix("0x").unwrap_or(s);
        hex::decode(s).map_err(|e| anyhow!("Failed to decode hex: {}", e))
    }
    
    // Decode all fields
    let user_public_values = decode_hex(&evm_proof.user_public_values)?;
    let accumulator = decode_hex(&evm_proof.proof_data.accumulator)?;
    let proof_data = decode_hex(&evm_proof.proof_data.proof)?;
    let app_exe_commit = decode_hex(&evm_proof.app_exe_commit)?;
    let app_vm_commit = decode_hex(&evm_proof.app_vm_commit)?;
    
    // Validate lengths
    if user_public_values.len() != 32 {
        return Err(anyhow!("Invalid user_public_values length: expected 32, got {}", user_public_values.len()));
    }
    if accumulator.len() != 384 {
        return Err(anyhow!("Invalid accumulator length: expected 384, got {}", accumulator.len()));
    }
    if proof_data.len() != 1376 {
        return Err(anyhow!("Invalid proof length: expected 1376, got {}", proof_data.len()));
    }
    if app_exe_commit.len() != 32 {
        return Err(anyhow!("Invalid app_exe_commit length: expected 32, got {}", app_exe_commit.len()));
    }
    if app_vm_commit.len() != 32 {
        return Err(anyhow!("Invalid app_vm_commit length: expected 32, got {}", app_vm_commit.len()));
    }
    
    // Create full JSON (preserve original structure)
    let full_json = serde_json::json!({
        "version": evm_proof.version,
        "app_exe_commit": evm_proof.app_exe_commit,
        "app_vm_commit": evm_proof.app_vm_commit,
        "user_public_values": evm_proof.user_public_values,
        "proof_data": {
            "accumulator": evm_proof.proof_data.accumulator,
            "proof": evm_proof.proof_data.proof
        }
    });
    
    Ok(GeneratedProof {
        proof_id,
        user_public_values,
        accumulator,
        proof_data,
        app_exe_commit,
        app_vm_commit,
        full_json,
    })
}

// ============================================================================
// Execution API Methods (for fast validation)
// ============================================================================

impl AxiomProver {
    /// Submit an execution request to Axiom (fast validation mode)
    async fn submit_execution_request(&self, input_streams: Vec<String>) -> Result<String> {
        let request_body = serde_json::json!({
            "input": input_streams,
        });
        
        let response = self.client
            .post(format!("{}/v1/executions", AXIOM_API_BASE))
            .query(&[
                ("program_id", self.program_id.as_str()),
                ("mode", "pure"),  // pure mode = only public values
            ])
            .header("Axiom-API-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to submit execution request ({}): {}", status, error_text));
        }
        
        let response_text = response.text().await?;
        tracing::debug!("Axiom Execution API response: {}", response_text);
        
        let submit_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| anyhow!("Failed to parse Axiom response: {}. Response: {}", e, response_text))?;
        
        let execution_id = submit_response["id"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing 'id' field in execution response"))?;
        
        Ok(execution_id.to_string())
    }
    
    /// Poll execution status until completion or timeout
    async fn poll_execution_status(&self, execution_id: &str) -> Result<()> {
        let max_attempts = 60; // 60 attempts * 10 seconds = 10 minutes max
        let mut attempt = 0;
        let mut delay_secs = 10;
        
        loop {
            attempt += 1;
            if attempt > max_attempts {
                return Err(anyhow!("Execution timed out after {} attempts", max_attempts));
            }
            
            let response = self.client
                .get(format!("{}/v1/executions/{}", AXIOM_API_BASE, execution_id))
                .header("Axiom-API-Key", &self.api_key)
                .send()
                .await?;
            
            if !response.status().is_success() {
                let status = response.status();
                let error_text = response.text().await?;
                return Err(anyhow!("Failed to poll execution status ({}): {}", status, error_text));
            }
            
            let response_text = response.text().await?;
            let status_response: serde_json::Value = serde_json::from_str(&response_text)
                .map_err(|e| anyhow!("Failed to parse execution status: {}. Response: {}", e, response_text))?;
            
            // Axiom uses "status" field, not "state"
            let status = status_response["status"].as_str().unwrap_or("Unknown");
            
            // Log full response for debugging
            tracing::debug!("📊 Execution status response (attempt {}): {}", attempt, response_text);
            
            match status {
                "Succeeded" => {
                    tracing::info!("✅ Execution completed after {} attempts", attempt);
                    return Ok(());
                }
                "Failed" => {
                    let error_msg = status_response["error_message"]
                        .as_str()
                        .unwrap_or("Unknown error");
                    return Err(anyhow!("Execution failed: {}", error_msg));
                }
                // In-progress states
                "Queued" | "Executing" | "Executed" | "Running" | "Pending" => {
                    tracing::info!("⏳ Execution status: {} (attempt {}/{})", status, attempt, max_attempts);
                    sleep(Duration::from_secs(delay_secs)).await;
                    
                    // Exponential backoff (cap at 30 seconds)
                    if delay_secs < 30 {
                        delay_secs = (delay_secs * 3 / 2).min(30);
                    }
                }
                _ => {
                    tracing::warn!("⚠️  Unknown execution status: {} - Full response: {}", status, response_text);
                    sleep(Duration::from_secs(delay_secs)).await;
                }
            }
        }
    }
    
    /// Get execution result (includes public_values)
    async fn get_execution_result(&self, execution_id: &str) -> Result<serde_json::Value> {
        let response = self.client
            .get(format!("{}/v1/executions/{}", AXIOM_API_BASE, execution_id))
            .header("Axiom-API-Key", &self.api_key)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to get execution result ({}): {}", status, error_text));
        }
        
        Ok(response.json().await?)
    }
}
