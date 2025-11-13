use std::env;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use zkalipay_orderbook::{AppState, create_router};
use zkalipay_orderbook::blockchain::client::EthereumClient;
use zkalipay_orderbook::blockchain::events::EventListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,zkalipay_orderbook=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Get configuration from environment
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://zkalipay:zkalipay_dev_password@localhost:5432/zkalipay_orderbook".to_string());
    
    let host = env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    // Railway provides PORT, but we also support API_PORT for local development
    let port = env::var("PORT")
        .or_else(|_| env::var("API_PORT"))
        .unwrap_or_else(|_| "3000".to_string());
    let addr = format!("{}:{}", host, port);

    tracing::info!("Starting zkAliPay Order Book API Server");
    tracing::info!("Database: {}", database_url);
    tracing::info!("Listening on: {}", addr);

    // Create application state
    tracing::info!("Initializing application state...");
    let mut state = AppState::new(&database_url).await?;
    tracing::info!("Application state initialized successfully");

    // Initialize blockchain client if environment variables are set
    if let (Ok(escrow_addr), Ok(relayer_key)) = (
        env::var("ESCROW_CONTRACT_ADDRESS"),
        env::var("RELAYER_PRIVATE_KEY"),
    ) {
        tracing::info!("Blockchain environment variables detected, initializing Ethereum client...");
        
        // Hardcoded Base Sepolia configuration
        let rpc_url = "https://sepolia.base.org";
        let usdc_addr = "0xd4B280FFB336e2061cB39347Bd599cB88FF1617A"; // MockUSDC on Base Sepolia
        let chain_id: u64 = 84532; // Base Sepolia Chain ID
        
        // Parse addresses
        let escrow_address: ethers::types::Address = escrow_addr.parse()?;
        let usdc_address: ethers::types::Address = usdc_addr.parse()?;
        
        match EthereumClient::new(
            &rpc_url,
            &relayer_key,
            escrow_address,
            usdc_address,
            chain_id,
        ).await {
            Ok(eth_client) => {
                state = state.with_blockchain_client(Arc::new(eth_client));
                tracing::info!("✅ Blockchain integration ENABLED");
                tracing::info!("   Chain ID: {}", chain_id);
                tracing::info!("   Escrow: {}", escrow_addr);
                tracing::info!("   RPC: {}...", &rpc_url[..50.min(rpc_url.len())]);
                
                // ✅ FIX: Start event listener as a background task
                tracing::info!("Starting event listener as background task...");
                match EventListener::new(
                    &rpc_url,
                    escrow_address,
                    state.db.pool().clone(),
                    None, // Start from last synced block
                ).await {
                    Ok(mut event_listener) => {
                        tokio::spawn(async move {
                            tracing::info!("🎧 Event listener background task started");
                            if let Err(e) = event_listener.start().await {
                                tracing::error!("❌ Event listener error: {:?}", e);
                            }
                        });
                        tracing::info!("✅ Event listener started");
                    }
                    Err(e) => {
                        tracing::warn!("⚠️  Failed to start event listener: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("⚠️  Failed to initialize blockchain client: {}", e);
                tracing::warn!("   Continuing without blockchain integration");
            }
        }
    } else {
        tracing::info!("⚠️  Blockchain integration DISABLED (environment variables not set)");
        tracing::info!("   Set ESCROW_CONTRACT_ADDRESS and RELAYER_PRIVATE_KEY to enable");
    }

    // Create router
    let app = create_router(state);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server started successfully!");
    tracing::info!("API documentation:");
    tracing::info!("  Health:       GET  http://{}/health", addr);
    tracing::info!("  Create Order: POST http://{}/api/orders", addr);
    tracing::info!("  Get Order:    GET  http://{}/api/orders/:order_id", addr);
    tracing::info!("  Order Book:   GET  http://{}/api/orderbook", addr);
    
    axum::serve(listener, app).await?;

    Ok(())
}

