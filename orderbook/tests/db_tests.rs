// zkAliPay Orderbook - Database Tests
// Tests for database event synchronization and data integrity

use sqlx::PgPool;
use zkalipay_orderbook::db::{
    Database,
    orders::{OrderRepository, PostgresOrderRepository},
    trades::{TradeRepository, PostgresTradeRepository},
    models::{DbOrder, DbTrade},
};

fn test_database_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook_test".to_string())
}

async fn setup_test_pool() -> PgPool {
    PgPool::connect(&test_database_url()).await.unwrap()
}

// ============================================================================
// Database Connection Tests
// ============================================================================

#[tokio::test]
async fn test_database_connection() {
    let db = Database::new(&test_database_url()).await;
    assert!(db.is_ok(), "Failed to connect to test database");
}

#[tokio::test]
async fn test_health_check() {
    let db = Database::new(&test_database_url()).await.unwrap();
    let result = db.health_check().await;
    assert!(result.is_ok(), "Health check failed");
}
