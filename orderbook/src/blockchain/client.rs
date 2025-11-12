use ethers::prelude::*;
use ethers::providers::{Http, Provider};
use ethers::signers::{LocalWallet, Signer};
use std::sync::Arc;
use thiserror::Error;

use super::ZkAliPayEscrow;

#[derive(Error, Debug)]
pub enum EthereumClientError {
    #[error("Contract error: {0}")]
    ContractError(String),
    #[error("Provider error: {0}")]
    ProviderError(String),
    #[error("Wallet error: {0}")]
    WalletError(String),
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
}

pub struct EthereumClient {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    escrow_contract: ZkAliPayEscrow<SignerMiddleware<Provider<Http>, LocalWallet>>,
    chain_id: u64,
}

impl EthereumClient {
    pub async fn new(
        rpc_url: &str,
        private_key: &str,
        escrow_address: Address,
        _usdc_address: Address,  // Reserved for future use
        chain_id: u64,
    ) -> Result<Self, EthereumClientError> {
        // Create provider
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| EthereumClientError::ProviderError(e.to_string()))?;

        // Create wallet
        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| EthereumClientError::WalletError(format!("Invalid private key: {}", e)))?;
        let wallet = wallet.with_chain_id(chain_id);

        // Create signer middleware
        let client = SignerMiddleware::new(provider.clone(), wallet.clone());
        let client = Arc::new(client);

        // Create contract instance
        let escrow_contract = ZkAliPayEscrow::new(escrow_address, client.clone());

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            escrow_contract,
            chain_id,
        })
    }

    /// Fill an order (buyer calling this to initiate a trade)
    pub async fn fill_order(
        &self,
        order_id: [u8; 32],
        fill_amount: U256,
        buyer_address: Address,
    ) -> Result<(H256, [u8; 32], String), EthereumClientError> {
        tracing::info!(
            "Calling fillOrder: order_id={}, fill_amount={}, buyer={}",
            hex::encode(order_id),
            fill_amount,
            buyer_address
        );

        let mut call = self
            .escrow_contract
            .fill_order(order_id, buyer_address, fill_amount);

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| EthereumClientError::ContractError(format!("Gas estimation failed: {}", e)))?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let pending_tx = call
            .send()
            .await
            .map_err(|e| EthereumClientError::TransactionFailed(format!("fillOrder failed: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();
        tracing::info!("fillOrder tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = pending_tx
            .await
            .map_err(|e| EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e)))?
            .ok_or_else(|| EthereumClientError::TransactionFailed("No receipt returned".to_string()))?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("fillOrder tx confirmed: {:#x}", tx_hash);

        // Decode trade ID and nonce from logs
        let (trade_id, payment_nonce) = self.decode_trade_created_event(&receipt)?;

        Ok((tx_hash, trade_id, payment_nonce))
    }

    /// Submit payment proof (buyer calling this after sending Alipay payment)
    /// New signature: submitPaymentProof(bytes32 tradeId, bytes32 userPublicValues, bytes accumulator, bytes proof)
    pub async fn submit_payment_proof(
        &self,
        trade_id: [u8; 32],
        user_public_values: [u8; 32],
        accumulator: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<H256, EthereumClientError> {
        tracing::info!(
            "Calling submitPaymentProof: trade_id={}, user_public_values={}, accumulator_len={}, proof_len={}",
            hex::encode(trade_id),
            hex::encode(user_public_values),
            accumulator.len(),
            proof.len()
        );

        let accumulator_bytes = Bytes::from(accumulator.clone());
        let proof_bytes = Bytes::from(proof.clone());
        let mut call = self
            .escrow_contract
            .submit_payment_proof(trade_id, user_public_values, accumulator_bytes, proof_bytes);

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("submitPaymentProof failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("submitPaymentProof tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("submitPaymentProof tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Cancel expired trade (anyone can call)
    pub async fn cancel_expired_trade(
        &self,
        trade_id: [u8; 32],
    ) -> Result<H256, EthereumClientError> {
        tracing::info!(
            "Calling cancelExpiredTrade: trade_id={}",
            hex::encode(trade_id)
        );

        let mut call = self.escrow_contract.cancel_expired_trade(trade_id);

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("cancelExpiredTrade failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("cancelExpiredTrade tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("cancelExpiredTrade tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Decode TradeCreated event from receipt to get trade_id and payment_nonce
    fn decode_trade_created_event(
        &self,
        receipt: &TransactionReceipt,
    ) -> Result<([u8; 32], String), EthereumClientError> {
        use super::TradeCreatedFilter;

        for log in &receipt.logs {
            if let Ok(event) = self.escrow_contract.decode_event::<TradeCreatedFilter>(
                "TradeCreated",
                log.topics.clone(),
                log.data.clone(),
            ) {
                let trade_id_bytes: [u8; 32] = event.trade_id.into();
                let nonce = self.decode_nonce_from_data(&log.data);
                tracing::info!(
                    "Decoded TradeCreated: trade_id={}, nonce={}",
                    hex::encode(trade_id_bytes),
                    nonce
                );
                return Ok((trade_id_bytes, nonce));
            }
        }

        Err(EthereumClientError::ContractError(
            "TradeCreated event not found in receipt".to_string(),
        ))
    }

    /// Decode payment nonce from event data
    /// The nonce is the last string parameter in the TradeCreated event
    fn decode_nonce_from_data(&self, data: &Bytes) -> String {
        // The event signature is:
        // TradeCreated(bytes32 indexed tradeId, bytes32 indexed orderId, address indexed buyer, 
        //              address token, uint256 tokenAmount, uint256 cnyAmount, string paymentNonce, uint256 expiresAt)
        // Non-indexed params in data: token, tokenAmount, cnyAmount, paymentNonce, expiresAt
        
        // Try to decode the data as (address, uint256, uint256, string, uint256)
        match ethers::abi::decode(
            &[
                ethers::abi::ParamType::Address,
                ethers::abi::ParamType::Uint(256),
                ethers::abi::ParamType::Uint(256),
                ethers::abi::ParamType::String,
                ethers::abi::ParamType::Uint(256),
            ],
            data,
        ) {
            Ok(tokens) => {
                if let Some(ethers::abi::Token::String(nonce)) = tokens.get(3) {
                    tracing::info!("Successfully decoded nonce from TradeCreated event: {}", nonce);
                    return nonce.clone();
                }
            }
            Err(e) => {
                tracing::warn!("Failed to decode nonce from TradeCreated event data: {}", e);
            }
        }

        // Fallback: generate from trade ID (which is indexed, so we can't get it from data)
        // This should not happen in practice with correct contract events
        "trade-0000000000000000".to_string()
    }

    pub fn relayer_address(&self) -> Address {
        self.wallet.address()
    }

    pub fn chain_id(&self) -> u64 {
        self.chain_id
    }

    /// Get current block number
    pub async fn get_block_number(&self) -> Result<u64, EthereumClientError> {
        let block_number = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| EthereumClientError::ProviderError(e.to_string()))?;
        Ok(block_number.as_u64())
    }

    /// Check if order exists on blockchain
    pub async fn order_exists(&self, order_id: [u8; 32]) -> Result<bool, EthereumClientError> {
        let order = self
            .escrow_contract
            .orders(order_id)
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;
        
        // Check if the order has a non-zero remaining amount (indicating it exists)
        Ok(order.3 > U256::zero()) // order.3 is remainingAmount
    }

    /// Check if trade exists on blockchain
    pub async fn trade_exists(&self, trade_id: [u8; 32]) -> Result<bool, EthereumClientError> {
        let trade = self
            .escrow_contract
            .trades(trade_id)
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;
        
        // Check if the trade has a non-zero token amount (indicating it exists)
        // trade tuple: (tradeId, orderId, seller, buyer, token, tokenAmount, ...)
        Ok(trade.6 > U256::zero()) // trade.6 is tokenAmount
    }

    // ============ Admin Functions ============

    /// Update contract configuration (minTradeValueCny, maxTradeValueCny, paymentWindow)
    /// Parameters with value 0 will not be changed
    pub async fn update_config(
        &self,
        min_trade_value_cny: u64,
        max_trade_value_cny: u64,
        payment_window: u64,
    ) -> Result<H256, EthereumClientError> {
        tracing::info!(
            "Calling updateConfig: min={}, max={}, window={}",
            min_trade_value_cny,
            max_trade_value_cny,
            payment_window
        );

        let mut call = self.escrow_contract.update_config(
            U256::from(min_trade_value_cny),
            U256::from(max_trade_value_cny),
            U256::from(payment_window),
        );

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("updateConfig failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("updateConfig tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("updateConfig tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Update zkPDF verifier contract address
    pub async fn update_verifier(
        &self,
        new_verifier: Address,
    ) -> Result<H256, EthereumClientError> {
        tracing::info!("Calling updateZkVerifier: verifier={:?}", new_verifier);

        let mut call = self.escrow_contract.update_zk_verifier(new_verifier);

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("updateZkVerifier failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("updateZkVerifier tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("updateZkVerifier tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Pause the contract
    pub async fn pause_contract(&self) -> Result<H256, EthereumClientError> {
        tracing::info!("Calling pause");

        let mut call = self.escrow_contract.pause();

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("pause failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("pause tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("pause tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Unpause the contract
    pub async fn unpause_contract(&self) -> Result<H256, EthereumClientError> {
        tracing::info!("Calling unpause");

        let mut call = self.escrow_contract.unpause();

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("unpause failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("unpause tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("unpause tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Update zkPDF configuration (public key hash and commitments)
    pub async fn update_zkpdf_config(
        &self,
        public_key_der_hash: [u8; 32],
        app_exe_commit: [u8; 32],
        app_vm_commit: [u8; 32],
    ) -> Result<H256, EthereumClientError> {
        tracing::info!(
            "Calling updateZkPDFConfig: publicKeyDerHash={}, appExeCommit={}, appVmCommit={}",
            hex::encode(public_key_der_hash),
            hex::encode(app_exe_commit),
            hex::encode(app_vm_commit)
        );

        let mut call = self.escrow_contract.update_zk_pdf_config(
            public_key_der_hash,
            app_exe_commit,
            app_vm_commit,
        );

        // Estimate gas
        let gas_estimate = call
            .estimate_gas()
            .await
            .map_err(|e| {
                EthereumClientError::ContractError(format!("Gas estimation failed: {}", e))
            })?;

        // Send transaction with gas limit
        call = call.gas(gas_estimate * 120 / 100); // 20% buffer
        let tx = call
            .send()
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("updateZkPDFConfig failed: {}", e))
            })?;

        let tx_hash = tx.tx_hash();
        tracing::info!("updateZkPDFConfig tx sent: {:#x}", tx_hash);

        // Wait for confirmation
        let receipt = tx
            .await
            .map_err(|e| {
                EthereumClientError::TransactionFailed(format!("Transaction receipt error: {}", e))
            })?
            .ok_or_else(|| {
                EthereumClientError::TransactionFailed("No receipt returned".to_string())
            })?;

        if receipt.status != Some(U64::from(1)) {
            return Err(EthereumClientError::TransactionFailed(
                "Transaction reverted".to_string(),
            ));
        }

        tracing::info!("updateZkPDFConfig tx confirmed: {:#x}", tx_hash);

        Ok(tx_hash)
    }

    /// Get payment window from contract
    pub async fn get_payment_window(&self) -> Result<U256, EthereumClientError> {
        self.escrow_contract
            .payment_window()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))
    }

    /// Get public key DER hash from contract
    pub async fn get_public_key_der_hash(&self) -> Result<[u8; 32], EthereumClientError> {
        tracing::debug!("🔍 Fetching public key DER hash from contract...");
        let hash = self.escrow_contract
            .public_key_der_hash()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;
        tracing::debug!("✅ Fetched public key DER hash: {}", hex::encode(hash));
        Ok(hash)
    }

    /// Get current contract configuration
    /// Returns: (minTradeValueCny, maxTradeValueCny, paymentWindow, paused, zkVerifier, publicKeyDerHash, appExeCommit, appVmCommit)
    pub async fn get_contract_config(&self) -> Result<(U256, U256, U256, bool, Address, [u8; 32], [u8; 32], [u8; 32]), EthereumClientError> {
        let min_trade = self
            .escrow_contract
            .min_trade_value_cny()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let max_trade = self
            .escrow_contract
            .max_trade_value_cny()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let payment_window = self
            .escrow_contract
            .payment_window()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let paused = self
            .escrow_contract
            .paused()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let zk_verifier = self
            .escrow_contract
            .zk_verifier()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let public_key_der_hash = self
            .escrow_contract
            .public_key_der_hash()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let app_exe_commit = self
            .escrow_contract
            .app_exe_commit()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        let app_vm_commit = self
            .escrow_contract
            .app_vm_commit()
            .call()
            .await
            .map_err(|e| EthereumClientError::ContractError(e.to_string()))?;

        Ok((min_trade, max_trade, payment_window, paused, zk_verifier, public_key_der_hash, app_exe_commit, app_vm_commit))
    }
}

