use std::env;
use std::sync::Arc;
use std::time::Duration;
use tokio::time;
use tracing::{error, info, warn};
use tracing_subscriber;

use zkalipay_orderbook::blockchain::client::EthereumClient;
use zkalipay_orderbook::blockchain::types;
use zkalipay_orderbook::db::Database;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_target(false)
        .with_thread_ids(false)
        .with_level(true)
        .init();

    info!("🤖 Starting Auto-Cancel Service...");

    // Load configuration from environment variables
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    
    let escrow_address = env::var("ESCROW_CONTRACT_ADDRESS")
        .expect("ESCROW_CONTRACT_ADDRESS must be set");
    
    let relayer_private_key = env::var("RELAYER_PRIVATE_KEY")
        .expect("RELAYER_PRIVATE_KEY must be set");

    // Hardcoded Base Sepolia configuration
    let rpc_url = "https://sepolia.base.org";
    let chain_id: u64 = 84532; // Base Sepolia Chain ID

    // Parse escrow address
    let escrow_address: ethers::types::Address = escrow_address.parse()
        .expect("Invalid ESCROW_CONTRACT_ADDRESS");

    // Initialize database
    info!("📊 Connecting to database...");
    let db = Arc::new(Database::new(&database_url).await?);
    info!("✅ Database connected");

    // Initialize blockchain client
    info!("⛓️  Connecting to blockchain...");
    let blockchain_client = Arc::new(
        EthereumClient::new(
            &rpc_url,
            &relayer_private_key,
            escrow_address,
            chain_id,
        )
        .await?
    );
    info!("✅ Blockchain client connected");
    info!("🔑 Relayer address: {:#x}", blockchain_client.relayer_address());
    info!("⛓️  Chain ID: {}", chain_id);

    // Main loop: check for expired trades every 60 seconds
    let mut interval = time::interval(Duration::from_secs(60));

    info!("🚀 Auto-cancel service running. Checking for expired trades every 60 seconds...");

    loop {
        interval.tick().await;

        match check_and_cancel_expired_trades(&db, &blockchain_client).await {
            Ok(cancelled_count) => {
                if cancelled_count > 0 {
                    info!("✅ Cancelled {} expired trade(s)", cancelled_count);
                }
            }
            Err(e) => {
                error!("❌ Error checking/cancelling expired trades: {}", e);
            }
        }
    }
}

async fn check_and_cancel_expired_trades(
    db: &Arc<Database>,
    blockchain_client: &Arc<EthereumClient>,
) -> Result<usize, Box<dyn std::error::Error>> {
    // Get current timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    // Query database for expired trades (status = 0 = PENDING, expiresAt < now)
    let expired_trades = sqlx::query!(
        r#"
        SELECT "tradeId", "expiresAt"
        FROM trades
        WHERE "status" = 0
        AND "expiresAt" < $1
        ORDER BY "expiresAt" ASC
        LIMIT 100
        "#,
        now
    )
    .fetch_all(db.pool())
    .await?;

    if expired_trades.is_empty() {
        // No expired trades
        return Ok(0);
    }

    info!("🔍 Found {} expired trade(s) to cancel", expired_trades.len());

    let mut cancelled_count = 0;

    for trade in expired_trades {
        let trade_id_str = &trade.tradeId;
        let expires_at = trade.expiresAt;

        info!(
            "⏰ Cancelling expired trade: {} (expired at: {})",
            trade_id_str, expires_at
        );

        // Convert trade ID from hex string to bytes32
        let trade_id_bytes = match types::trade_id_to_bytes32(trade_id_str) {
            Ok(bytes) => bytes,
            Err(e) => {
                error!("❌ Invalid trade ID format {}: {}", trade_id_str, e);
                continue;
            }
        };

        // Call smart contract to cancel the trade
        match blockchain_client.cancel_expired_trade(trade_id_bytes).await {
            Ok(tx_hash) => {
                info!(
                    "✅ Trade {} cancelled successfully. TX: {:#x}",
                    trade_id_str, tx_hash
                );
                cancelled_count += 1;
            }
            Err(e) => {
                // Log error but continue with other trades
                // (trade might have already been cancelled, settled, or other edge case)
                warn!(
                    "⚠️  Failed to cancel trade {}: {}",
                    trade_id_str, e
                );
            }
        }
    }

    Ok(cancelled_count)
}

