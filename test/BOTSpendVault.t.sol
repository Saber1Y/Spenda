// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {ReentrantToken, IExecuteSpend} from "./mocks/ReentrantToken.sol";
import {RejectNative} from "./mocks/RejectNative.sol";

/// @notice Covers PRD §7 acceptance scenarios 1–10 (approved, every blocked reason, dedup replay)
///         plus an explicit reentrancy-attempt test, native path, owner guard, and daily reset.
contract BOTSpendVaultTest is Test {
    BOTSpendVault vault;
    MockUSD usd;

    address owner = address(this);
    address agent = makeAddr("agent");
    address vendor = makeAddr("vendor");
    address stranger = makeAddr("stranger");

    uint128 constant MAX_PER_TX = 5e6; // 5 mUSD
    uint128 constant DAILY_CAP = 20e6; // 20 mUSD
    uint256 constant VAULT_FUNDING = 100e6;
    uint64 expiry;

    // events mirrored for vm.expectEmit
    event VaultFunded(address indexed from, uint256 amount);
    event PolicyCreated(address indexed agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active);
    event PolicyUpdated(address indexed agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active);
    event TargetAllowlisted(address indexed agent, address indexed target, bool allowed);
    event TokenAllowlisted(address indexed agent, address indexed token, bool allowed);
    event AgentRevoked(address indexed agent);
    event AgentActionApproved(
        address indexed agent, address indexed target, address indexed token, uint256 amount, bytes32 actionId
    );
    event AgentActionBlocked(
        address indexed agent, address indexed target, address indexed token, uint256 amount, string reason
    );
    event ReceiptIssued(
        address indexed agent,
        address indexed target,
        address token,
        uint256 amount,
        bytes32 actionId,
        uint256 timestamp
    );

    function setUp() public {
        vm.warp(1_000_000); // stable, non-zero base time
        vault = new BOTSpendVault(owner);
        usd = new MockUSD();
        expiry = uint64(block.timestamp + 30 days);
        usd.mint(address(vault), VAULT_FUNDING);
    }

    function _configureAgent() internal {
        vault.setAgentPolicy(agent, MAX_PER_TX, DAILY_CAP, expiry, true);
        vault.setAllowedTarget(agent, vendor, true);
        vault.setAllowedToken(agent, address(usd), true);
    }

    function _spend(address token, address target, uint256 amount, bytes32 id) internal returns (bool ok) {
        vm.prank(agent);
        ok = vault.executeSpend(token, target, amount, "", id);
    }

    // ----------------------------------------------------------------
    // Scenario 1 — Deploy
    // ----------------------------------------------------------------
    function test_01_Deploy() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.NATIVE(), address(0));
        assertEq(usd.decimals(), 6);
        assertEq(usd.symbol(), "mUSD");
    }

    // ----------------------------------------------------------------
    // Scenario 2 — Fund (native emits VaultFunded; ERC20 raises balance)
    // ----------------------------------------------------------------
    function test_02_FundNative_EmitsVaultFunded() public {
        vm.deal(owner, 1 ether);
        vm.expectEmit(true, false, false, true, address(vault));
        emit VaultFunded(owner, 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(vault).balance, 1 ether);
    }

    function test_02_FundERC20_IncreasesBalance() public {
        assertEq(usd.balanceOf(address(vault)), VAULT_FUNDING);
        usd.mint(address(vault), 50e6);
        assertEq(usd.balanceOf(address(vault)), VAULT_FUNDING + 50e6);
    }

    // ----------------------------------------------------------------
    // Scenario 3 — Configure agent
    // ----------------------------------------------------------------
    function test_03_Configure_EmitsEventsAndState() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit PolicyCreated(agent, MAX_PER_TX, DAILY_CAP, expiry, true);
        vault.setAgentPolicy(agent, MAX_PER_TX, DAILY_CAP, expiry, true);

        vm.expectEmit(true, true, false, true, address(vault));
        emit TargetAllowlisted(agent, vendor, true);
        vault.setAllowedTarget(agent, vendor, true);

        vm.expectEmit(true, true, false, true, address(vault));
        emit TokenAllowlisted(agent, address(usd), true);
        vault.setAllowedToken(agent, address(usd), true);

        BOTSpendVault.Policy memory p = vault.getPolicy(agent);
        assertEq(p.maxPerTx, MAX_PER_TX);
        assertEq(p.dailyCap, DAILY_CAP);
        assertEq(p.expiry, expiry);
        assertTrue(p.active);
        assertTrue(vault.isAllowed(agent, vendor, address(usd)));
        assertEq(vault.remainingDailyCap(agent), DAILY_CAP);
    }

    function test_03b_SecondConfig_EmitsPolicyUpdated_PreservesSpend() public {
        _configureAgent();
        assertTrue(_spend(address(usd), vendor, 4e6, keccak256("pre")));
        assertEq(vault.getPolicy(agent).spentToday, 4e6);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PolicyUpdated(agent, 10e6, 40e6, expiry, true);
        vault.setAgentPolicy(agent, 10e6, 40e6, expiry, true);

        BOTSpendVault.Policy memory p = vault.getPolicy(agent);
        assertEq(p.maxPerTx, 10e6);
        assertEq(p.dailyCap, 40e6);
        assertEq(p.spentToday, 4e6, "spentToday must survive an update");
    }

    // ----------------------------------------------------------------
    // Scenario 4 — Approved spend
    // ----------------------------------------------------------------
    function test_04_ApprovedSpend() public {
        _configureAgent();
        bytes32 id = keccak256("a4");

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionApproved(agent, vendor, address(usd), 4e6, id);
        vm.expectEmit(true, true, false, true, address(vault));
        emit ReceiptIssued(agent, vendor, address(usd), 4e6, id, block.timestamp);

        assertTrue(_spend(address(usd), vendor, 4e6, id));

        assertEq(usd.balanceOf(vendor), 4e6);
        assertEq(usd.balanceOf(address(vault)), VAULT_FUNDING - 4e6);
        assertEq(vault.getPolicy(agent).spentToday, 4e6);
        assertEq(vault.remainingDailyCap(agent), DAILY_CAP - 4e6);
        assertTrue(vault.usedAction(id));
    }

    // ----------------------------------------------------------------
    // Scenario 5 — Blocked: over per-tx cap
    // ----------------------------------------------------------------
    function test_05_Blocked_ExceedsMaxPerTx() public {
        _configureAgent();
        bytes32 id = keccak256("a5");

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 10e6, "exceeds maxPerTx");

        assertFalse(_spend(address(usd), vendor, 10e6, id));
        assertEq(usd.balanceOf(vendor), 0);
        assertEq(usd.balanceOf(address(vault)), VAULT_FUNDING);
        assertEq(vault.getPolicy(agent).spentToday, 0);
        assertFalse(vault.usedAction(id), "blocked action must not consume actionId");
    }

    // ----------------------------------------------------------------
    // Scenario 6 — Blocked: non-allowlisted target
    // ----------------------------------------------------------------
    function test_06_Blocked_TargetNotAllowlisted() public {
        _configureAgent();
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, stranger, address(usd), 4e6, "target not allowlisted");
        assertFalse(_spend(address(usd), stranger, 4e6, keccak256("a6")));
        assertEq(usd.balanceOf(stranger), 0);
    }

    // ----------------------------------------------------------------
    // Scenario 7 — Blocked: non-allowlisted token
    // ----------------------------------------------------------------
    function test_07_Blocked_TokenNotAllowlisted() public {
        _configureAgent();
        MockUSD other = new MockUSD();
        other.mint(address(vault), 10e6);

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(other), 4e6, "token not allowlisted");
        assertFalse(_spend(address(other), vendor, 4e6, keccak256("a7")));
        assertEq(other.balanceOf(vendor), 0);
    }

    // ----------------------------------------------------------------
    // Scenario 8 — Blocked: daily cap
    // ----------------------------------------------------------------
    function test_08_Blocked_ExceedsDailyCap() public {
        _configureAgent();
        // 4 x 5 mUSD = 20 mUSD (== dailyCap), all approved
        for (uint256 i = 0; i < 4; i++) {
            assertTrue(_spend(address(usd), vendor, 5e6, keccak256(abi.encode("fill", i))));
        }
        assertEq(vault.getPolicy(agent).spentToday, DAILY_CAP);
        assertEq(vault.remainingDailyCap(agent), 0);

        // next spend, even 1 unit, exceeds the daily cap
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 1e6, "exceeds dailyCap");
        assertFalse(_spend(address(usd), vendor, 1e6, keccak256("over")));
        assertEq(usd.balanceOf(vendor), DAILY_CAP);
    }

    // ----------------------------------------------------------------
    // Scenario 9 — Blocked: revoked / expired
    // ----------------------------------------------------------------
    function test_09_Blocked_Revoked() public {
        _configureAgent();
        vm.expectEmit(true, false, false, false, address(vault));
        emit AgentRevoked(agent);
        vault.revokeAgent(agent);

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 4e6, "agent not active");
        assertFalse(_spend(address(usd), vendor, 4e6, keccak256("a9")));
        assertFalse(vault.getPolicy(agent).active);
    }

    function test_09b_Blocked_Expired() public {
        _configureAgent();
        vm.warp(uint256(expiry) + 1);
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 4e6, "policy expired");
        assertFalse(_spend(address(usd), vendor, 4e6, keccak256("a9b")));
    }

    // ----------------------------------------------------------------
    // Scenario 10 — Blocked: replay (dedup)
    // ----------------------------------------------------------------
    function test_10_Blocked_DuplicateAction() public {
        _configureAgent();
        bytes32 id = keccak256("a10");
        assertTrue(_spend(address(usd), vendor, 4e6, id));

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 4e6, "duplicate action");
        assertFalse(_spend(address(usd), vendor, 4e6, id));

        assertEq(usd.balanceOf(vendor), 4e6, "replay must not move funds a second time");
    }

    // ----------------------------------------------------------------
    // Reentrancy-attempt — nonReentrant guard must fire on nested call
    // ----------------------------------------------------------------
    function test_Reentrancy_GuardBlocksNestedCall() public {
        ReentrantToken re = new ReentrantToken(IExecuteSpend(address(vault)));
        re.mint(address(vault), 100e18);
        vault.setAgentPolicy(agent, uint128(50e18), uint128(50e18), expiry, true);
        vault.setAllowedTarget(agent, vendor, true);
        vault.setAllowedToken(agent, address(re), true);

        bool ok = _spend(address(re), vendor, 10e18, keccak256("outer"));

        assertTrue(ok, "legitimate outer spend completes");
        assertTrue(re.reentryAttempted(), "attacker attempted re-entry");
        assertTrue(re.reentryReverted(), "nested executeSpend reverted via nonReentrant guard");
        assertEq(re.balanceOf(vendor), 10e18, "vendor paid exactly once");
        assertFalse(vault.usedAction(keccak256("reentry-attempt")), "nested actionId never consumed");
    }

    // ----------------------------------------------------------------
    // Native BOT path — success + safety revert on failed transfer
    // ----------------------------------------------------------------
    function test_Native_ApprovedSpend() public {
        address nativeVendor = makeAddr("nativeVendor");
        vm.deal(address(vault), 10 ether);
        vault.setAgentPolicy(agent, uint128(2 ether), uint128(5 ether), expiry, true);
        vault.setAllowedTarget(agent, nativeVendor, true);
        vault.setAllowedToken(agent, address(0), true);

        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionApproved(agent, nativeVendor, address(0), 1 ether, keccak256("nat"));
        assertTrue(_spend(address(0), nativeVendor, 1 ether, keccak256("nat")));

        assertEq(nativeVendor.balance, 1 ether);
        assertEq(address(vault).balance, 9 ether);
    }

    function test_Native_RevertsOnFailedTransfer() public {
        RejectNative rej = new RejectNative();
        vm.deal(address(vault), 10 ether);
        vault.setAgentPolicy(agent, uint128(2 ether), uint128(5 ether), expiry, true);
        vault.setAllowedTarget(agent, address(rej), true);
        vault.setAllowedToken(agent, address(0), true);

        bytes32 id = keccak256("natfail");
        vm.prank(agent);
        vm.expectRevert(BOTSpendVault.NativeTransferFailed.selector);
        vault.executeSpend(address(0), address(rej), 1 ether, "", id);

        assertFalse(vault.usedAction(id), "reverted native spend rolls back actionId");
        assertEq(address(vault).balance, 10 ether);
    }

    // ----------------------------------------------------------------
    // Owner guard — onlyOwner reverts NotOwner for non-owner
    // ----------------------------------------------------------------
    function test_OwnerGuard_NonOwnerReverts() public {
        vm.startPrank(stranger);
        vm.expectRevert(BOTSpendVault.NotOwner.selector);
        vault.setAgentPolicy(agent, MAX_PER_TX, DAILY_CAP, expiry, true);

        vm.expectRevert(BOTSpendVault.NotOwner.selector);
        vault.setAllowedTarget(agent, vendor, true);

        vm.expectRevert(BOTSpendVault.NotOwner.selector);
        vault.setAllowedToken(agent, address(usd), true);

        vm.expectRevert(BOTSpendVault.NotOwner.selector);
        vault.revokeAgent(agent);
        vm.stopPrank();
    }

    // ----------------------------------------------------------------
    // Daily rolling-window reset
    // ----------------------------------------------------------------
    function test_DailyReset_AfterWindow() public {
        _configureAgent();
        assertTrue(_spend(address(usd), vendor, 5e6, keccak256("d1")));
        assertEq(vault.getPolicy(agent).spentToday, 5e6);

        vm.warp(block.timestamp + 1 days + 1);
        assertEq(vault.remainingDailyCap(agent), DAILY_CAP, "view reflects pending reset");

        assertTrue(_spend(address(usd), vendor, 5e6, keccak256("d2")));
        assertEq(vault.getPolicy(agent).spentToday, 5e6, "window reset, counter restarts");
    }

    // ----------------------------------------------------------------
    // Unregistered agent is inactive by default
    // ----------------------------------------------------------------
    function test_UnregisteredAgent_Blocked() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentActionBlocked(agent, vendor, address(usd), 1e6, "agent not active");
        assertFalse(_spend(address(usd), vendor, 1e6, keccak256("unreg")));
    }
}
