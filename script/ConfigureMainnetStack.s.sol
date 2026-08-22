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
    address internal constant USDT = 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C;
    address internal constant VAULT = 0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b;
    address internal constant PAYMASTER = 0xde609E52D9164C227D4F174D6260289bc3E62eC2;
    address internal constant FACTORY = 0xe66dd4f6A29ab1843A39Df47f0D0f9e46F3B858f;

    struct AgentConfig {
        address owner;
        address vendor;
        uint256 salt;
        uint128 maxPerTx;
        uint128 dailyCap;
        uint64 expiry;
        uint256 vaultFunding;
        uint256 paymasterFunding;
    }

    function run() external returns (RestrictedAgentAccount agent) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        require(block.chainid == 677, "wrong chain: expected 677");
        require(_hasCode(USDT) && _hasCode(VAULT) && _hasCode(PAYMASTER) && _hasCode(FACTORY), "stack missing on chain");

        AgentConfig memory cfg = _readConfig();
        _validate(cfg);

        vm.startBroadcast(pk);
        agent = RestrictedAgentAccountFactory(FACTORY).createAccount(cfg.owner, cfg.salt);
        BOTSpendVault(payable(VAULT)).setAgentPolicy(address(agent), cfg.maxPerTx, cfg.dailyCap, cfg.expiry, true);
        BOTSpendVault(payable(VAULT)).setAllowedTarget(address(agent), cfg.vendor, true);
        BOTSpendVault(payable(VAULT)).setAllowedToken(address(agent), USDT, true);
        if (cfg.vaultFunding > 0) {
            IERC20(USDT).transfer(VAULT, cfg.vaultFunding);
        }
        if (cfg.paymasterFunding > 0) {
            BOTSpendPaymaster(payable(PAYMASTER)).deposit{value: cfg.paymasterFunding}();
        }
        vm.stopBroadcast();

        console2.log("agent                   ", address(agent));
        console2.log("agent owner             ", cfg.owner);
        console2.log("vendor                  ", cfg.vendor);
        console2.log("maxPerTx (6dp)          ", cfg.maxPerTx);
        console2.log("dailyCap (6dp)          ", cfg.dailyCap);
        console2.log("policy expiry           ", cfg.expiry);
        console2.log("vault USDT funding      ", cfg.vaultFunding);
        console2.log("paymaster BOT deposit   ", cfg.paymasterFunding);
    }

    function _readConfig() internal view returns (AgentConfig memory cfg) {
        cfg.owner = vm.envAddress("AGENT_OWNER");
        cfg.vendor = vm.envAddress("SPENDA_VENDOR");
        cfg.salt = vm.envOr("AGENT_SALT", uint256(0));
        cfg.maxPerTx = uint128(vm.envOr("MAX_PER_TX", uint256(10e6)));
        cfg.dailyCap = uint128(vm.envOr("DAILY_CAP", uint256(50e6)));
        cfg.expiry = uint64(vm.envOr("POLICY_EXPIRY", block.timestamp + 30 days));
        cfg.vaultFunding = vm.envOr("VAULT_FUNDING", uint256(0));
        cfg.paymasterFunding = vm.envOr("PAYMASTER_FUNDING", uint256(0.05 ether));
    }

    function _validate(AgentConfig memory cfg) internal view {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PK"));
        require(cfg.owner != address(0), "AGENT_OWNER required");
        require(cfg.vendor != address(0), "SPENDA_VENDOR required");
        if (cfg.vaultFunding > 0) {
            require(IERC20(USDT).balanceOf(deployer) >= cfg.vaultFunding, "deployer lacks USDT for VAULT_FUNDING");
        }
        if (cfg.paymasterFunding > 0) {
            require(deployer.balance >= cfg.paymasterFunding + 0.01 ether, "deployer lacks gas headroom for deposit");
        }
    }

    function _hasCode(address a) internal view returns (bool) {
        return a.code.length > 0;
    }
}
