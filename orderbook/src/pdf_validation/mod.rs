use sha2::{Sha256, Digest};
use std::process::Command;
use std::fs;
use std::path::PathBuf;
use tempfile::NamedTempFile;
use serde::{Deserialize, Serialize};
use openvm::serde::to_vec as openvm_serialize;

#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Failed to compute expected hash: {0}")]
    HashComputation(String),
    
    #[error("Failed to run OpenVM: {0}")]
    OpenVmExecution(String),
    
    #[error("Failed to write temporary file: {0}")]
    FileWrite(#[from] std::io::Error),
    
    #[error("Invalid output format: {0}")]
    InvalidOutput(String),
    
    #[error("OpenVM CLI not found or not executable")]
    OpenVmNotFound,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfValidationRequest {
    pub pdf_bytes: Vec<u8>,
    pub alipay_name: String,
    pub alipay_id: String,
    pub cny_amount_cents: u64,
    pub payment_nonce: String,
    pub public_key_der_hash: String, // hex string without 0x prefix
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfValidationResult {
    pub is_valid: bool,
    pub expected_hash: String,
    pub actual_hash: String,
    pub details: String,
}

/// Compute expected output hash using the same logic as ZkAliPayEscrow.sol
pub fn compute_expected_hash(
    alipay_name: &str,
    alipay_id: &str,
    cny_amount_cents: u64,
    payment_nonce: &str,
    public_key_der_hash: &str,
) -> Result<String, ValidationError> {
    // Hardcoded line numbers: 20, 21, 29, 32
    let line_numbers: [u32; 4] = [20, 21, 29, 32];
    
    // Format CNY amount: 106000 cents → "1060.00"
    let cny_formatted = format_cny_amount(cny_amount_cents);
    
    // Mask Alipay ID: show first 3 and last 2 digits, mask middle 6
    let masked_alipay_id = mask_alipay_id(alipay_id)?;
    
    tracing::info!("🔍 compute_expected_hash inputs: name='{}', id='{}', amount_cents={}, formatted='{}', nonce='{}', pk_hash='{}'",
        alipay_name, alipay_id, cny_amount_cents, cny_formatted, payment_nonce, public_key_der_hash);
    
    // Build line texts with Chinese prefixes
    let line20 = format!("账户名：{}", alipay_name);
    let line21 = format!("账号：{}", masked_alipay_id);
    let line29 = format!("小写：{}", cny_formatted);
    let line32 = payment_nonce.to_string(); // Just the nonce, no prefix
    
    // Compute lines hash (SHA256 of: line_num_0 || line_text_0 || line_num_1 || line_text_1 || ...)
    let mut lines_data = Vec::new();
    lines_data.extend_from_slice(&uint32_to_little_endian(line_numbers[0]));
    lines_data.extend_from_slice(line20.as_bytes());
    lines_data.extend_from_slice(&uint32_to_little_endian(line_numbers[1]));
    lines_data.extend_from_slice(line21.as_bytes());
    lines_data.extend_from_slice(&uint32_to_little_endian(line_numbers[2]));
    lines_data.extend_from_slice(line29.as_bytes());
    lines_data.extend_from_slice(&uint32_to_little_endian(line_numbers[3]));
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
    Ok(hex::encode(final_hash))
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

/// Convert u32 to little-endian bytes (matching Solidity's encoding)
fn uint32_to_little_endian(value: u32) -> [u8; 4] {
    value.to_le_bytes()
}

/// Generate OpenVM input streams directly (without subprocess)
/// Returns a vector of 46 hex-encoded input streams (with 0x01 prefix)
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
    
    tracing::info!("✅ Generated {} OpenVM input streams", streams.len());
    
    Ok(streams)
}

/// Generate OpenVM input streams for Axiom proof generation
/// Returns a vector of 46 hex-encoded input streams (with 0x prefix)
pub async fn generate_input_streams_for_axiom(
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
    
    // Generate streams directly (no subprocess)
    let input_streams = generate_openvm_streams(
        pdf_bytes,
        0, // page 0
        lines,
        public_key_der_hash,
    )?;
    
    tracing::info!("✅ Generated {} input streams for Axiom API", input_streams.len());
    
    Ok(input_streams)
}

/// Run OpenVM CLI mode to verify the PDF (local validation)
pub async fn run_openvm_verification(
    pdf_bytes: &[u8],
    alipay_name: &str,
    alipay_id: &str,
    cny_amount_cents: u64,
    payment_nonce: &str,
    public_key_der_hash: &str,
) -> Result<String, ValidationError> {
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
    
    // Combine into (line_number, text) pairs
    let lines: Vec<(u32, String)> = line_numbers.into_iter()
        .zip(line_texts.into_iter())
        .collect();
    
    // Step 1: Generate input streams directly (no subprocess)
    tracing::info!("Generating OpenVM input streams...");
    let input_streams = generate_openvm_streams(
        pdf_bytes,
        0, // page 0
        lines,
        public_key_der_hash,
    )?;
    
    // Step 2: Write input JSON to temp file
    let mut input_file = NamedTempFile::new()?;
    let input_json = serde_json::json!({"input": input_streams});
    let json_string = serde_json::to_string_pretty(&input_json)
        .map_err(|e| ValidationError::InvalidOutput(format!("JSON serialization failed: {}", e)))?;
    std::fs::write(input_file.path(), json_string)?;
    
    tracing::info!("Input file written to: {:?}", input_file.path());
    
    // Step 3: Run pre-compiled OpenVM binary with config
    tracing::info!("Running pre-compiled OpenVM guest program...");
    let vmexe_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("openvm-binaries/openvm-pdf-verifier.vmexe");
    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("openvm-binaries/openvm.toml");
    
    if !vmexe_path.exists() {
        return Err(ValidationError::OpenVmExecution(
            format!("OpenVM binary not found at: {:?}", vmexe_path)
        ));
    }
    
    if !config_path.exists() {
        return Err(ValidationError::OpenVmExecution(
            format!("OpenVM config not found at: {:?}", config_path)
        ));
    }
    
    let run_output = Command::new("cargo")
        .args(&[
            "openvm",
            "run",
            "--exe", vmexe_path.to_str().unwrap(),
            "--config", config_path.to_str().unwrap(),
            "--input", input_file.path().to_str().unwrap(),
        ])
        .output()
        .map_err(|e| ValidationError::OpenVmExecution(format!("Failed to run cargo openvm run: {}", e)))?;
    
    if !run_output.status.success() {
        let stderr = String::from_utf8_lossy(&run_output.stderr);
        return Err(ValidationError::OpenVmExecution(format!(
            "cargo openvm run failed: {}",
            stderr
        )));
    }
    
    // Parse output to extract the hash
    let stdout = String::from_utf8_lossy(&run_output.stdout);
    tracing::info!("OpenVM output: {}", stdout);
    
    // Look for "Execution output: [...]" line
    let output_line = stdout
        .lines()
        .find(|line| line.contains("Execution output:"))
        .ok_or_else(|| ValidationError::InvalidOutput("No execution output found".to_string()))?;
    
    // Extract the byte array
    let start = output_line.find('[').ok_or_else(|| {
        ValidationError::InvalidOutput("No opening bracket found".to_string())
    })?;
    let end = output_line.find(']').ok_or_else(|| {
        ValidationError::InvalidOutput("No closing bracket found".to_string())
    })?;
    
    let bytes_str = &output_line[start + 1..end];
    let bytes: Vec<u8> = bytes_str
        .split(',')
        .map(|s| s.trim().parse::<u8>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| ValidationError::InvalidOutput(format!("Failed to parse bytes: {}", e)))?;
    
    if bytes.len() != 32 {
        return Err(ValidationError::InvalidOutput(format!(
            "Expected 32 bytes, got {}",
            bytes.len()
        )));
    }
    
    Ok(hex::encode(bytes))
}

/// Validate PDF by comparing expected hash with OpenVM output
pub async fn validate_pdf(request: PdfValidationRequest) -> Result<PdfValidationResult, ValidationError> {
    tracing::info!(
        "Starting PDF validation for {} ({})",
        request.alipay_name,
        request.alipay_id
    );
    
    // Step 1: Compute expected hash
    let expected_hash = compute_expected_hash(
        &request.alipay_name,
        &request.alipay_id,
        request.cny_amount_cents,
        &request.payment_nonce,
        &request.public_key_der_hash,
    )?;
    
    tracing::info!("Expected hash: {}", expected_hash);
    
    // Step 2: Run OpenVM verification
    let actual_hash = run_openvm_verification(
        &request.pdf_bytes,
        &request.alipay_name,
        &request.alipay_id,
        request.cny_amount_cents,
        &request.payment_nonce,
        &request.public_key_der_hash,
    ).await?;
    
    tracing::info!("Actual hash from OpenVM: {}", actual_hash);
    
    // Step 3: Compare hashes
    let is_valid = expected_hash == actual_hash;
    
    let details = if is_valid {
        "PDF verification successful! The payment details match the uploaded PDF.".to_string()
    } else {
        format!(
            "PDF verification failed! Hash mismatch.\nExpected: {}\nActual: {}",
            expected_hash, actual_hash
        )
    };
    
    Ok(PdfValidationResult {
        is_valid,
        expected_hash,
        actual_hash,
        details,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_format_cny_amount() {
        assert_eq!(format_cny_amount(106000), "1060.00");
        assert_eq!(format_cny_amount(1), "0.01");
        assert_eq!(format_cny_amount(100), "1.00");
        assert_eq!(format_cny_amount(12345), "123.45");
    }
    
    #[test]
    fn test_mask_alipay_id() {
        assert_eq!(mask_alipay_id("13945908941").unwrap(), "139******41");
        assert_eq!(mask_alipay_id("12345678901").unwrap(), "123******01");
    }
    
    #[test]
    fn test_mask_alipay_id_invalid_length() {
        assert!(mask_alipay_id("123").is_err());
        assert!(mask_alipay_id("12345678901234").is_err());
    }
    
    #[test]
    fn test_uint32_to_little_endian() {
        assert_eq!(uint32_to_little_endian(20), [20, 0, 0, 0]);
        assert_eq!(uint32_to_little_endian(256), [0, 1, 0, 0]);
    }
}

