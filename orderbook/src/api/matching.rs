use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

use crate::db::models::DbOrder;

#[derive(Debug, Error)]
pub enum MatchError {
    #[error("Insufficient liquidity: requested {requested}, available {available}")]
    InsufficientLiquidity { requested: Decimal, available: Decimal },
    
    #[error("Invalid amount: {0}")]
    InvalidAmount(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
}

pub type MatchResult<T> = Result<T, MatchError>;

/// Result of matching a buy intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchPlan {
    /// List of fills needed to complete the buy
    pub fills: Vec<Fill>,
    
    /// Total token amount that can be filled
    pub total_filled: String,  // Decimal as string
    
    /// Whether the full amount can be filled
    pub fully_fillable: bool,
}

/// A single fill in the match plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fill {
    /// Order to fill
    pub order_id: String,
    
    /// Seller address
    pub seller: String,
    
    /// Amount to fill from this order (in token base units)
    pub fill_amount: String,  // Decimal as string
    
    /// Exchange rate for this fill (CNY cents per token)
    pub exchange_rate: String,  // Decimal as string
    
    /// Seller's Alipay details
    pub alipay_id: String,
    pub alipay_name: String,
    
    /// Token address
    pub token: String,
}

/// Match a buy intent against available orders
pub fn match_buy_intent(
    orders: Vec<DbOrder>,
    desired_amount: Decimal,
    max_rate: Option<Decimal>,
) -> MatchResult<MatchPlan> {
    if desired_amount <= Decimal::ZERO {
        return Err(MatchError::InvalidAmount("Amount must be positive".to_string()));
    }
    
    let mut fills = Vec::new();
    let mut remaining = desired_amount;
    
    for order in orders {
        // Parse order rate
        let order_rate = Decimal::from_str(&order.exchange_rate)
            .map_err(|e| MatchError::ParseError(format!("Invalid exchange rate: {}", e)))?;
        
        // Check max rate filter
        if let Some(max) = max_rate {
            if order_rate > max {
                break;  // Orders are sorted by rate, so we can stop here
            }
        }
        
        if remaining <= Decimal::ZERO {
            break;
        }
        
        // Parse order remaining amount
        let order_remaining = Decimal::from_str(&order.remaining_amount)
            .map_err(|e| MatchError::ParseError(format!("Invalid remaining amount: {}", e)))?;
        
        // Calculate fill amount (minimum of remaining and order available)
        let fill_amount = remaining.min(order_remaining);
        
        fills.push(Fill {
            order_id: order.order_id.clone(),
            seller: order.seller.clone(),
            fill_amount: fill_amount.to_string(),
            exchange_rate: order_rate.to_string(),
            alipay_id: order.alipay_id.clone(),
            alipay_name: order.alipay_name.clone(),
            token: order.token.clone(),
        });
        
        remaining -= fill_amount;
    }
    
    let total_filled = desired_amount - remaining;
    let fully_fillable = remaining == Decimal::ZERO;
    
    if fills.is_empty() {
        return Err(MatchError::InsufficientLiquidity {
            requested: desired_amount,
            available: Decimal::ZERO,
        });
    }
    
    Ok(MatchPlan {
        fills,
        total_filled: total_filled.to_string(),
        fully_fillable,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    
    fn create_test_order(order_id: &str, remaining: &str, rate: &str) -> DbOrder {
        DbOrder {
            order_id: order_id.to_string(),
            seller: "0x123".to_string(),
            token: "0xUSDC".to_string(),
            total_amount: remaining.to_string(),
            remaining_amount: remaining.to_string(),
            exchange_rate: rate.to_string(),
            alipay_id: "test_id".to_string(),
            alipay_name: "Test Name".to_string(),
            created_at: 1234567890,
            synced_at: Utc::now(),
        }
    }
    
    #[test]
    fn test_match_single_order_full_fill() {
        let orders = vec![
            create_test_order("0x1", "100000000", "735"),  // 100 USDC at 7.35 CNY/USDC
        ];
        
        let desired = Decimal::from(100_000_000);  // Want 100 USDC
        let result = match_buy_intent(orders, desired, None).unwrap();
        
        assert_eq!(result.fills.len(), 1);
        assert_eq!(result.fully_fillable, true);
        assert_eq!(result.total_filled, "100000000");
    }
    
    #[test]
    fn test_match_multiple_orders() {
        let orders = vec![
            create_test_order("0x1", "50000000", "730"),  // 50 USDC at 7.30 (best rate)
            create_test_order("0x2", "60000000", "735"),  // 60 USDC at 7.35
            create_test_order("0x3", "100000000", "740"), // 100 USDC at 7.40
        ];
        
        let desired = Decimal::from(100_000_000);  // Want 100 USDC
        let result = match_buy_intent(orders, desired, None).unwrap();
        
        assert_eq!(result.fills.len(), 2);  // Should fill from first two orders
        assert_eq!(result.fully_fillable, true);
    }
    
    #[test]
    fn test_match_with_max_rate() {
        let orders = vec![
            create_test_order("0x1", "50000000", "730"),  
            create_test_order("0x2", "60000000", "735"),  
            create_test_order("0x3", "100000000", "750"), // Above max rate
        ];
        
        let desired = Decimal::from(200_000_000);
        let max_rate = Some(Decimal::from(740));
        let result = match_buy_intent(orders, desired, max_rate).unwrap();
        
        assert_eq!(result.fills.len(), 2);  // Should only use first two
        assert_eq!(result.fully_fillable, false);  // Can't fill full amount
    }
}

