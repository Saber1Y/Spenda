// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";

/// @notice Phase C1 — deploy the full stack to BOT Chain 968 in dependency order:
///         MockUSD -> BOTSpendVault(owner=deployer) -> SimpleAccountFactory(entryPoint)
///         -> BOTSpendPaymaster(entryPoint, verifyingSigner, vault).
///         Does NOT fund the paymaster deposit (C4) and never deposits to an agent account.
contract DeployAll is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run()
        external
        returns (MockUSD usd, BOTSpendVault vault, SimpleAccountFactory factory, BOTSpendPaymaster paymaster)
    {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");

        vm.startBroadcast(pk);
        usd = new MockUSD();
        vault = new BOTSpendVault(deployer);
        factory = new SimpleAccountFactory(IEntryPoint(ENTRYPOINT));
        paymaster = new BOTSpendPaymaster(IEntryPoint(ENTRYPOINT), verifyingSigner, address(vault));
        vm.stopBroadcast();

        console2.log("MockUSD             ", address(usd));
        console2.log("SpendaVault         ", address(vault));
        console2.log("SimpleAccountFactory", address(factory));
        console2.log("SpendaPaymaster     ", address(paymaster));
        console2.log("deployer            ", deployer);
        console2.log("verifyingSigner     ", verifyingSigner);
    }
}
