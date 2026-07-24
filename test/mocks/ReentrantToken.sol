// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IExecuteSpend {
    function executeSpend(address token, address target, uint256 amount, bytes calldata data, bytes32 actionId)
        external
        returns (bool);
}

/// @notice Malicious ERC20 whose `transfer` attempts to re-enter the vault's `executeSpend`.
///         Used to prove the vault's `nonReentrant` guard fires. It records whether the nested
///         call reverted (it should) and then completes the legitimate outer transfer.
contract ReentrantToken is IERC20 {
    string public name = "Reentrant";
    string public symbol = "RE";
    uint8 public constant decimals = 18;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    IExecuteSpend public immutable vault;
    bool public reentryAttempted;
    bool public reentryReverted;

    constructor(IExecuteSpend vault_) {
        vault = vault_;
    }

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
        totalSupply += amt;
    }

    function transfer(address to, uint256 amt) external override returns (bool) {
        if (!reentryAttempted) {
            reentryAttempted = true;
            try vault.executeSpend(address(this), to, amt, "", keccak256("reentry-attempt")) returns (
                bool
            ) {
            // reached only if the reentrancy guard did NOT fire
            }
            catch {
                reentryReverted = true;
            }
        }
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        emit Transfer(msg.sender, to, amt);
        return true;
    }

    function approve(address spender, uint256 amt) external override returns (bool) {
        allowance[msg.sender][spender] = amt;
        emit Approval(msg.sender, spender, amt);
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external override returns (bool) {
        allowance[from][msg.sender] -= amt;
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        emit Transfer(from, to, amt);
        return true;
    }
}
