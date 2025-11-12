use ethers::prelude::*;
use ethers::providers::{Http, Provider};
use std::sync::Arc;
use thiserror::Error;
use tokio::time::{interval, Duration};

use super::{OrderCreatedAndLockedFilter, OrderPartiallyWithdrawnFilter, TradeCreatedFilter, ProofSubmittedFilter, TradeSettledFilter, TradeExpiredFilter};
use crate::db::{
    models::{DbOrder, DbTrade},
    orders::{OrderRepository, PostgresOrderRepository},
    trades::{TradeRepository, PostgresTradeRepository},
};

#[derive(Error, Debug)]
pub enum EventListenerError {
    #[error("Provider error: {0}")]
    ProviderError(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Event decode error: {0}")]
    EventDecodeError(String),
}

/// Configuration constants
const BLOCKS_PER_QUERY: u64 = 8;       // Process 8 blocks at a time
const MAX_REORG_DEPTH: u64 = 2;        // Wait 2 blocks for finality
const POLL_INTERVAL_SECS: u64 = 6;     // Poll every 6 seconds

pub struct EventListener {
    provider: Arc<Provider<Http>>,
    contract_address: Address,
    db_pool: sqlx::PgPool,
    start_block: u64,
}

impl EventListener {
    /// Create a new event listener
    pub async fn new(
        rpc_url: &str,
        contract_address: Address,
        db_pool: sqlx::PgPool,
        start_block: Option<u64>,
    ) -> Result<Self, EventListenerError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;
        let provider = Arc::new(provider);

        // Determine start block
        let start_block = if let Some(block) = start_block {
            block
        } else {
            // Try to get last synced block from database
            match Self::get_last_synced_block(&db_pool, &contract_address).await {
                Ok(block) => block,
                Err(_) => {
                    // If no record exists, start from current block
                    let current_block = provider
                        .get_block_number()
                        .await
                        .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;
                    current_block.as_u64()
                }
            }
        };

        tracing::info!(
            "Initialized event listener for contract {:#x}, starting from block {}",
            contract_address,
            start_block
        );

        Ok(Self {
            provider,
            contract_address,
            db_pool,
            start_block,
        })
    }

    /// Start the event listener (runs indefinitely)
    pub async fn start(&mut self) -> Result<(), EventListenerError> {
        tracing::info!("🚀 Starting event listener...");

        let mut poll_interval = interval(Duration::from_secs(POLL_INTERVAL_SECS));

        loop {
            poll_interval.tick().await;

            if let Err(e) = self.sync_events().await {
                tracing::error!("❌ Event sync error: {}", e);
                // Continue polling even on error
            }
        }
    }

    /// Sync events from blockchain to database
    async fn sync_events(&mut self) -> Result<(), EventListenerError> {
        let current_block = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?
            .as_u64();

        // Apply reorg protection (don't process very recent blocks)
        let safe_block = current_block.saturating_sub(MAX_REORG_DEPTH);

        if self.start_block >= safe_block {
            // Nothing new to sync
            return Ok(());
        }

        // Process blocks in chunks
        let to_block = std::cmp::min(self.start_block + BLOCKS_PER_QUERY, safe_block);

        tracing::debug!(
            "📊 Syncing blocks {} to {} (current: {})",
            self.start_block,
            to_block,
            current_block
        );

        // Process OrderCreatedAndLocked events
        self.process_order_created_events(self.start_block, to_block)
            .await?;

        // Process OrderPartiallyWithdrawn events
        self.process_order_withdrawn_events(self.start_block, to_block)
            .await?;

        // Process TradeCreated events
        self.process_trade_created_events(self.start_block, to_block)
            .await?;

        // Process ProofSubmitted events
        self.process_proof_submitted_events(self.start_block, to_block)
            .await?;

        // Process TradeSettled events
        self.process_trade_settled_events(self.start_block, to_block)
            .await?;

        // Process TradeExpired events
        self.process_trade_expired_events(self.start_block, to_block)
            .await?;

        // Update last synced block
        self.start_block = to_block + 1;
        Self::save_last_synced_block(&self.db_pool, &self.contract_address, self.start_block)
            .await?;

        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: OrderCreatedAndLocked
    // ================================================================

    /// Process OrderCreatedAndLocked events
    async fn process_order_created_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .event("OrderCreatedAndLocked(bytes32,address,address,uint256,uint256,string,string)")
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        if !logs.is_empty() {
            tracing::info!("📦 Found {} OrderCreatedAndLocked events", logs.len());
        }

        for log in logs {
            if let Err(e) = self.handle_order_created(log).await {
                tracing::error!("❌ Failed to handle OrderCreatedAndLocked: {}", e);
            }
        }

        Ok(())
    }

