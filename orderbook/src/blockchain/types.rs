// Blockchain-specific types and helpers

use ethers::prelude::*;
use ethers::abi::Token;
use serde::{Deserialize, Serialize};
use anyhow::Result;

/// Payment details structure for contract interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentDetails {
    pub payee_alipay_id: String,
    pub payee_alipay_name: String,
    pub amount: u64,  // CNY cents
    pub note: String,  // Payment nonce
}

/// Encode payment details for contract submission
/// Returns ABI-encoded bytes for (string, string, uint256, string)
pub fn encode_payment_details(
    payee_alipay_id: &str,
    payee_alipay_name: &str,
    amount_cny_cents: u64,
    note: &str,
) -> Result<Vec<u8>> {
    // ABI encode the payment details struct
    // struct PaymentDetails { string payeeAlipayId; string payeeAlipayName; uint256 amount; string note; }
    
    let tokens = vec![
        Token::String(payee_alipay_id.to_string()),
        Token::String(payee_alipay_name.to_string()),
        Token::Uint(U256::from(amount_cny_cents)),
        Token::String(note.to_string()),
    ];
    
    // Encode as tuple
    let encoded = ethers::abi::encode(&[Token::Tuple(tokens)]);
    
    Ok(encoded)
}

/// Convert order ID string to bytes32
pub fn order_id_to_bytes32(order_id: &str) -> Result<[u8; 32]> {
    // Remove "0x" or "ord_" prefix if present
    let hex_str = order_id
        .strip_prefix("0x")
        .or_else(|| order_id.strip_prefix("ord_"))
        .unwrap_or(order_id);
    
    // Parse as hex
    let bytes = hex::decode(hex_str)?;
    
    if bytes.len() != 32 {
        return Err(anyhow::anyhow!("Order ID must be 32 bytes, got {}", bytes.len()));
    }
    
    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes);
    
    Ok(result)
}

/// Convert trade ID string to bytes32
pub fn trade_id_to_bytes32(trade_id: &str) -> Result<[u8; 32]> {
    // Remove "0x" or "trade_" prefix if present
    let hex_str = trade_id
        .strip_prefix("0x")
        .or_else(|| trade_id.strip_prefix("trade_"))
        .unwrap_or(trade_id);
    
    // Parse as hex
    let bytes = hex::decode(hex_str)?;
    
    if bytes.len() != 32 {
        return Err(anyhow::anyhow!("Trade ID must be 32 bytes, got {}", bytes.len()));
    }
    
    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes);
    
    Ok(result)
}

/// Convert bytes32 to hex string with prefix
pub fn bytes32_to_order_id(bytes: [u8; 32]) -> String {
    format!("ord_{}", hex::encode(bytes))
}

/// Convert bytes32 to hex string with prefix
pub fn bytes32_to_trade_id(bytes: [u8; 32]) -> String {
    format!("trade_{}", hex::encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_encode_payment_details() {
        let encoded = encode_payment_details(
            "test_account_123",
            "TestUser",
            72000, // 720 CNY in cents
            "nonce_abc123"
        );
        
        assert!(encoded.is_ok());
        let encoded = encoded.unwrap();
        assert!(encoded.len() > 0);
        
        println!("✅ Payment details encoded: {} bytes", encoded.len());
    }
    
    #[test]
    fn test_order_id_conversion() {
        let bytes = [1u8; 32];
        let order_id = bytes32_to_order_id(bytes);
        
        assert!(order_id.starts_with("ord_"));
        assert_eq!(order_id.len(), 4 + 64); // "ord_" + 64 hex chars
        
        // Convert back
        let bytes_back = order_id_to_bytes32(&order_id).unwrap();
        assert_eq!(bytes, bytes_back);
        
        println!("✅ Order ID conversion: {}", order_id);
    }
    
    #[test]
    fn test_trade_id_conversion() {
        let bytes = [2u8; 32];
        let trade_id = bytes32_to_trade_id(bytes);
        
        assert!(trade_id.starts_with("trade_"));
        assert_eq!(trade_id.len(), 6 + 64); // "trade_" + 64 hex chars
        
        // Convert back
        let bytes_back = trade_id_to_bytes32(&trade_id).unwrap();
        assert_eq!(bytes, bytes_back);
        
        println!("✅ Trade ID conversion: {}", trade_id);
    }
}
