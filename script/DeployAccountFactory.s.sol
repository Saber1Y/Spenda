// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";

/// @notice Deploys SimpleAccountFactory against the canonical EntryPoint v0.7 on BOT Chain 968,
///         and logs the counterfactual agent-account address for (AGENT_OWNER, SALT).
///
/// Supports both Phase-C deploy models — the logged counterfactual address is where the vault
/// policy and the paymaster signer registration must point, regardless of whether Phase C:
///   (a) creates the account up front via a normal `createAccount` tx (separate setup), or
///   (b) deploys it inside the first sponsored UserOp via initCode (deployment is gasless too).
/// This script only deploys the factory and logs the address; it does NOT create or fund the
/// account (invariant 2 — the agent account must hold zero balance and zero EntryPoint deposit).
contract DeployAccountFactory is Script {
    /// Canonical ERC-4337 v0.7 EntryPoint — verified deployed on chain 968 (byte-identical to
    /// Ethereum mainnet/Sepolia); see internal/PHASE-0-RECEIPTS.md.
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external returns (SimpleAccountFactory factory, address counterfactualAccount) {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address agentOwner = vm.envAddress("AGENT_OWNER");
        uint256 salt = vm.envOr("AGENT_SALT", uint256(0));

        vm.startBroadcast(deployerPk);
        factory = new SimpleAccountFactory(IEntryPoint(ENTRYPOINT));
        vm.stopBroadcast();

        counterfactualAccount = factory.getAddress(agentOwner, salt);

        console2.log("SimpleAccountFactory:", address(factory));
        console2.log("EntryPoint:", ENTRYPOINT);
        console2.log("Agent owner (EOA):", agentOwner);
        console2.log("Counterfactual agent account:", counterfactualAccount);
    }
}
