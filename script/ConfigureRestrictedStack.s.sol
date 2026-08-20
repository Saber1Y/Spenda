// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";
import {RestrictedAgentAccount} from "../src/RestrictedAgentAccount.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";

contract ConfigureRestrictedStack is Script {
    function run() external returns (RestrictedAgentAccount agent) {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address agentOwner = vm.envAddress("AGENT_OWNER");
        address vendor = vm.envAddress("SPENDA_VENDOR");
        uint256 salt = vm.envOr("AGENT_SALT", uint256(0));
        uint128 maxPerTx = uint128(vm.envOr("MAX_PER_TX", uint256(50e6)));
        uint128 dailyCap = uint128(vm.envOr("DAILY_CAP", uint256(250e6)));
        uint64 expiry = uint64(vm.envOr("POLICY_EXPIRY", block.timestamp + 30 days));
        uint256 vaultFunding = vm.envOr("VAULT_FUNDING", uint256(1000e6));
        uint256 paymasterFunding = vm.envOr("PAYMASTER_FUNDING", uint256(0.5 ether));

        MockUSD usd = MockUSD(vm.envAddress("SPENDA_TOKEN"));
        BOTSpendVault vault = BOTSpendVault(payable(vm.envAddress("SPENDA_VAULT")));
        BOTSpendPaymaster paymaster = BOTSpendPaymaster(payable(vm.envAddress("SPENDA_PAYMASTER")));
        RestrictedAgentAccountFactory factory =
            RestrictedAgentAccountFactory(vm.envAddress("SPENDA_RESTRICTED_FACTORY"));

        vm.startBroadcast(deployerPk);
        agent = factory.createAccount(agentOwner, salt);
        vault.setAgentPolicy(address(agent), maxPerTx, dailyCap, expiry, true);
        vault.setAllowedTarget(address(agent), vendor, true);
        vault.setAllowedToken(address(agent), address(usd), true);
        usd.mint(address(vault), vaultFunding);
        paymaster.deposit{value: paymasterFunding}();
        vm.stopBroadcast();

        console2.log("Restricted agent", address(agent));
        console2.log("Vendor", vendor);
        console2.log("Vault mUSD funding", vaultFunding);
        console2.log("Paymaster BOT deposit", paymasterFunding);
    }
}
