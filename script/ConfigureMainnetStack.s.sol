// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";
import {RestrictedAgentAccount} from "../src/RestrictedAgentAccount.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";

/// @notice Mainnet (chain 677) configuration: creates one restricted agent, sets its policy,
///         allowlists the official USDT as spend token and a vendor target, optionally funds
///         the vault with USDT held by the deployer, and deposits BOT into the paymaster.
///         No token is ever minted here; the vault only ever holds real USDT.
///         Requires env: DEPLOYER_PK, AGENT_OWNER (controller of the agent account), SPENDA_VENDOR.
contract ConfigureMainnetStack is Script {
    address internal constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address internal constant USDT = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;
    address internal constant VAULT = 0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b;
    address internal constant PAYMASTER = 0xde609E52D9164C227D4F174D6260289bc3E62eC2;
    address internal constant FACTORY = 0xe66dd4f6A29ab1843A39Df47f0D0f9e46F3B858f;

    function run() external returns (RestrictedAgentAccount agent) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        require(block.chainid == 677, "wrong chain: expected 677");
        require(USDT.code.length > 0 && VAULT.code.length > 0 && PAYMASTER.code.length > 0 && FACTORY.code.length > 0, "stack missing on chain");

        address agentOwner = vm.envAddress("AGENT_OWNER");
        address vendor = vm.envAddress("SPENDA_VENDOR");
        uint256 salt = vm.envOr("AGENT_SALT", uint256(0));
        uint128 maxPerTx = uint128(vm.envOr("MAX_PER_TX", uint256(10e6)));
        uint128 dailyCap = uint128(vm.envOr("DAILY_CAP", uint256(50e6)));
        uint64 expiry = uint64(vm.envOr("POLICY_EXPIRY", block.timestamp + 30 days));
        uint256 vaultFunding = vm.envOr("VAULT_FUNDING", uint256(0));
        uint256 paymasterFunding = vm.envOr("PAYMASTER_FUNDING", uint256(0.05 ether));

        BOTSpendVault vault = BOTSpendVault(payable(VAULT));
        BOTSpendPaymaster paymaster = BOTSpendPaymaster(payable(PAYMASTER));
        RestrictedAgentAccountFactory factory = RestrictedAgentAccountFactory(FACTORY);
        IERC20 usdt = IERC20(USDT);

        if (vaultFunding > 0) {
            require(usdt.balanceOf(deployer) >= vaultFunding, "deployer lacks USDT for VAULT_FUNDING");
        }
        if (paymasterFunding > 0) {
            require(deployer.balance >= paymasterFunding + 0.01 ether, "deployer lacks gas headroom for deposit");
        }

        vm.startBroadcast(pk);
        agent = factory.createAccount(agentOwner, salt);
        vault.setAgentPolicy(address(agent), maxPerTx, dailyCap, expiry, true);
        vault.setAllowedTarget(address(agent), vendor, true);
        vault.setAllowedToken(address(agent), USDT, true);
        if (vaultFunding > 0) {
            usdt.transfer(VAULT, vaultFunding);
        }
        if (paymasterFunding > 0) {
            paymaster.deposit{value: paymasterFunding}();
        }
        vm.stopBroadcast();

        console2.log("agent                   ", address(agent));
        console2.log("agent owner             ", agentOwner);
        console2.log("vendor                  ", vendor);
        console2.log("maxPerTx (6dp)          ", maxPerTx);
        console2.log("dailyCap (6dp)          ", dailyCap);
        console2.log("policy expiry           ", expiry);
        console2.log("vault USDT funding      ", vaultFunding);
        console2.log("paymaster BOT deposit   ", paymasterFunding);
    }
}
