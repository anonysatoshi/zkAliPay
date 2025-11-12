// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockETH
 * @notice Mock Wrapped ETH token for testing (18 decimals)
 */
contract MockETH is ERC20, Ownable {
    constructor() ERC20("Mock Wrapped ETH", "WETH") Ownable(msg.sender) {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1000 * 10**decimals()); // 1000 WETH
    }

    /**
     * @notice Mint tokens to any address (for testing only)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Faucet function - anyone can mint test tokens
     */
    function faucet() external {
        _mint(msg.sender, 10 * 10**decimals()); // 10 WETH per request
    }
}

