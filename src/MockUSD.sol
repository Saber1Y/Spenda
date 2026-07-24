// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSD
/// @notice A 6-decimal test stablecoin used as the Spenda spend asset on BOT Chain testnet.
/// @dev BOT Chain testnet exposes no canonical, publicly-obtainable stablecoin with a documented
///      address (the mainnet USDT address resolves to a different token on testnet, and faucet
///      stablecoins are Discord-gated with unpublished addresses). MockUSD is a real ERC20 deployed
///      on the live testnet — not simulated data. Mint is open so the acceptance runs can fund the
///      vault without a gated faucet.
contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
