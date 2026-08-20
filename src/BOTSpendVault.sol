// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BOTSpendVault
/// @notice Policy-enforcing spend vault for autonomous agents on BOT Chain.
///         The vault holds the funds; a registered agent holds nothing and can only call
///         `executeSpend`, which moves value strictly inside its policy (active/expiry,
///         token + target allowlists, per-tx cap, daily cap, actionId dedup).
/// @dev This is "Fence 2" (contract layer). Policy violations do NOT revert — they emit
///      `AgentActionBlocked` and return `approved=false`, so every blocked decision is an
///      on-chain artifact. Reverts are reserved for genuine safety (owner guard, reentrancy,
///      failed value transfer). State is updated before external interaction (checks-effects-
///      interactions) and `executeSpend` is `nonReentrant`.
contract BOTSpendVault {
    using SafeERC20 for IERC20;

    /// @notice Sentinel token address for the native BOT spend path.
    address public constant NATIVE = address(0);

    /// @dev Rolling window for the daily cap.
    uint256 private constant DAY = 1 days;

    struct Policy {
        uint128 maxPerTx;
        uint128 dailyCap;
        uint128 spentToday;
        uint64 lastResetTime;
        uint64 expiry; // 0 = never expires
        bool active;
    }

    address public immutable owner;
    bool internal _locked;

    mapping(address agent => Policy) public policies;
    mapping(address agent => mapping(address target => bool)) public allowedTarget;
    mapping(address agent => mapping(address token => bool)) public allowedToken;
    mapping(bytes32 actionId => bool used) public usedAction;

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
    /// @notice Correlates every blocked decision with the submitted intent/action.
    event AgentActionDecision(
        address indexed agent,
        address indexed target,
        address indexed token,
        uint256 amount,
        bytes32 actionId,
        bool approved,
        string reason
    );
    event ReceiptIssued(
        address indexed agent,
        address indexed target,
        address token,
        uint256 amount,
        bytes32 actionId,
        uint256 timestamp
    );

    error NotOwner();
    error Reentrancy();
    /// @dev Native BOT transfer failed — safety revert to undo effects (transfer atomicity).
    error NativeTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    /// @notice Owner funds the vault with native BOT by sending value here.
    receive() external payable {
        emit VaultFunded(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    /// @notice Create or update an agent's spend policy. First call for an agent emits
    ///         `PolicyCreated` and initializes the daily window; later calls emit `PolicyUpdated`
    ///         and preserve `spentToday` / `lastResetTime`.
    function setAgentPolicy(address agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active)
        external
        onlyOwner
    {
        Policy storage p = policies[agent];
        bool creating = p.lastResetTime == 0;

        p.maxPerTx = maxPerTx;
        p.dailyCap = dailyCap;
        p.expiry = expiry;
        p.active = active;

        if (creating) {
            p.lastResetTime = uint64(block.timestamp);
            emit PolicyCreated(agent, maxPerTx, dailyCap, expiry, active);
        } else {
            emit PolicyUpdated(agent, maxPerTx, dailyCap, expiry, active);
        }
    }

    function setAllowedTarget(address agent, address target, bool allowed) external onlyOwner {
        allowedTarget[agent][target] = allowed;
        emit TargetAllowlisted(agent, target, allowed);
    }

    function setAllowedToken(address agent, address token, bool allowed) external onlyOwner {
        allowedToken[agent][token] = allowed;
        emit TokenAllowlisted(agent, token, allowed);
    }

    /// @notice Hard off-switch: deactivate an agent's policy.
    function revokeAgent(address agent) external onlyOwner {
        policies[agent].active = false;
        emit AgentRevoked(agent);
    }

    // ---------------------------------------------------------------------
    // Agent action
    // ---------------------------------------------------------------------

    /// @notice Agent requests a spend. Returns `approved`; a blocked action emits
    ///         `AgentActionBlocked` and returns false without moving value or consuming state.
    /// @param token  ERC20 token to spend, or `NATIVE` (address(0)) for native BOT.
    /// @param target Recipient (must be allowlisted).
    /// @param amount Amount to move.
    /// @param data   Calldata forwarded only on the native path (`target.call{value: amount}(data)`);
    ///               ignored on the ERC20 path (a plain `transfer`).
    /// @param actionId Idempotency key; a used id is rejected as a duplicate.
    function executeSpend(address token, address target, uint256 amount, bytes calldata data, bytes32 actionId)
        external
        nonReentrant
        returns (bool approved)
    {
        Policy storage p = policies[msg.sender];

        // ---- checks (no revert; emit + return false) ----
        if (!p.active) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "agent not active");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "agent not active");
            return false;
        }
        if (p.expiry != 0 && block.timestamp > p.expiry) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "policy expired");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "policy expired");
            return false;
        }
        if (!allowedToken[msg.sender][token]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "token not allowlisted");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "token not allowlisted");
            return false;
        }
        if (!allowedTarget[msg.sender][target]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "target not allowlisted");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "target not allowlisted");
            return false;
        }
        if (amount > p.maxPerTx) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "exceeds maxPerTx");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "exceeds maxPerTx");
            return false;
        }

        uint256 spent = p.spentToday;
        uint64 resetTime = p.lastResetTime;
        if (block.timestamp >= uint256(resetTime) + DAY) {
            spent = 0;
            resetTime = uint64(block.timestamp);
        }
        if (spent + amount > p.dailyCap) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "exceeds dailyCap");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "exceeds dailyCap");
            return false;
        }
        if (usedAction[actionId]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "duplicate action");
            emit AgentActionDecision(msg.sender, target, token, amount, actionId, false, "duplicate action");
            return false;
        }

        // ---- effects ----
        usedAction[actionId] = true;
        // safe: `spent + amount <= dailyCap` was just checked, and dailyCap is uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        p.spentToday = uint128(spent + amount);
        p.lastResetTime = resetTime;

        // ---- interactions ----
        if (token == NATIVE) {
            (bool ok,) = target.call{value: amount}(data);
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(target, amount);
        }

        emit AgentActionApproved(msg.sender, target, token, amount, actionId);
        emit AgentActionDecision(msg.sender, target, token, amount, actionId, true, "approved");
        emit ReceiptIssued(msg.sender, target, token, amount, actionId, block.timestamp);
        return true;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPolicy(address agent) external view returns (Policy memory) {
        return policies[agent];
    }

    /// @notice Daily cap remaining right now, accounting for a pending rolling-window reset.
    function remainingDailyCap(address agent) external view returns (uint256) {
        Policy memory p = policies[agent];
        uint256 spent = p.spentToday;
        if (block.timestamp >= uint256(p.lastResetTime) + DAY) {
            spent = 0;
        }
        if (spent >= p.dailyCap) {
            return 0;
        }
        return p.dailyCap - spent;
    }

    function isAllowed(address agent, address target, address token) external view returns (bool) {
        return allowedTarget[agent][target] && allowedToken[agent][token];
    }
}
