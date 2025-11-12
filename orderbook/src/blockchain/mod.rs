// Blockchain integration module
// Phase 2.3.b: Ethereum client and event listener

pub mod client;
pub mod events;
pub mod types;

use ethers::prelude::abigen;

// Generate contract bindings from ABI files
abigen!(
    ZkAliPayEscrow,
    "./abi/ZkAliPayEscrow.json",
    event_derives(serde::Deserialize, serde::Serialize)
);

abigen!(
    IERC20,
    "./abi/IERC20.json"
);

