// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";

contract DeployRestrictedAccountFactory is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external returns (RestrictedAgentAccountFactory factory) {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address vault = vm.envAddress("SPENDA_VAULT");
        address paymaster = vm.envAddress("SPENDA_PAYMASTER");
        address agentOwner = vm.envAddress("AGENT_OWNER");
        uint256 salt = vm.envOr("AGENT_SALT", uint256(0));

        vm.startBroadcast(deployerPk);
        factory = new RestrictedAgentAccountFactory(IEntryPoint(ENTRYPOINT), vault, paymaster);
        vm.stopBroadcast();

        console2.log("RestrictedAgentAccountFactory:", address(factory));
        console2.log("Restricted agent:", factory.getAddress(agentOwner, salt));
    }
}
