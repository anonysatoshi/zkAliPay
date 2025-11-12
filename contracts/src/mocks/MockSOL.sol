// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockSOL
 * @notice Mock Wrapped SOL token for testing (9 decimals like real SOL)
 */
contract MockSOL is ERC20 {
    constructor() ERC20("Mock Wrapped SOL", "SOL") {}

    function decimals() public pure override returns (uint8) {
        return 9; // SOL uses 9 decimals
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

