use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use crate::db::Database;
use crate::blockchain::client::EthereumClient;

/// Shared application state
/// Uses DB-based orderbook (no in-memory cache)
#[derive(Clone)]
pub struct AppState {
    /// Database connection for persistence and queries
    pub db: Arc<Database>,
    
    /// Blockchain client for Ethereum interaction (optional for testing)
    pub blockchain_client: Option<Arc<EthereumClient>>,
    
    /// In-memory cache for input streams (trade_id -> 46 hex strings)
    /// Used to avoid regenerating input streams between validation and proof generation
    pub input_streams_cache: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl AppState {
    /// Create new app state
    pub async fn new(database_url: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Connect to database
        let db = Database::new(database_url).await?;
        
        // Run migrations
        db.migrate().await?;
        
        tracing::info!("App state initialized (DB-based orderbook with direct queries)");
        
        Ok(Self {
            db: Arc::new(db),
            blockchain_client: None,
            input_streams_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    /// Set blockchain client (optional, for blockchain integration)
    pub fn with_blockchain_client(mut self, client: Arc<EthereumClient>) -> Self {
        self.blockchain_client = Some(client);
        self
    }
}
