// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ZkAliPayEscrow.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/OpenVmHalo2Verifier.sol";

/**
 * @title Deploy
 * @notice Universal deployment script for ZkAliPayEscrow - works on any EVM chain
 * @dev All configuration comes from environment variables (managed by deployment.config.json)
 * 
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
 * 
 * Required environment variables:
 *   DEPLOYER_PRIVATE_KEY    - Private key of the deployer wallet
 *   RPC_URL                 - RPC endpoint for the target network
 *   VERIFIER_ADDRESS        - Address of OpenVM Halo2 Verifier (or 0x0 to deploy new)
 *   PUBLIC_KEY_DER_HASH     - Public key DER hash for PDF signature verification
 *   APP_EXE_COMMIT          - OpenVM app executable commitment
 *   APP_VM_COMMIT           - OpenVM app VM commitment
 *   MIN_TRADE_VALUE_CNY     - Minimum trade value in CNY cents (e.g., 70000 = 700 CNY)
 *   MAX_TRADE_VALUE_CNY     - Maximum trade value in CNY cents (e.g., 7200000 = 72,000 CNY)
 *   PAYMENT_WINDOW          - Payment window in seconds (e.g., 900 = 15 minutes)
 *   DEPLOY_MOCK_USDC        - "true" to deploy MockUSDC (testnet only), "false" to skip
 */
contract Deploy is Script {
    function run() external {
        // Read environment variables
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address verifierAddress = vm.envAddress("VERIFIER_ADDRESS");
        bytes32 publicKeyDerHash = vm.envBytes32("PUBLIC_KEY_DER_HASH");
        bytes32 appExeCommit = vm.envBytes32("APP_EXE_COMMIT");
        bytes32 appVmCommit = vm.envBytes32("APP_VM_COMMIT");
        uint256 minTradeValueCny = vm.envUint("MIN_TRADE_VALUE_CNY");
        uint256 maxTradeValueCny = vm.envUint("MAX_TRADE_VALUE_CNY");
        uint256 paymentWindow = vm.envUint("PAYMENT_WINDOW");
        bool deployMockUsdc = vm.envBool("DEPLOY_MOCK_USDC");
        
        console.log("=== Deployment Configuration ===");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("Deploy Mock USDC:", deployMockUsdc);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Mock USDC (testnet only)
        address usdcAddress;
        if (deployMockUsdc) {
            console.log("=== Deploying MockUSDC ===");
            MockUSDC usdc = new MockUSDC();
            usdcAddress = address(usdc);
            console.log("MockUSDC deployed at:", usdcAddress);
            
            // Mint test USDC to deployer (100,000 USDC)
            usdc.mint(deployer, 100000 * 10**6);
            console.log("Minted 100,000 USDC to deployer");
            console.log("");
        }
        
        // Deploy or use existing OpenVM Halo2 Verifier
        address verifier;
        if (verifierAddress == address(0)) {
            console.log("=== Deploying OpenVmHalo2Verifier ===");
            OpenVmHalo2Verifier newVerifier = new OpenVmHalo2Verifier();
            verifier = address(newVerifier);
            console.log("OpenVmHalo2Verifier deployed at:", verifier);
        } else {
            verifier = verifierAddress;
            console.log("=== Using Existing OpenVmHalo2Verifier ===");
            console.log("Verifier address:", verifier);
        }
        console.log("");
        
        // Deploy ZkAliPayEscrow
        console.log("=== Deploying ZkAliPayEscrow ===");
        ZkAliPayEscrow escrow = new ZkAliPayEscrow(
            verifier,
            publicKeyDerHash,
            appExeCommit,
            appVmCommit,
            minTradeValueCny,
            maxTradeValueCny,
            paymentWindow
        );
        console.log("ZkAliPayEscrow deployed at:", address(escrow));
        console.log("");
        
        // Display contract configuration
        console.log("=== Contract Configuration ===");
        console.log("Owner:", escrow.owner());
        console.log("Min Trade Value CNY:", escrow.minTradeValueCny());
        console.log("Max Trade Value CNY:", escrow.maxTradeValueCny());
        console.log("Payment Window:", escrow.paymentWindow(), "seconds");
        console.log("Public Key DER Hash:", uint256(escrow.publicKeyDerHash()));
        console.log("App Exe Commit:", uint256(escrow.appExeCommit()));
        console.log("App VM Commit:", uint256(escrow.appVmCommit()));
        console.log("");
        
        vm.stopBroadcast();
        
        // Display deployment summary
        console.log("=== DEPLOYMENT SUMMARY ===");
        if (deployMockUsdc) {
            console.log("MockUSDC:", usdcAddress);
        }
        console.log("OpenVmHalo2Verifier:", verifier);
        console.log("ZkAliPayEscrow:", address(escrow));
        console.log("");
        console.log("=== NEXT STEPS ===");
        console.log("1. Update deployment.config.json with contract addresses");
        console.log("2. Run: node scripts/generate-env.js <network>");
        console.log("3. Verify contracts on block explorer");
        console.log("4. Transfer ownership to relay wallet if needed");
    }
}

