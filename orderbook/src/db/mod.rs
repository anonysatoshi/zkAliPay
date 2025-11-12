pub mod models;
pub mod orders;
pub mod trades;

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use thiserror::Error;
use chrono::{DateTime, Utc};
use orders::OrderRepository;
use trades::TradeRepository;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    SqlxError(#[from] sqlx::Error),
    
    #[error("Migration error: {0}")]
    MigrationError(#[from] sqlx::migrate::MigrateError),
    
    #[error("Order not found: {0}")]
    OrderNotFound(String),
    
    #[error("Trade not found: {0}")]
    TradeNotFound(String),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

pub type DbResult<T> = Result<T, DbError>;

/// Database connection manager for on-chain event tracking
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Create a new database connection from URL
    pub async fn new(database_url: &str) -> DbResult<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .min_connections(2)
            .acquire_timeout(Duration::from_secs(30))
            .idle_timeout(Duration::from_secs(600))
            .max_lifetime(Duration::from_secs(1800))
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    /// Get the connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Run database migrations
    pub async fn migrate(&self) -> DbResult<()> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await?;
        Ok(())
    }

    /// Health check - verify database is accessible
    pub async fn health_check(&self) -> DbResult<()> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Close all connections
    pub async fn close(&self) {
        self.pool.close().await;
    }
    
    /// Get all active orders (convenience method for API)
    pub async fn get_active_orders(&self, limit: Option<i64>) -> DbResult<Vec<models::DbOrder>> {
        let repo = orders::PostgresOrderRepository::new(self.pool.clone());
        repo.get_active_orders(limit).await
    }
    
    /// Get active orders filtered by token (convenience method for API)
    pub async fn get_active_orders_by_token(&self, token_address: &str, limit: Option<i64>) -> DbResult<Vec<models::DbOrder>> {
        let repo = orders::PostgresOrderRepository::new(self.pool.clone());
        repo.get_active_orders_by_token(token_address, limit).await
    }
    
    /// Get single order by ID (convenience method for API)
    pub async fn get_order(&self, order_id: &str) -> DbResult<models::DbOrder> {
        let repo = orders::PostgresOrderRepository::new(self.pool.clone());
        repo.get(order_id).await
    }
    
    /// Get orders by seller (convenience method for API)
    pub async fn get_orders_by_seller(&self, seller: &str) -> DbResult<Vec<models::DbOrder>> {
        let repo = orders::PostgresOrderRepository::new(self.pool.clone());
        repo.get_by_seller(seller).await
    }
    
    /// Get single trade by ID (convenience method for API)
    pub async fn get_trade(&self, trade_id: &str) -> DbResult<models::DbTrade> {
        let repo = trades::PostgresTradeRepository::new(self.pool.clone());
        repo.get(trade_id).await
    }
    
    /// Save PDF for a trade (convenience method for API)
    pub async fn save_trade_pdf(&self, trade_id: &str, pdf_data: &[u8], filename: &str) -> DbResult<DateTime<Utc>> {
        let repo = trades::PostgresTradeRepository::new(self.pool.clone());
        repo.save_pdf(trade_id, pdf_data, filename).await
    }
    
    /// Save proof for a trade (convenience method for API)
    pub async fn save_trade_proof(&self, trade_id: &str, user_public_values: &[u8], accumulator: &[u8], proof_data: &[u8], axiom_proof_id: &str, proof_json: &str) -> DbResult<()> {
        let repo = trades::PostgresTradeRepository::new(self.pool.clone());
        repo.save_proof(trade_id, user_public_values, accumulator, proof_data, axiom_proof_id, proof_json).await
    }
}
