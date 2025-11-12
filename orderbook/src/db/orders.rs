use async_trait::async_trait;
use sqlx::PgPool;
use rust_decimal::Decimal;
use std::str::FromStr;

use super::{DbError, DbResult};
use super::models::DbOrder;

/// Repository for Order operations - ONLY methods needed for event sync
#[async_trait]
pub trait OrderRepository: Send + Sync {
    /// Insert new order from OrderCreatedAndLocked event
    async fn create(&self, order: &DbOrder) -> DbResult<()>;
    
    /// Adjust order remaining amount by delta (+ or -)
    /// Used by: OrderPartiallyWithdrawn (negative), TradeCreated (negative), TradeExpired (positive)
    /// Positive delta: add funds back (e.g. TradeExpired)
    /// Negative delta: subtract funds (e.g. OrderPartiallyWithdrawn, TradeCreated)
    async fn adjust_remaining_amount(&self, order_id: &str, delta: &str) -> DbResult<()>;
}

pub struct PostgresOrderRepository {
    pool: PgPool,
}

impl PostgresOrderRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    /// Get all active orders (remainingAmount > 0) sorted by exchange rate
    /// Used by API for matching and order list queries
    pub async fn get_active_orders(&self, limit: Option<i64>) -> DbResult<Vec<DbOrder>> {
        let limit = limit.unwrap_or(100);
        
        let orders = sqlx::query_as!(
            DbOrder,
            r#"
            SELECT 
                "orderId" as "order_id!",
                seller as "seller!",
                token as "token!",
                "totalAmount"::TEXT as "total_amount!",
                "remainingAmount"::TEXT as "remaining_amount!",
                "exchangeRate"::TEXT as "exchange_rate!",
                "alipayId" as "alipay_id!",
                "alipayName" as "alipay_name!",
                "createdAt" as "created_at!",
                "syncedAt" as "synced_at!"
            FROM orders
            WHERE "remainingAmount" > 0
            ORDER BY "exchangeRate" ASC, "createdAt" ASC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(orders)
    }
    
    /// Get active orders filtered by token address (case-insensitive)
    /// Used by API for token-specific matching
    pub async fn get_active_orders_by_token(&self, token_address: &str, limit: Option<i64>) -> DbResult<Vec<DbOrder>> {
        let limit = limit.unwrap_or(100);
        let token_lower = token_address.to_lowercase();
        
        let orders = sqlx::query_as!(
            DbOrder,
            r#"
            SELECT 
                "orderId" as "order_id!",
                seller as "seller!",
                token as "token!",
                "totalAmount"::TEXT as "total_amount!",
                "remainingAmount"::TEXT as "remaining_amount!",
                "exchangeRate"::TEXT as "exchange_rate!",
                "alipayId" as "alipay_id!",
                "alipayName" as "alipay_name!",
                "createdAt" as "created_at!",
                "syncedAt" as "synced_at!"
            FROM orders
            WHERE "remainingAmount" > 0
            AND LOWER(token) = $1
            ORDER BY "exchangeRate" ASC, "createdAt" ASC
            LIMIT $2
            "#,
            token_lower,
            limit
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(orders)
    }
    
    /// Get single order by ID
    pub async fn get(&self, order_id: &str) -> DbResult<DbOrder> {
        let order = sqlx::query_as!(
            DbOrder,
            r#"
            SELECT 
                "orderId" as "order_id!",
                seller as "seller!",
                token as "token!",
                "totalAmount"::TEXT as "total_amount!",
                "remainingAmount"::TEXT as "remaining_amount!",
                "exchangeRate"::TEXT as "exchange_rate!",
                "alipayId" as "alipay_id!",
                "alipayName" as "alipay_name!",
                "createdAt" as "created_at!",
                "syncedAt" as "synced_at!"
            FROM orders
            WHERE "orderId" = $1
            "#,
            order_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| DbError::OrderNotFound(order_id.to_string()))?;
        
        Ok(order)
    }
    
    /// Get orders by seller
    pub async fn get_by_seller(&self, seller: &str) -> DbResult<Vec<DbOrder>> {
        let orders = sqlx::query_as!(
            DbOrder,
            r#"
            SELECT 
                "orderId" as "order_id!",
                seller as "seller!",
                token as "token!",
                "totalAmount"::TEXT as "total_amount!",
                "remainingAmount"::TEXT as "remaining_amount!",
                "exchangeRate"::TEXT as "exchange_rate!",
                "alipayId" as "alipay_id!",
                "alipayName" as "alipay_name!",
                "createdAt" as "created_at!",
                "syncedAt" as "synced_at!"
            FROM orders
            WHERE seller = $1
            ORDER BY "createdAt" DESC
            "#,
            seller
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(orders)
    }
}

#[async_trait]
impl OrderRepository for PostgresOrderRepository {
    async fn create(&self, order: &DbOrder) -> DbResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO orders (
                "orderId", "seller", "token", "totalAmount", "remainingAmount",
                "exchangeRate", "alipayId", "alipayName", "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT ("orderId") DO NOTHING
            "#,
            order.order_id,
            order.seller,
            order.token,
            Decimal::from_str(&order.total_amount).unwrap(),
            Decimal::from_str(&order.remaining_amount).unwrap(),
            Decimal::from_str(&order.exchange_rate).unwrap(),
            order.alipay_id,
            order.alipay_name,
            order.created_at
        )
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    async fn adjust_remaining_amount(&self, order_id: &str, delta: &str) -> DbResult<()> {
        let delta_decimal = Decimal::from_str(delta)
            .map_err(|e| DbError::InvalidInput(format!("Invalid delta: {}", e)))?;
        
        let result = sqlx::query!(
            r#"
            UPDATE orders 
            SET "remainingAmount" = "remainingAmount" + $1
            WHERE "orderId" = $2
            "#,
            delta_decimal,
            order_id
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::OrderNotFound(order_id.to_string()));
        }

        Ok(())
    }
}
