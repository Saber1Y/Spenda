// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";

/// @notice Mainnet (chain 677) deployment in dependency order:
///         BOTSpendVault(owner=deployer) -> BOTSpendPaymaster -> RestrictedAgentAccountFactory.
///         Official USDT is the spend token; MockUSD is never deployed here.
///         Requires env: DEPLOYER_PK (funded deployer key), VERIFYING_SIGNER (separate paymaster signer address).
contract DeployMainnet is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address internal constant USDT = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;

    function run()
        external
        returns (BOTSpendVault vault, RestrictedAgentAccountFactory factory, BOTSpendPaymaster paymaster)
    {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");

        require(block.chainid == 677, "wrong chain: expected 677");
        require(deployer.balance > 0, "deployer has no BOT for gas");
        require(ENTRYPOINT.code.length > 0, "entrypoint missing on chain");
        require(USDT.code.length > 0, "USDT missing on chain");
        require(verifyingSigner != address(0), "verifying signer required");
        require(verifyingSigner != deployer, "paymaster signer must be a separate key");

        vm.startBroadcast(pk);
        vault = new BOTSpendVault(deployer);
        paymaster = new BOTSpendPaymaster(IEntryPoint(ENTRYPOINT), verifyingSigner, address(vault));
        factory = new RestrictedAgentAccountFactory(IEntryPoint(ENTRYPOINT), address(vault), address(paymaster));
        vm.stopBroadcast();

        console2.log("chainId                 ", block.chainid);
        console2.log("USDT (official, external)", USDT);
        console2.log("SpendaVault             ", address(vault));
        console2.log("RestrictedAccountFactory", address(factory));
        console2.log("SpendaPaymaster         ", address(paymaster));
        console2.log("deployer/vault owner    ", deployer);
        console2.log("verifyingSigner         ", verifyingSigner);
        console2.log("NOTE: fund paymaster deposit next; agents stay at zero custody.");
    }
}
