// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {SimpleAccount} from "@account-abstraction/contracts/samples/SimpleAccount.sol";
import {SimpleAccountFactory} from "@account-abstraction/contracts/samples/SimpleAccountFactory.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// @notice Phase B3 — the agent account layer. Proves the counterfactual address is stable and
///         equals the actual deployment (the getAddress/createAccount initCodeHash footgun),
///         that the SimpleAccount owner is the agent EOA, that `execute` is gated to
///         owner/EntryPoint, and that a freshly created account holds nothing (invariant 2).
///
/// Address model: the vault's registered agent = this SimpleAccount ADDRESS; the agent EOA
/// (`agentOwner`) is only the account owner that signs UserOps.
contract AgentAccountTest is Test {
    EntryPoint entryPoint;
    SimpleAccountFactory factory;

    uint256 constant AGENT_OWNER_PK = 0xA11CE;
    address agentOwner;
    uint256 constant SALT = 0;

    address recipient = makeAddr("recipient");
    address stranger = makeAddr("stranger");

    function setUp() public {
        agentOwner = vm.addr(AGENT_OWNER_PK);
        entryPoint = new EntryPoint();
        factory = new SimpleAccountFactory(entryPoint);
    }

    /// The footgun test: predicted address must equal the deployed one, stay stable, and
    /// createAccount must be idempotent (no redeploy, same address).
    function test_CounterfactualMatchesDeployed() public {
        address predicted = factory.getAddress(agentOwner, SALT);

        SimpleAccount acct = factory.createAccount(agentOwner, SALT);
        assertEq(address(acct), predicted, "getAddress must equal createAccount result");
        assertTrue(address(acct).code.length > 0, "account deployed");

        assertEq(factory.getAddress(agentOwner, SALT), predicted, "prediction stable after deploy");

        SimpleAccount acct2 = factory.createAccount(agentOwner, SALT);
        assertEq(address(acct2), predicted, "createAccount idempotent");
    }

    function test_DifferentSalt_DifferentAddress() public view {
        assertTrue(factory.getAddress(agentOwner, 0) != factory.getAddress(agentOwner, 1), "salt varies address");
    }

    function test_OwnerIsAgentEOA_And_EntryPointWired() public {
        SimpleAccount acct = factory.createAccount(agentOwner, SALT);
        assertEq(acct.owner(), agentOwner, "owner == agent signing EOA");
        assertEq(address(acct.entryPoint()), address(entryPoint), "entryPoint wired");
    }

    /// Invariant 2: a freshly created account holds zero native balance AND zero EntryPoint deposit.
    /// (Enforced operationally in v1; not on-chain-enforceable — see internal threat model.)
    function test_NoFundingInvariant() public {
        SimpleAccount acct = factory.createAccount(agentOwner, SALT);
        assertEq(address(acct).balance, 0, "zero native balance");
        assertEq(entryPoint.balanceOf(address(acct)), 0, "zero EntryPoint deposit");
    }

    function test_Execute_ByOwner_Works() public {
        SimpleAccount acct = _createFundedWithToken();
        MockUSD usd = MockUSD(_token());
        vm.prank(agentOwner);
        acct.execute(address(usd), 0, abi.encodeCall(usd.transfer, (recipient, 10e6)));
        assertEq(usd.balanceOf(recipient), 10e6);
    }

    function test_Execute_ByEntryPoint_Works() public {
        SimpleAccount acct = _createFundedWithToken();
        MockUSD usd = MockUSD(_token());
        vm.prank(address(entryPoint));
        acct.execute(address(usd), 0, abi.encodeCall(usd.transfer, (recipient, 5e6)));
        assertEq(usd.balanceOf(recipient), 5e6);
    }

    function test_Execute_ByStranger_Reverts() public {
        SimpleAccount acct = factory.createAccount(agentOwner, SALT);
        vm.prank(stranger);
        vm.expectRevert(bytes("account: not Owner or EntryPoint"));
        acct.execute(address(0xdead), 0, "");
    }

    // helpers -----------------------------------------------------------------
    MockUSD internal _usd;

    function _token() internal view returns (address) {
        return address(_usd);
    }

    function _createFundedWithToken() internal returns (SimpleAccount acct) {
        acct = factory.createAccount(agentOwner, SALT);
        _usd = new MockUSD();
        _usd.mint(address(acct), 100e6); // ERC20 balance only; native/deposit stay zero
    }
}
