// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing
 * @dev Mimics USDC with 6 decimals
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}
    
    function decimals() public pure override returns (uint8) {
        return 6;  // USDC has 6 decimals
    }
    
    /**
     * @notice Mint tokens for testing
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (with 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

