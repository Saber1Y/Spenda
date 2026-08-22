// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";

/// @notice Rotates only the paymaster and restricted-account factory around an existing vault.
///         The vault owner remains the DEPLOYER_PK-derived address and no new vault is deployed.
///         Requires DEPLOYER_PK, VERIFYING_SIGNER, and SPENDA_VAULT.
contract RotateMainnetPaymaster is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run()
        external
        returns (BOTSpendPaymaster paymaster, RestrictedAgentAccountFactory factory)
    {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address vault = vm.envAddress("SPENDA_VAULT");
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");

        require(block.chainid == 677, "wrong chain: expected 677");
        require(deployer.balance > 0, "deployer has no BOT for gas");
        require(ENTRYPOINT.code.length > 0, "entrypoint missing on chain");
        require(vault.code.length > 0, "vault missing on chain");
        require(verifyingSigner != address(0), "verifying signer required");
        require(verifyingSigner != deployer, "paymaster signer must be separate");

        vm.startBroadcast(pk);
        paymaster = new BOTSpendPaymaster(IEntryPoint(ENTRYPOINT), verifyingSigner, vault);
        factory = new RestrictedAgentAccountFactory(IEntryPoint(ENTRYPOINT), vault, address(paymaster));
        vm.stopBroadcast();

        console2.log("chainId                 ", block.chainid);
        console2.log("existing vault          ", vault);
        console2.log("new paymaster           ", address(paymaster));
        console2.log("new restricted factory  ", address(factory));
        console2.log("vault owner/deployer    ", deployer);
        console2.log("new verifying signer    ", verifyingSigner);
        console2.log("NOTE: configure the new factory and fund the new paymaster next.");
    }
}
