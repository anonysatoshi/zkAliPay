// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockBTC
 * @notice Mock BTC token for testing
 * @dev Mimics wrapped BTC with 8 decimals
 */
contract MockBTC is ERC20 {
    constructor() ERC20("Mock Wrapped BTC", "BTC") {}
    
    function decimals() public pure override returns (uint8) {
        return 8;  // BTC typically has 8 decimals
    }
    
    /**
     * @notice Mint tokens for testing
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (with 8 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

