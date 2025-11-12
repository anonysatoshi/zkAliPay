// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT
 * @notice Mock USDT token for testing (6 decimals like real USDT)
 */
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock Tether USD", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6; // USDT uses 6 decimals
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

