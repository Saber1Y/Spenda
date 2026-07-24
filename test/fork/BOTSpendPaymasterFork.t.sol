// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SimpleAccount} from "@account-abstraction/contracts/samples/SimpleAccount.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";

import {UserOpHelper} from "../helpers/UserOpHelper.sol";
import {BOTSpendPaymaster} from "../../src/BOTSpendPaymaster.sol";
import {BOTSpendVault} from "../../src/BOTSpendVault.sol";
import {MockUSD} from "../../src/MockUSD.sol";

/// @notice Phase B4 — the SAME paymaster flow, but against the REAL canonical EntryPoint v0.7
///         deployed on BOT Chain testnet 968 (forked), not a fresh local redeploy. Proves our
///         paymaster + account + vault are compatible with the exact on-chain EntryPoint bytecode.
///
/// Requires RPC access to rpc.bohr.life. Run with `forge test --match-path "test/fork/*"`; exclude
/// with `--no-match-path "test/fork/*"` for fully hermetic runs.
contract BOTSpendPaymasterForkTest is UserOpHelper {
    address internal constant CANONICAL_ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    SimpleAccountFactory factory;
    BOTSpendVault vault;
    MockUSD usd;

    uint256 constant SIGNER_PK = 0x51611E4;
    uint256 constant AGENT_OWNER_PK = 0xA11CE;
    address signer;
    address agentOwner;

    address vaultOwner = makeAddr("vaultOwner");
    address vendor = makeAddr("vendor");
    address beneficiary = makeAddr("bundlerBeneficiary");

    uint128 constant MAX_PER_TX = 5e6;
    uint128 constant DAILY_CAP = 20e6;
    uint256 constant SPEND = 4e6;

    function setUp() public {
        vm.createSelectFork("bot_testnet");
        signer = vm.addr(SIGNER_PK);
        agentOwner = vm.addr(AGENT_OWNER_PK);

        entryPoint = IEntryPoint(CANONICAL_ENTRYPOINT);
        // sanity: we forked a chain where the canonical EntryPoint actually exists
        require(CANONICAL_ENTRYPOINT.code.length > 0, "EntryPoint not deployed on fork");

        factory = new SimpleAccountFactory(entryPoint);
        vault = new BOTSpendVault(vaultOwner);
        usd = new MockUSD();
        paymaster = new BOTSpendPaymaster(entryPoint, signer, address(vault));
    }

    function _defaultCallData(address dest) internal view returns (bytes memory) {
        return _executeVaultCallData(dest, address(usd), vendor, SPEND, keccak256("fork-op-1"));
    }

    function _wireVaultForAccount(address account) internal {
        usd.mint(address(vault), 1_000e6);
        vm.startPrank(vaultOwner);
        vault.setAgentPolicy(account, MAX_PER_TX, DAILY_CAP, uint64(block.timestamp + 30 days), true);
        vault.setAllowedTarget(account, vendor, true);
        vault.setAllowedToken(account, address(usd), true);
        vm.stopPrank();
    }

    /// The gasless proof against the REAL on-chain EntryPoint: agent account at 0 balance + 0
    /// deposit completes an approved vault spend; the paymaster's deposit pays.
    function test_Fork_SponsoredApprovedSpend_Gasless() public {
        SimpleAccount account = factory.createAccount(agentOwner, 0);
        _wireVaultForAccount(address(account));
        vm.deal(address(this), 2 ether);
        paymaster.deposit{value: 1 ether}();

        Op memory o = Op(address(account), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        _addOwnerSig(op, AGENT_OWNER_PK);

        assertEq(address(account).balance, 0);
        assertEq(entryPoint.balanceOf(address(account)), 0);
        uint256 pmDepositBefore = paymaster.getDeposit();

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(beneficiary));

        assertEq(usd.balanceOf(vendor), SPEND, "vault executed the approved spend (real EntryPoint)");
        assertEq(address(account).balance, 0, "agent account still holds 0 native");
        assertEq(entryPoint.balanceOf(address(account)), 0, "agent account still has 0 deposit");
        assertLt(paymaster.getDeposit(), pmDepositBefore, "paymaster deposit paid the gas");
    }

    function test_Fork_OffScopeDest_RevertsAA34() public {
        SimpleAccount account = factory.createAccount(agentOwner, 0);
        _wireVaultForAccount(address(account));
        vm.deal(address(this), 1 ether);
        paymaster.deposit{value: 1 ether}();

        Op memory o = Op(address(account), _defaultCallData(makeAddr("notVault")), uint48(block.timestamp + 300), 0);
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        _addOwnerSig(op, AGENT_OWNER_PK);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA34 signature error"));
        entryPoint.handleOps(ops, payable(beneficiary));
    }
}
