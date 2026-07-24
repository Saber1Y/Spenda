// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {IStakeManager} from "@account-abstraction/contracts/interfaces/IStakeManager.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SimpleAccount} from "@account-abstraction/contracts/samples/SimpleAccount.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";

import {UserOpHelper} from "./helpers/UserOpHelper.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// @notice Phase B4 — the policy-scoped VerifyingPaymaster (Fence 1), hermetic (fresh EntryPoint).
///         Unit tests exercise `validatePaymasterUserOp` (pranked EntryPoint); the integration test
///         runs `EntryPoint.handleOps` end-to-end — the local dress-rehearsal of the Phase C gasless
///         proof. A fork variant against the canonical on-chain EntryPoint lives in test/fork/.
contract BOTSpendPaymasterTest is UserOpHelper {
    SimpleAccountFactory factory;
    BOTSpendVault vault;
    MockUSD usd;

    uint256 constant SIGNER_PK = 0x51611E4;
    uint256 constant WRONG_PK = 0xBAD5164E4;
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
        vm.warp(1_000_000); // real timestamp so a past validUntil is nonzero (0 = "no expiry")
        signer = vm.addr(SIGNER_PK);
        agentOwner = vm.addr(AGENT_OWNER_PK);

        entryPoint = new EntryPoint();
        factory = new SimpleAccountFactory(IEntryPoint(address(entryPoint)));
        vault = new BOTSpendVault(vaultOwner);
        usd = new MockUSD();
        paymaster = new BOTSpendPaymaster(IEntryPoint(address(entryPoint)), signer, address(vault));
    }

    function _defaultCallData(address dest) internal view returns (bytes memory) {
        return _executeVaultCallData(dest, address(usd), vendor, SPEND, keccak256("op-1"));
    }

    // ------------------------------------------------------------- unit tests

    function test_Sponsored_ValidSig_VaultDest() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        (bytes memory ctx, uint256 vd) = _validate(_buildWithPaymasterSig(o, SIGNER_PK));
        assertEq(_agg(vd), 0, "sponsored: sig valid");
        assertEq(_validUntil(vd), uint48(block.timestamp + 300), "validUntil packed");
        assertEq(_validAfter(vd), 0, "validAfter packed");
        assertEq(ctx.length, 0, "empty context (EREP-050: postOp stays uncalled)");
    }

    function test_SigFailed_WrongSigner() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        (, uint256 vd) = _validate(_buildWithPaymasterSig(o, WRONG_PK));
        assertTrue(_sigFailed(vd), "wrong signer -> SIG_VALIDATION_FAILED (no revert)");
    }

    function test_DestGate_RefusesNonVault_EvenWithValidSig() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(makeAddr("notVault")), uint48(block.timestamp + 300), 0);
        (, uint256 vd) = _validate(_buildWithPaymasterSig(o, SIGNER_PK));
        assertTrue(_sigFailed(vd), "dest != VAULT -> refused on-chain (the hardening gate)");
    }

    function test_WrongSelector_Refused() public {
        bytes memory badCd = abi.encodeWithSelector(bytes4(0x12345678), address(vault), uint256(0), bytes(""));
        Op memory o = Op(makeAddr("acct"), badCd, uint48(block.timestamp + 300), 0);
        (, uint256 vd) = _validate(_buildWithPaymasterSig(o, SIGNER_PK));
        assertTrue(_sigFailed(vd), "selector != execute -> refused");
    }

    function test_MalformedCallData_Refused() public {
        Op memory o = Op(makeAddr("acct"), hex"b61d27f6", uint48(block.timestamp + 300), 0); // < 36 bytes
        (, uint256 vd) = _validate(_buildWithPaymasterSig(o, SIGNER_PK));
        assertTrue(_sigFailed(vd), "too-short callData -> refused");
    }

    function test_InvalidSignatureLength_Reverts() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        bytes memory pmdNoSig =
            abi.encodePacked(address(paymaster), PM_VGL, PM_PGL, abi.encode(o.validUntil, o.validAfter));
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        op.paymasterAndData = abi.encodePacked(pmdNoSig, new bytes(10)); // 10-byte sig (not 64/65)
        vm.prank(address(entryPoint));
        vm.expectRevert(bytes("BOTSpendPaymaster: invalid signature length"));
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    function test_CallDataBinding_TamperInvalidatesSig() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        // tamper callData after signing (still targets vault so the gate passes) -> sig must fail
        op.callData = _executeVaultCallData(address(vault), address(usd), vendor, SPEND * 2, keccak256("op-1"));
        (, uint256 vd) = _validate(op);
        assertTrue(_sigFailed(vd), "tampered callData -> sig no longer recovers to signer");
    }

    function test_ParsePaymasterAndData_Decodes() public view {
        uint48 vu = uint48(block.timestamp + 100);
        uint48 va = 7;
        bytes memory pmd = abi.encodePacked(address(paymaster), PM_VGL, PM_PGL, abi.encode(vu, va), new bytes(65));
        (uint48 gotUntil, uint48 gotAfter, bytes memory gotSig) = paymaster.parsePaymasterAndData(pmd);
        assertEq(gotUntil, vu);
        assertEq(gotAfter, va);
        assertEq(gotSig.length, 65);
    }

    function test_OnlyEntryPoint_CanValidate() public {
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), uint48(block.timestamp + 300), 0);
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(bytes("Sender not EntryPoint"));
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    function test_ExpiredWindow_PackedForEntryPoint() public {
        uint48 pastUntil = uint48(block.timestamp - 1);
        Op memory o = Op(makeAddr("acct"), _defaultCallData(address(vault)), pastUntil, 0);
        (, uint256 vd) = _validate(_buildWithPaymasterSig(o, SIGNER_PK));
        assertEq(_agg(vd), 0, "sig itself is valid");
        assertEq(_validUntil(vd), pastUntil, "past validUntil packed -> EntryPoint rejects as expired");
    }

    function test_DepositOnly_NoStake() public {
        vm.deal(address(this), 1 ether);
        paymaster.deposit{value: 1 ether}();
        assertEq(paymaster.getDeposit(), 1 ether, "deposit funded (== entryPoint.balanceOf)");
        assertEq(entryPoint.balanceOf(address(paymaster)), 1 ether);
        IStakeManager.DepositInfo memory info = entryPoint.getDepositInfo(address(paymaster));
        assertFalse(info.staked, "not staked (deposit-only, v1)");
        assertEq(info.stake, 0);
    }

    // ------------------------------------------------------- integration (handleOps)

    function _wireVaultForAccount(address account) internal {
        usd.mint(address(vault), 1_000e6);
        vm.startPrank(vaultOwner);
        vault.setAgentPolicy(account, MAX_PER_TX, DAILY_CAP, uint64(block.timestamp + 30 days), true);
        vault.setAllowedTarget(account, vendor, true);
        vault.setAllowedToken(account, address(usd), true);
        vm.stopPrank();
    }

    function test_Integration_SponsoredApprovedSpend_Gasless() public {
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

        assertEq(usd.balanceOf(vendor), SPEND, "vault executed the approved spend");
        assertEq(vault.getPolicy(address(account)).spentToday, SPEND, "vault state updated");
        assertEq(address(account).balance, 0, "agent account still holds 0 native");
        assertEq(entryPoint.balanceOf(address(account)), 0, "agent account still has 0 deposit");
        assertLt(paymaster.getDeposit(), pmDepositBefore, "paymaster deposit paid the gas");
        assertGt(beneficiary.balance, 0, "bundler beneficiary was paid");
    }

    function test_Integration_Expired_RevertsAA32() public {
        SimpleAccount account = factory.createAccount(agentOwner, 0);
        _wireVaultForAccount(address(account));
        vm.deal(address(this), 1 ether);
        paymaster.deposit{value: 1 ether}();

        Op memory o = Op(address(account), _defaultCallData(address(vault)), uint48(block.timestamp - 1), 0);
        PackedUserOperation memory op = _buildWithPaymasterSig(o, SIGNER_PK);
        _addOwnerSig(op, AGENT_OWNER_PK);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA32 paymaster expired or not due"));
        entryPoint.handleOps(ops, payable(beneficiary));
    }

    function test_Integration_OffScopeDest_RevertsAA34() public {
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