    /// Handle a single OrderCreatedAndLocked event
    async fn handle_order_created(&self, log: Log) -> Result<(), EventListenerError> {
        // Decode event
        let event: OrderCreatedAndLockedFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format order ID as 0x-prefixed hex string (full 32 bytes = 66 chars with 0x)
        let order_id = format!("0x{}", hex::encode(event.order_id));

        tracing::info!(
            "📦 OrderCreatedAndLocked:\n  \
            order_id: {}\n  \
            seller: {:#x}\n  \
            token: {:#x}\n  \
            totalAmount: {}\n  \
            exchangeRate: {}\n  \
            alipayId: {}\n  \
            alipayName: {}",
            order_id,
            event.seller,
            event.token,
            event.total_amount,
            event.exchange_rate,
            event.alipay_id,
            event.alipay_name
        );

        // ============================================================
        // DATABASE SYNC: Insert order using repository
        // ============================================================
        
        let order_repo = PostgresOrderRepository::new(self.db_pool.clone());
        
        let db_order = DbOrder {
            order_id: order_id.clone(),
            seller: format!("{:#x}", event.seller).to_lowercase(),
            token: format!("{:#x}", event.token).to_lowercase(),
            total_amount: event.total_amount.to_string(),
            remaining_amount: event.total_amount.to_string(), // Initially equals totalAmount
            exchange_rate: event.exchange_rate.to_string(),
            alipay_id: event.alipay_id.clone(),
            alipay_name: event.alipay_name.clone(),
            created_at: chrono::Utc::now().timestamp(),
            synced_at: chrono::Utc::now(),
        };

        match order_repo.create(&db_order).await {
            Ok(_) => {
                tracing::info!("✅ Order {} synced to database", order_id);
            }
            Err(e) => {
                tracing::error!("❌ Database insert failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: OrderPartiallyWithdrawn
    // ================================================================

    /// Process OrderPartiallyWithdrawn events
    async fn process_order_withdrawn_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .event("OrderPartiallyWithdrawn(bytes32,uint256,uint256)")
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        if !logs.is_empty() {
            tracing::info!("📦 Found {} OrderPartiallyWithdrawn events", logs.len());
        }

        for log in logs {
            if let Err(e) = self.handle_order_withdrawn(log).await {
                tracing::error!("❌ Failed to handle OrderPartiallyWithdrawn: {}", e);
            }
        }

        Ok(())
    }

    /// Handle a single OrderPartiallyWithdrawn event
    async fn handle_order_withdrawn(&self, log: Log) -> Result<(), EventListenerError> {
        // Decode event
        let event: OrderPartiallyWithdrawnFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format order ID as 0x-prefixed hex string (full 32 bytes = 66 chars with 0x)
        let order_id = format!("0x{}", hex::encode(event.order_id));

        tracing::info!(
            "💸 OrderPartiallyWithdrawn:\n  \
            order_id: {}\n  \
            withdrawnAmount: {}\n  \
            newRemainingAmount: {}",
            order_id,
            event.withdrawn_amount,
            event.new_remaining_amount
        );

        // ============================================================
        // DATABASE SYNC: Adjust order remaining amount (subtract withdrawn amount)
        // ============================================================
        
        let order_repo = PostgresOrderRepository::new(self.db_pool.clone());
        
        // Use negative delta to subtract withdrawn amount
        let delta = format!("-{}", event.withdrawn_amount);
        
        match order_repo.adjust_remaining_amount(&order_id, &delta).await {
            Ok(_) => {
                tracing::info!(
                    "✅ Order {} remaining amount adjusted by {} (withdrawn)",
                    order_id,
                    event.withdrawn_amount
                );
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: TradeCreated
    // ================================================================

    /// Process TradeCreated events
    async fn process_trade_created_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .event("TradeCreated(bytes32,bytes32,address,address,uint256,uint256,string,uint256)")
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        if !logs.is_empty() {
            tracing::info!("📦 Found {} TradeCreated events", logs.len());
        }

        for log in logs {
            if let Err(e) = self.handle_trade_created(log).await {
                tracing::error!("❌ Failed to handle TradeCreated: {}", e);
            }
        }

        Ok(())
    }

    /// Handle a single TradeCreated event
    async fn handle_trade_created(&self, log: Log) -> Result<(), EventListenerError> {
        // Extract transaction hash for escrowTxHash
        let tx_hash = log.transaction_hash
            .map(|h| format!("{:#x}", h))
            .unwrap_or_default();

        // Decode event
        let event: TradeCreatedFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format IDs as 0x-prefixed hex strings
        let trade_id = format!("0x{}", hex::encode(event.trade_id));
        let order_id = format!("0x{}", hex::encode(event.order_id));

        tracing::info!(
            "💱 TradeCreated:\n  \
            trade_id: {}\n  \
            order_id: {}\n  \
            buyer: {:#x}\n  \
            token: {:#x}\n  \
            tokenAmount: {}\n  \
            cnyAmount: {}\n  \
            paymentNonce: {}\n  \
            expiresAt: {}",
            trade_id,
            order_id,
            event.buyer,
            event.token,
            event.token_amount,
            event.cny_amount,
            event.payment_nonce,
            event.expires_at
        );

        // ============================================================
        // DATABASE SYNC 1: Create trade record
        // ============================================================
        
        let trade_repo = PostgresTradeRepository::new(self.db_pool.clone());
        
        let db_trade = DbTrade {
            trade_id: trade_id.clone(),
            order_id: order_id.clone(),
            buyer: format!("{:#x}", event.buyer).to_lowercase(),
            token_amount: event.token_amount.to_string(),
            cny_amount: event.cny_amount.to_string(),
            payment_nonce: event.payment_nonce.clone(),
            created_at: chrono::Utc::now().timestamp(),
            expires_at: event.expires_at.as_u64() as i64,
            status: 0, // PENDING
            synced_at: chrono::Utc::now(),
            escrow_tx_hash: Some(tx_hash),
            settlement_tx_hash: None,
            token: None, // Not available from event (would need separate query)
            pdf_file: None,
            pdf_filename: None,
            pdf_uploaded_at: None,
            proof_user_public_values: None,
            proof_accumulator: None,
            proof_data: None,
            axiom_proof_id: None,
            proof_generated_at: None,
            proof_json: None,
        };

        match trade_repo.create(&db_trade).await {
            Ok(_) => {
                tracing::info!("✅ Trade {} created in database", trade_id);
            }
            Err(e) => {
                tracing::error!("❌ Database insert failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        // ============================================================
        // DATABASE SYNC 2: Adjust order remaining amount (subtract)
        // ============================================================
        
        let order_repo = PostgresOrderRepository::new(self.db_pool.clone());
        
        // Use negative delta to subtract token amount from order
        let delta = format!("-{}", event.token_amount);
        
        match order_repo.adjust_remaining_amount(&order_id, &delta).await {
            Ok(_) => {
                tracing::info!(
                    "✅ Order {} remaining amount adjusted by {} (trade filled)",
                    order_id,
                    event.token_amount
                );
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: ProofSubmitted
    // ================================================================

    /// Process ProofSubmitted events
    async fn process_proof_submitted_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .topic0(H256::from_slice(
                &ethers::utils::keccak256("ProofSubmitted(bytes32,bytes32)"),
            ))
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        if !logs.is_empty() {
            tracing::info!("📝 Found {} ProofSubmitted events", logs.len());
        }

        for log in logs {
            if let Err(e) = self.handle_proof_submitted(log).await {
                tracing::error!("Failed to handle ProofSubmitted event: {}", e);
                // Continue processing other events
            }
        }

        Ok(())
    }

    /// Handle a single ProofSubmitted event
    async fn handle_proof_submitted(&self, log: Log) -> Result<(), EventListenerError> {
        // Decode event
        let event: ProofSubmittedFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format trade ID as 0x-prefixed hex string
        let trade_id = format!("0x{}", hex::encode(event.trade_id));
        
        // Format proof hash as 0x-prefixed hex string
        let proof_hash = format!("0x{}", hex::encode(event.proof_hash));

        tracing::info!(
            "📝 ProofSubmitted:\n  \
            trade_id: {}\n  \
            proof_hash: {}",
            trade_id,
            proof_hash
        );

        // ============================================================
        // DATABASE SYNC: Update trade proof hash
        // ============================================================
        
        let trade_repo = PostgresTradeRepository::new(self.db_pool.clone());
        
        match trade_repo.update_proof_hash(&trade_id, &proof_hash).await {
            Ok(_) => {
                tracing::info!("✅ Trade {} proof hash updated", trade_id);
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: TradeSettled
    // ================================================================

    /// Process TradeSettled events
    async fn process_trade_settled_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .topic0(H256::from_slice(
                &ethers::utils::keccak256("TradeSettled(bytes32)"),
            ))
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        for log in logs {
            if let Err(e) = self.handle_trade_settled(log).await {
                tracing::error!("Failed to handle TradeSettled event: {}", e);
                // Continue processing other events
            }
        }

        Ok(())
    }

    /// Handle a single TradeSettled event
    async fn handle_trade_settled(&self, log: Log) -> Result<(), EventListenerError> {
        // Extract transaction hash for settlementTxHash
        let tx_hash = log.transaction_hash
            .map(|h| format!("{:#x}", h))
            .unwrap_or_default();

        // Decode event
        let event: TradeSettledFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format trade ID as 0x-prefixed hex string
        let trade_id = format!("0x{}", hex::encode(event.trade_id));

        tracing::info!(
            "✅ TradeSettled:\n  \
            trade_id: {}\n  \
            settlement_tx: {}",
            trade_id,
            tx_hash
        );

        // ============================================================
        // DATABASE SYNC: Update trade status to SETTLED
        // ============================================================
        
        let trade_repo = PostgresTradeRepository::new(self.db_pool.clone());
        
        // Update status to SETTLED (1)
        match trade_repo.update_status(&trade_id, 1).await {
            Ok(_) => {
                tracing::info!("✅ Trade {} status updated to SETTLED", trade_id);
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        // Update settlement transaction hash
        if !tx_hash.is_empty() {
            match trade_repo.update_settlement_tx(&trade_id, &tx_hash).await {
                Ok(_) => {
                    tracing::info!("✅ Trade {} settlement tx hash updated", trade_id);
                }
                Err(e) => {
                    tracing::error!("❌ Failed to update settlement tx hash: {}", e);
                    // Continue even if this fails (non-critical)
                }
            }
        }
        
        Ok(())
    }

    // ================================================================
    // EVENT HANDLER: TradeExpired
    // ================================================================

    /// Process TradeExpired events
    async fn process_trade_expired_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<(), EventListenerError> {
        let filter = Filter::new()
            .address(self.contract_address)
            .topic0(H256::from_slice(
                &ethers::utils::keccak256("TradeExpired(bytes32,bytes32,uint256)"),
            ))
            .from_block(from_block)
            .to_block(to_block);

        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| EventListenerError::ProviderError(e.to_string()))?;

        for log in logs {
            if let Err(e) = self.handle_trade_expired(log).await {
                tracing::error!("Failed to handle TradeExpired event: {}", e);
                // Continue processing other events
            }
        }

        Ok(())
    }

    /// Handle a single TradeExpired event
    async fn handle_trade_expired(&self, log: Log) -> Result<(), EventListenerError> {
        // Decode event
        let event: TradeExpiredFilter = ethers::contract::parse_log(log)
            .map_err(|e| EventListenerError::EventDecodeError(e.to_string()))?;

        // Format IDs as 0x-prefixed hex strings
        let trade_id = format!("0x{}", hex::encode(event.trade_id));
        let order_id = format!("0x{}", hex::encode(event.order_id));

        tracing::info!(
            "⏰ TradeExpired:\n  \
            trade_id: {}\n  \
            order_id: {}\n  \
            tokenAmount: {} (returned to order)",
            trade_id,
            order_id,
            event.token_amount
        );

        // ============================================================
        // DATABASE SYNC 1: Update trade status to EXPIRED
        // ============================================================
        
        let trade_repo = PostgresTradeRepository::new(self.db_pool.clone());
        
        // Update status to EXPIRED (2)
        match trade_repo.update_status(&trade_id, 2).await {
            Ok(_) => {
                tracing::info!("✅ Trade {} status updated to EXPIRED", trade_id);
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        // ============================================================
        // DATABASE SYNC 2: Adjust order remaining amount (add back)
        // ============================================================
        
        let order_repo = PostgresOrderRepository::new(self.db_pool.clone());
        
        // Use positive delta to add token amount back to order
        let delta = event.token_amount.to_string();
        
        match order_repo.adjust_remaining_amount(&order_id, &delta).await {
            Ok(_) => {
                tracing::info!(
                    "✅ Order {} remaining amount adjusted by +{} (trade expired)",
                    order_id,
                    event.token_amount
                );
            }
            Err(e) => {
                tracing::error!("❌ Database update failed: {}", e);
                return Err(EventListenerError::DatabaseError(e.to_string()));
            }
        }

        Ok(())
    }

    // ================================================================
    // DATABASE HELPERS: Track last synced block
    // ================================================================

    /// Get the last synced block from database
    async fn get_last_synced_block(
        pool: &sqlx::PgPool,
        contract_address: &Address,
    ) -> Result<u64, EventListenerError> {
        let addr = format!("{:#x}", contract_address).to_lowercase();
        let row: (i64,) = sqlx::query_as(
            "SELECT last_synced_block FROM event_sync_state WHERE contract_address = $1",
        )
        .bind(&addr)
        .fetch_one(pool)
        .await
        .map_err(|e| EventListenerError::DatabaseError(e.to_string()))?;

        Ok(row.0 as u64)
    }

    /// Save the last synced block to database
    async fn save_last_synced_block(
        pool: &sqlx::PgPool,
        contract_address: &Address,
        block: u64,
    ) -> Result<(), EventListenerError> {
        let addr = format!("{:#x}", contract_address).to_lowercase();
        sqlx::query(
            "INSERT INTO event_sync_state (contract_address, last_synced_block) 
             VALUES ($1, $2) 
             ON CONFLICT (contract_address) 
             DO UPDATE SET last_synced_block = $2",
        )
        .bind(&addr)
        .bind(block as i64)
        .execute(pool)
        .await
        .map_err(|e| EventListenerError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
