// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";

/// @notice Deploys the policy-scoped BOTSpendPaymaster against the canonical EntryPoint v0.7 on
///         BOT Chain 968, and funds its EntryPoint DEPOSIT (not stake — B1 proved the paymaster is
///         ERC-7562 stake-exempt: immutable signer + ECDSA only, empty context).
///
/// Deposit sizing: the deposit pays gas for EVERY sponsored UserOp, INCLUDING policy-blocked ones
/// (the vault does not revert on a block, so the paymaster still pays). Size accordingly; this is
/// the deliberate, bounded tradeoff. PAYMASTER_DEPOSIT (wei) defaults to 0.05 BOT.
contract DeployPaymaster is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external returns (BOTSpendPaymaster paymaster) {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");
        address vault = vm.envAddress("VAULT");
        uint256 deposit = vm.envOr("PAYMASTER_DEPOSIT", uint256(0.05 ether));

        vm.startBroadcast(deployerPk);
        paymaster = new BOTSpendPaymaster(IEntryPoint(ENTRYPOINT), verifyingSigner, vault);
        paymaster.deposit{value: deposit}();
        vm.stopBroadcast();

        console2.log("BOTSpendPaymaster:", address(paymaster));
        console2.log("  verifyingSigner:", verifyingSigner);
        console2.log("  vault:", vault);
        console2.log("  EntryPoint deposit (wei):", paymaster.getDeposit());
    }
}
