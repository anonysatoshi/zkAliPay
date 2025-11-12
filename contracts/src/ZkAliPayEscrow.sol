// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IOpenVmHalo2Verifier.sol";

/**
 * @title ZkAliPayEscrow
 * @notice Escrow contract for peer-to-peer CNY ↔ Crypto swaps using zkPDF proofs
 * @dev Multi-token support - sellers lock crypto upfront, buyers fill asynchronously
 *
 * Key Features:
 * - Supports any ERC20 token (USDC, USDT, DAI, WETH, etc.)
 * - Sellers lock crypto when creating order (no coordination needed)
 * - Multiple buyers can partially fill one seller order
 * - Auto-expiration of trades (DoS protection)
 * - Automatic settlement after proof verification
 * - Seller can withdraw remaining tokens anytime
 *
 * Configuration:
 * - Token: Any ERC20 (user-specified per order)
 * - Exchange Rate: User-set (P2P market)
 * - Payment Window: Configurable (set at deployment)
 * - Min Trade: Configurable (set at deployment)
 * - Max Trade: Configurable (set at deployment)
 * - Orders never expire - remain active until seller withdraws all funds
 */
contract ZkAliPayEscrow is ReentrancyGuard, Ownable, Pausable {
    
    // ============ Constants ============
    
    /// @notice OpenVM Halo2 verifier contract
    IOpenVmHalo2Verifier public zkVerifier;
    
    /// @notice Alipay public key DER hash (32 bytes)
    bytes32 public publicKeyDerHash;
    
    /// @notice App executable commitment (guest program hash)
    bytes32 public appExeCommit;
    
    /// @notice App VM commitment (OpenVM version config)
    bytes32 public appVmCommit;
    
    /// @notice Minimum trade value in CNY cents - enforced per fill
    uint256 public minTradeValueCny;
    
    /// @notice Maximum trade value in CNY cents - enforced per fill
    uint256 public maxTradeValueCny;
    
    /// @notice Payment window for buyer to submit proof (in seconds)
    uint256 public paymentWindow;
    
    // ============ Enums ============
    
    enum TradeStatus {
        PENDING,      // Trade created, waiting for payment proof
        SETTLED,      // Trade completed, USDC released to buyer
        EXPIRED       // Trade expired, USDC returned to escrow pool
    }
    
    // ============ Structs ============
    
    /**
     * @notice Order created by seller (crypto provider)
     * @param orderId Unique order identifier
     * @param seller Address of crypto provider (receives CNY)
     * @param token ERC20 token address (USDC, USDT, DAI, WETH, etc.)
     * @param totalAmount Total tokens locked for this order
     * @param remainingAmount Tokens still available for fills and withdrawal
     * @param exchangeRate CNY cents per token unit (with 6 decimals, e.g., 7.35 CNY/USDC = 735)
     * @param alipayId Seller's Alipay account ID
     * @param alipayName Seller's Alipay account name
     * @param createdAt Timestamp when order was created
     */
    struct Order {
        bytes32 orderId;
        address seller;
        address token;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 exchangeRate;
        string alipayId;
        string alipayName;
        uint256 createdAt;
        uint8 tokenDecimals;  // Cached token decimals for accurate CNY calculations
    }
    
    /**
     * @notice Trade created when buyer fills an order
     * @param tradeId Unique trade identifier
     * @param orderId Associated order ID (contains seller + token info)
     * @param buyer Address of CNY sender (receives crypto)
     * @param tokenAmount Amount of tokens for this trade
     * @param cnyAmount Amount of CNY expected (in cents)
     * @param paymentNonce Unique nonce for this trade's payment
     * @param createdAt Timestamp when trade was created
     * @param expiresAt Timestamp when trade expires (no proof submitted)
     * @param status Current trade status
     */
    struct Trade {
        bytes32 tradeId;
        bytes32 orderId;
        address buyer;
        uint256 tokenAmount;
        uint256 cnyAmount;
        string paymentNonce;
        uint256 createdAt;
        uint256 expiresAt;
        TradeStatus status;
    }
    
    // ============ State Variables ============
    
    /// @notice Mapping of orderId to Order struct
    mapping(bytes32 => Order) public orders;
    
    /// @notice Mapping of tradeId to Trade struct
    mapping(bytes32 => Trade) public trades;
    
    /// @notice Counter for generating unique IDs
    uint256 private counter;
    
    // ============ Events ============
    
    event OrderCreatedAndLocked(
        bytes32 indexed orderId,
        address indexed seller,
        address indexed token,
        uint256 totalAmount,
        uint256 exchangeRate,
        string alipayId,
        string alipayName
    );
    
    event TradeCreated(
        bytes32 indexed tradeId,
        bytes32 indexed orderId,
        address indexed buyer,
        address token,
        uint256 tokenAmount,
        uint256 cnyAmount,
        string paymentNonce,
        uint256 expiresAt
    );
    
    event ProofSubmitted(
        bytes32 indexed tradeId,
        bytes32 proofHash
    );
    
    event TradeSettled(
        bytes32 indexed tradeId
    );
    
    event TradeExpired(
        bytes32 indexed tradeId,
        bytes32 indexed orderId,
        uint256 tokenAmount
    );
    
    event OrderPartiallyWithdrawn(
        bytes32 indexed orderId,
        uint256 withdrawnAmount,
        uint256 newRemainingAmount
    );
    
    event ConfigUpdated(
        uint256 maxOrderSize,
        uint256 paymentWindow
    );
    
    event ZkVerifierUpdated(
        address indexed oldVerifier,
        address indexed newVerifier
    );
    
    event ZkPDFConfigUpdated(
        bytes32 publicKeyDerHash,
        bytes32 appExeCommit,
        bytes32 appVmCommit
    );
    
    // ============ Errors ============
    
    error AmountBelowMinimum();          // Fill amount below minimum trade value (700 CNY)
    error AmountExceedsAvailable();      // Fill amount exceeds order's remaining amount
    error WithdrawalExceedsAvailable();  // Withdrawal amount exceeds order's remaining amount
    error AmountTooLarge();              // Fill amount above maximum trade value (72,000 CNY)
    error OrderNotFound();
    error TradeNotFound();
    error TradeNotPending();
    error TradeNotExpired();
    error NotAuthorized();
    error ProofVerificationFailed();
    error PaymentDetailsMismatch();
    error TransferFailed();
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the escrow contract with trading parameters
     * @param _zkVerifier Address of OpenVM Halo2 verifier contract
     * @param _publicKeyDerHash Alipay public key DER hash (32 bytes)
     * @param _appExeCommit Guest program commitment
     * @param _appVmCommit OpenVM version commitment
     * @param _minTradeValueCny Minimum trade value in CNY cents (e.g., 70000 = 700 CNY)
     * @param _maxTradeValueCny Maximum trade value in CNY cents (e.g., 7200000 = 72,000 CNY)
     * @param _paymentWindow Payment window in seconds (e.g., 900 = 15 minutes)
     */
    constructor(
        address _zkVerifier,
        bytes32 _publicKeyDerHash,
        bytes32 _appExeCommit,
        bytes32 _appVmCommit,
        uint256 _minTradeValueCny,
        uint256 _maxTradeValueCny,
        uint256 _paymentWindow
    ) Ownable(msg.sender) {
        require(_minTradeValueCny > 0, "Min trade value must be > 0");
        require(_maxTradeValueCny >= _minTradeValueCny, "Max must be >= min");
        require(_paymentWindow > 0, "Payment window must be > 0");
        
        zkVerifier = IOpenVmHalo2Verifier(_zkVerifier);
        publicKeyDerHash = _publicKeyDerHash;
        appExeCommit = _appExeCommit;
        appVmCommit = _appVmCommit;
        minTradeValueCny = _minTradeValueCny;
        maxTradeValueCny = _maxTradeValueCny;
        paymentWindow = _paymentWindow;
    }
    
    // ============ Core Functions: Seller Actions ============
    
    /**
     * @notice Create order and lock tokens in escrow (SELLER ACTION)
     * @dev Seller locks tokens upfront, buyers can fill asynchronously
     * @param token ERC20 token address (USDC, USDT, DAI, WETH, etc.)
     * @param totalAmount Total tokens to lock
     * @param exchangeRate CNY per token unit (adjusted for token decimals)
     * @param alipayId Seller's Alipay account ID
     * @param alipayName Seller's Alipay account name
     * @return orderId Unique identifier for this order
     */
    function createAndLockOrder(
        address token,
        uint256 totalAmount,
        uint256 exchangeRate,
        string calldata alipayId,
        string calldata alipayName
    ) external nonReentrant whenNotPaused returns (bytes32 orderId) {
        // No min/max validation on order creation - sellers can lock any amount
        // Min/max limits are enforced per-trade when buyers fill orders
        
        // Query token decimals for accurate CNY calculations
        // Revert if token doesn't implement decimals() (non-standard token)
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        
        // Generate unique order ID
        orderId = keccak256(abi.encodePacked(
            msg.sender,
            totalAmount,
            exchangeRate,
            block.timestamp,
            counter++
        ));
        
        // Create order
        orders[orderId] = Order({
            orderId: orderId,
            seller: msg.sender,
            token: token,
            totalAmount: totalAmount,
            remainingAmount: totalAmount,
            exchangeRate: exchangeRate,
            alipayId: alipayId,
            alipayName: alipayName,
            createdAt: block.timestamp,
            tokenDecimals: tokenDecimals
        });
        
        // Transfer tokens from seller to this contract
        bool success = IERC20(token).transferFrom(msg.sender, address(this), totalAmount);
        if (!success) revert TransferFailed();
        
        emit OrderCreatedAndLocked(
            orderId,
            msg.sender,
            token,
            totalAmount,
            exchangeRate,
            alipayId,
            alipayName
        );
        
        return orderId;
    }
    
    /**
     * @notice Withdraw tokens from order (SELLER ACTION)
     * @dev Seller can withdraw any amount up to remaining amount
     * @param orderId Unique identifier for the order
     * @param amount Amount to withdraw (must be <= remainingAmount)
     */
    function withdrawAmount(bytes32 orderId, uint256 amount) external nonReentrant {
        Order storage order = orders[orderId];
        
        // Validate
        if (order.seller == address(0)) revert OrderNotFound();
        if (msg.sender != order.seller) revert NotAuthorized();
        if (amount > order.remainingAmount) revert WithdrawalExceedsAvailable();
        
        // Update order remaining amount
        order.remainingAmount -= amount;
        
        // Transfer tokens back to seller
        bool success = IERC20(order.token).transfer(order.seller, amount);
        if (!success) revert TransferFailed();
        
        emit OrderPartiallyWithdrawn(orderId, amount, order.remainingAmount);
    }
    
    // ============ Core Functions: Buyer Actions ============
    
    /**
     * @notice Fill an order (BUYER ACTION, called by backend after off-chain match)
     * @dev Creates a trade and reserves tokens from order's remaining amount
     * @param orderId Order to fill
     * @param buyer Buyer's address (who will receive tokens)
     * @param fillAmount Amount of tokens buyer wants
     * @return tradeId Unique identifier for this trade
     * @return paymentNonce Unique nonce buyer must include in Alipay payment
     */
    function fillOrder(
        bytes32 orderId,
        address buyer,
        uint256 fillAmount
    ) external nonReentrant whenNotPaused returns (bytes32 tradeId, string memory paymentNonce) {
        Order storage order = orders[orderId];
        
        // Validate order
        if (order.seller == address(0)) revert OrderNotFound();
        
        // Validate fill amount (value-based check using exchange rate)
        // Use cached token decimals for accurate CNY calculation
        uint256 fillValueCny = (fillAmount * order.exchangeRate) / 10**order.tokenDecimals;
        if (fillValueCny < minTradeValueCny) revert AmountBelowMinimum();
        if (fillValueCny > maxTradeValueCny) revert AmountTooLarge();
        if (fillAmount > order.remainingAmount) revert AmountExceedsAvailable();
        
        // Generate unique trade ID and nonce
        tradeId = keccak256(abi.encodePacked(
            orderId,
            buyer,
            fillAmount,
            block.timestamp,
            counter++
        ));
        
        // Generate 8-digit payment nonce from trade ID
        // This is short enough for users to type in Alipay payment notes
        paymentNonce = _generate8DigitNonce(tradeId);
        
        // Calculate CNY amount (exchange rate is CNY cents per token unit)
        // Use cached token decimals for accurate calculation
        uint256 cnyAmount = (fillAmount * order.exchangeRate) / 10**order.tokenDecimals;
        
        // Calculate trade expiration (payment window)
        uint256 tradeExpiresAt = block.timestamp + paymentWindow;
        
        // Create trade (seller/token can be derived from orderId)
        trades[tradeId] = Trade({
            tradeId: tradeId,
            orderId: orderId,
            buyer: buyer,
            tokenAmount: fillAmount,
            cnyAmount: cnyAmount,
            paymentNonce: paymentNonce,
            createdAt: block.timestamp,
            expiresAt: tradeExpiresAt,
            status: TradeStatus.PENDING
        });
        
        // Update order remaining amount
        order.remainingAmount -= fillAmount;
        
        emit TradeCreated(
            tradeId,
            orderId,
            buyer,
            order.token,
            fillAmount,
            cnyAmount,
            paymentNonce,
            tradeExpiresAt
        );
        
        return (tradeId, paymentNonce);
    }
    
    /**
     * @notice Submit payment proof and auto-settle trade (BUYER ACTION)
     * @dev Verifies zkPDF proof via OpenVM and immediately releases tokens to buyer
     * @param tradeId Unique identifier for the trade
     * @param userPublicValues Public output from proof (32 bytes hash)
     * @param accumulator Proof accumulator (384 bytes)
     * @param proof Halo2 proof data (1376 bytes)
     */
    function submitPaymentProof(
        bytes32 tradeId,
        bytes32 userPublicValues,
        bytes calldata accumulator,
        bytes calldata proof
    ) external nonReentrant whenNotPaused {
        Trade storage trade = trades[tradeId];
        Order storage order = orders[trade.orderId];
        
        // Validate trade
        if (trade.buyer == address(0)) revert TradeNotFound();
        if (trade.status != TradeStatus.PENDING) revert TradeNotPending();
        
        // Check if trade expired (cannot submit proof after expiration)
        if (block.timestamp > trade.expiresAt) {
            revert TradeNotPending();
        }
        
        // Step 1: Compute expected output hash locally
        bytes32 expectedHash = computeExpectedOutputHash(
            order.alipayName,
            order.alipayId,
            trade.cnyAmount,
            trade.paymentNonce
        );
        
        // Step 2: Compare hashes (FIRST CHECK - fail fast)
        if (userPublicValues != expectedHash) revert PaymentDetailsMismatch();
        
        // Step 3: Verify cryptographic proof (SECOND CHECK)
        bytes memory publicValuesBytes = abi.encodePacked(userPublicValues);
        bytes memory proofData = abi.encodePacked(accumulator, proof);
        
        try zkVerifier.verify(
            publicValuesBytes,
            proofData,
            appExeCommit,
            appVmCommit
        ) {
            // Proof valid, proceed to settlement
        } catch {
            revert ProofVerificationFailed();
        }
        
        // Step 4: Update trade status
        trade.status = TradeStatus.SETTLED;
        
        emit ProofSubmitted(tradeId, keccak256(proofData));
        
        // Step 5: Auto-settle - Transfer tokens to buyer
        bool success = IERC20(order.token).transfer(trade.buyer, trade.tokenAmount);
        if (!success) revert TransferFailed();
        
        emit TradeSettled(tradeId);
    }
    
    // ============ Auto-Expiration (DoS Protection) ============
    
    /**
     * @notice Cancel expired trade (ANYONE CAN CALL - DoS protection)
     * @dev Returns tokens to order pool if trade expired without proof
     * @param tradeId Unique identifier for the trade
     */
    function cancelExpiredTrade(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        Order storage order = orders[trade.orderId];
        
        // Validate trade
        if (trade.buyer == address(0)) revert TradeNotFound();
        if (trade.status != TradeStatus.PENDING) revert TradeNotPending();
        
        // Check if trade expired
        if (block.timestamp <= trade.expiresAt) revert TradeNotExpired();
        
        // Update trade status
        trade.status = TradeStatus.EXPIRED;
        
        // Return tokens to order pool (available for other buyers)
        order.remainingAmount += trade.tokenAmount;
        
        emit TradeExpired(tradeId, trade.orderId, trade.tokenAmount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get order details
     * @param orderId Unique identifier for the order
     * @return Order struct
     */
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    /**
     * @notice Get trade details
     * @param tradeId Unique identifier for the trade
     * @return Trade struct
     */
    function getTrade(bytes32 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
    
    /**
     * @notice Check if order can be filled
     * @param orderId Unique identifier for the order
     * @return bool True if order has remaining amount available
     */
    function isOrderFillable(bytes32 orderId) external view returns (bool) {
        Order memory order = orders[orderId];
        return order.remainingAmount > 0;
    }
    
    /**
     * @notice Get trade status as uint8 for easier debugging
     * @param tradeId Unique identifier for the trade
     * @return status 0=PENDING, 1=SETTLED, 2=EXPIRED
     */
    function getTradeStatus(bytes32 tradeId) external view returns (uint8) {
        return uint8(trades[tradeId].status);
    }
    
    /**
     * @notice Get order remaining amount
     * @param orderId Unique identifier for the order
     * @return remainingAmount Tokens still available
     */
    function getOrderRemainingAmount(bytes32 orderId) external view returns (uint256) {
        return orders[orderId].remainingAmount;
    }
    
    /**
     * @notice Get order total amount
     * @param orderId Unique identifier for the order
     * @return totalAmount Total tokens locked in order
     */
    function getOrderTotalAmount(bytes32 orderId) external view returns (uint256) {
        return orders[orderId].totalAmount;
    }
    
    /**
     * @notice Get order Alipay ID
     * @param orderId Unique identifier for the order
     * @return alipayId Seller's Alipay account ID
     */
    function getOrderAlipayId(bytes32 orderId) external view returns (string memory) {
        return orders[orderId].alipayId;
    }
    
    /**
     * @notice Get order Alipay Name
     * @param orderId Unique identifier for the order
     * @return alipayName Seller's Alipay account name
     */
    function getOrderAlipayName(bytes32 orderId) external view returns (string memory) {
        return orders[orderId].alipayName;
    }
    
    // ============ Internal Helper Functions ============
    
    /**
     * @notice Compute expected output hash (mirrors Rust logic)
     * @param alipayName Seller's Alipay account name (supports Chinese)
     * @param alipayId Seller's Alipay account ID (11 digits, will be masked)
     * @param cnyAmountCents CNY amount in cents
     * @param paymentNonce Payment nonce from trade
     * @return bytes32 Expected 32-byte SHA256 hash
     */
    function computeExpectedOutputHash(
        string memory alipayName,
        string memory alipayId,
        uint256 cnyAmountCents,
        string memory paymentNonce
    ) internal view returns (bytes32) {
        // Hardcoded line numbers: 20, 21, 29, 32
        uint32[4] memory lineNumbers = [uint32(20), uint32(21), uint32(29), uint32(32)];
        
        // Format CNY amount to string format
        string memory cnyFormatted = formatCnyAmount(cnyAmountCents);
        
        // Mask Alipay ID: show first 3 and last 2 digits, mask middle 6
        string memory maskedAlipayId = maskAlipayId(alipayId);
        
        // Build line texts with Chinese prefixes
        string memory line20 = string(abi.encodePacked(unicode"账户名：", alipayName));
        string memory line21 = string(abi.encodePacked(unicode"账号：", maskedAlipayId));
        string memory line29 = string(abi.encodePacked(unicode"小写：", cnyFormatted));
        string memory line32 = paymentNonce;  // Just the nonce, no prefix
        
        // Compute lines hash (SHA256 of: line_num_0 || line_text_0 || line_num_1 || line_text_1 || ...)
        bytes memory linesData = abi.encodePacked(
            _uint32ToLittleEndian(lineNumbers[0]), bytes(line20),
            _uint32ToLittleEndian(lineNumbers[1]), bytes(line21),
            _uint32ToLittleEndian(lineNumbers[2]), bytes(line29),
            _uint32ToLittleEndian(lineNumbers[3]), bytes(line32)
        );
        bytes32 linesHash = sha256(linesData);
        
        // Compute final output hash: SHA256(result || publicKeyDerHash || linesHash)
        // result is always true (0x01)
        bytes memory finalData = abi.encodePacked(
            bytes1(0x01),         // result = true (1 byte)
            publicKeyDerHash,     // 32 bytes
            linesHash             // 32 bytes
        );
        
        return sha256(finalData);
    }
    
    /**
     * @notice Format CNY amount from cents to "xxxx.xx" string
     * @param cnyAmountCents Amount in cents
     * @return Formatted string with two decimal places
     */
    function formatCnyAmount(uint256 cnyAmountCents) internal pure returns (string memory) {
        uint256 yuan = cnyAmountCents / 100;
        uint256 cents = cnyAmountCents % 100;
        
        // Convert yuan to string
        string memory yuanStr = _uint256ToString(yuan);
        
        // Convert cents to 2-digit string
        string memory centsStr;
        if (cents < 10) {
            centsStr = string(abi.encodePacked("0", _uint256ToString(cents)));
        } else {
            centsStr = _uint256ToString(cents);
        }
        
        return string(abi.encodePacked(yuanStr, ".", centsStr));
    }
    
    /**
     * @notice Mask Alipay ID: show first 3 and last 2 digits, mask middle 6
     * @param alipayId 11-digit Alipay ID
     * @return Masked ID with format: XXX******XX
     */
    function maskAlipayId(string memory alipayId) internal pure returns (string memory) {
        bytes memory idBytes = bytes(alipayId);
        require(idBytes.length == 11, "Invalid Alipay ID length");
        
        // Extract first 3 digits
        bytes memory first3 = new bytes(3);
        first3[0] = idBytes[0];
        first3[1] = idBytes[1];
        first3[2] = idBytes[2];
        
        // Extract last 2 digits
        bytes memory last2 = new bytes(2);
        last2[0] = idBytes[9];
        last2[1] = idBytes[10];
        
        // Return: first3 + "******" + last2
        return string(abi.encodePacked(
            string(first3),
            "******",
            string(last2)
        ));
    }
    
    /**
     * @notice Convert uint32 to little-endian bytes (4 bytes)
     * @param value uint32 value
     * @return Little-endian bytes
     */
    function _uint32ToLittleEndian(uint32 value) internal pure returns (bytes memory) {
        bytes memory result = new bytes(4);
        result[0] = bytes1(uint8(value));
        result[1] = bytes1(uint8(value >> 8));
        result[2] = bytes1(uint8(value >> 16));
        result[3] = bytes1(uint8(value >> 24));
        return result;
    }
    
    /**
     * @notice Convert uint256 to string
     * @param value uint256 value
     * @return String representation
     */
    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update configuration parameters
     * @dev Only owner can call
     * @param _minTradeValueCny New min trade value in CNY cents (0 = no change)
     * @param _maxTradeValueCny New max trade value in CNY cents (0 = no change)
     * @param _paymentWindow New payment window (0 = no change)
     */
    function updateConfig(
        uint256 _minTradeValueCny,
        uint256 _maxTradeValueCny,
        uint256 _paymentWindow
    ) external onlyOwner {
        if (_minTradeValueCny > 0) minTradeValueCny = _minTradeValueCny;
        if (_maxTradeValueCny > 0) maxTradeValueCny = _maxTradeValueCny;
        if (_paymentWindow > 0) paymentWindow = _paymentWindow;
        
        emit ConfigUpdated(maxTradeValueCny, paymentWindow);
    }
    
    /**
     * @notice Update zkPDF verifier contract
     * @dev Only owner can call
     * @param _newVerifier Address of new verifier contract
     */
    function updateZkVerifier(address _newVerifier) external onlyOwner {
        address oldVerifier = address(zkVerifier);
        zkVerifier = IOpenVmHalo2Verifier(_newVerifier);
        emit ZkVerifierUpdated(oldVerifier, _newVerifier);
    }
    
    /**
     * @notice Update zkPDF configuration (public key hash and commitments)
     * @dev Only owner can call
     * @param _publicKeyDerHash New Alipay public key DER hash
     * @param _appExeCommit New guest program commitment
     * @param _appVmCommit New OpenVM version commitment
     */
    function updateZkPDFConfig(
        bytes32 _publicKeyDerHash,
        bytes32 _appExeCommit,
        bytes32 _appVmCommit
    ) external onlyOwner {
        publicKeyDerHash = _publicKeyDerHash;
        appExeCommit = _appExeCommit;
        appVmCommit = _appVmCommit;
        emit ZkPDFConfigUpdated(_publicKeyDerHash, _appExeCommit, _appVmCommit);
    }
    
    /**
     * @notice Pause the contract in case of emergency
     * @dev Only owner can call
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     * @dev Only owner can call
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Generate 8-digit payment nonce from trade ID
     * @dev Converts trade ID to uint256, takes modulo 100000000 to get 8 digits
     * @param tradeId The trade ID bytes32
     * @return 8-digit numeric string (e.g., "12345678")
     */
    function _generate8DigitNonce(bytes32 tradeId) internal pure returns (string memory) {
        // Convert bytes32 to uint256 and get last 8 digits
        uint256 numericValue = uint256(tradeId) % 100000000;
        
        // Convert to string with leading zeros if needed
        bytes memory digits = "0123456789";
        bytes memory result = new bytes(8);
        
        for (uint256 i = 0; i < 8; i++) {
            result[7 - i] = digits[numericValue % 10];
            numericValue /= 10;
        }
        
        return string(result);
    }
    
    /**
     * @notice Convert bytes32 to hex string (for nonce generation)
     * @param data Bytes32 data
     * @return Hex string
     */
    function _toHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(data[i] >> 4)];
            str[i * 2 + 1] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}

