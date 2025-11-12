use axum::{
    extract::{Path, Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

use crate::api::{
    error::ApiResult,
    state::AppState,
    matching::{match_buy_intent, MatchPlan},
};

/// Request to match a buy intent
#[derive(Debug, Deserialize)]
pub struct MatchBuyRequest {
    /// Token address to buy (ERC20 contract address)
    pub token_address: String,
    
    /// Amount of tokens to buy (in base units, e.g., "100000000" for 100 USDC)
    pub desired_amount: String,
    
    /// Maximum exchange rate (CNY cents per token, optional)
    pub max_rate: Option<String>,
}

/// Query parameters for listing orders
#[derive(Debug, Deserialize)]
pub struct OrderQueryParams {
    /// Maximum number of orders to return
    pub limit: Option<i64>,
    
    /// Filter by seller address (optional)
    pub seller: Option<String>,
}

/// Order response DTO
#[derive(Debug, Serialize)]
pub struct OrderDto {
    pub order_id: String,
    pub seller: String,
    pub token: String,
    pub total_amount: String,
    pub remaining_amount: String,
    pub exchange_rate: String,
    pub alipay_id: String,
    pub alipay_name: String,
    pub created_at: i64,
}

/// List of orders response
#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub orders: Vec<OrderDto>,
    pub total: usize,
}

/// Get list of active sell orders
pub async fn get_active_orders(
    State(state): State<AppState>,
    Query(params): Query<OrderQueryParams>,
) -> ApiResult<Json<OrderListResponse>> {
    let orders = if let Some(seller) = params.seller {
        // Get orders by seller
        state.db.get_orders_by_seller(&seller).await?
    } else {
        // Get all active orders
        state.db.get_active_orders(params.limit).await?
    };
    
    let order_dtos: Vec<OrderDto> = orders
        .into_iter()
        .map(|o| OrderDto {
            order_id: o.order_id,
            seller: o.seller,
            token: o.token,
            total_amount: o.total_amount,
            remaining_amount: o.remaining_amount,
            exchange_rate: o.exchange_rate,
            alipay_id: o.alipay_id,
            alipay_name: o.alipay_name,
            created_at: o.created_at,
        })
        .collect();
    
    let total = order_dtos.len();
    
    Ok(Json(OrderListResponse {
        orders: order_dtos,
        total,
    }))
}

/// Get single order by ID
pub async fn get_order(
    State(state): State<AppState>,
    Path(order_id): Path<String>,
) -> ApiResult<Json<OrderDto>> {
    let order = state.db.get_order(&order_id).await?;
    
    Ok(Json(OrderDto {
        order_id: order.order_id,
        seller: order.seller,
        token: order.token,
        total_amount: order.total_amount,
        remaining_amount: order.remaining_amount,
        exchange_rate: order.exchange_rate,
        alipay_id: order.alipay_id,
        alipay_name: order.alipay_name,
        created_at: order.created_at,
    }))
}

/// Match a buy intent against available orders
pub async fn match_buy_intent_handler(
    State(state): State<AppState>,
    Json(req): Json<MatchBuyRequest>,
) -> ApiResult<Json<MatchPlan>> {
    // Parse desired amount
    let desired_amount = Decimal::from_str(&req.desired_amount)
        .map_err(|e| crate::api::error::ApiError::BadRequest(format!("Invalid amount: {}", e)))?;
    
    // Parse max rate if provided
    let max_rate = if let Some(rate_str) = req.max_rate {
        Some(Decimal::from_str(&rate_str)
            .map_err(|e| crate::api::error::ApiError::BadRequest(format!("Invalid rate: {}", e)))?)
    } else {
        None
    };
    
    // Fetch active orders from DB filtered by token address
    let orders = state.db.get_active_orders_by_token(&req.token_address, Some(100)).await?;
    
    // Match buy intent
    let match_plan = match_buy_intent(orders, desired_amount, max_rate)
        .map_err(|e| crate::api::error::ApiError::BadRequest(e.to_string()))?;
    
    Ok(Json(match_plan))
}
