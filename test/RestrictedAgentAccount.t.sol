// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {RestrictedAgentAccount} from "../src/RestrictedAgentAccount.sol";
import {RestrictedAgentAccountFactory} from "../src/RestrictedAgentAccountFactory.sol";
import {BOTSpendVault} from "../src/BOTSpendVault.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract RestrictedAgentAccountTest is Test {
    EntryPoint entryPoint;
    BOTSpendVault vault;
    RestrictedAgentAccountFactory factory;
    RestrictedAgentAccount account;
    MockUSD usd;

    uint256 ownerKey = 0xA11CE;
    address owner;
    address paymaster = makeAddr("paymaster");
    address vendor = makeAddr("vendor");

    function setUp() public {
        owner = vm.addr(ownerKey);
        entryPoint = new EntryPoint();
        vault = new BOTSpendVault(address(this));
        factory = new RestrictedAgentAccountFactory(entryPoint, address(vault), paymaster);
        account = factory.createAccount(owner, 0);
        usd = new MockUSD();
        usd.mint(address(vault), 100e6);
        vault.setAgentPolicy(address(account), 20e6, 50e6, 0, true);
        vault.setAllowedToken(address(account), address(usd), true);
        vault.setAllowedTarget(address(account), vendor, true);
    }

    function test_CounterfactualAddressMatchesDeployment() public view {
        assertEq(factory.getAddress(owner, 0), address(account));
    }

    function test_OwnerCannotExecuteDirectly() public {
        vm.prank(owner);
        vm.expectRevert(RestrictedAgentAccount.NotEntryPoint.selector);
        account.execute(address(vault), 0, "");
    }

    function test_EntryPointCannotCallArbitraryDestination() public {
        vm.prank(address(entryPoint));
        vm.expectRevert(RestrictedAgentAccount.InvalidDestination.selector);
        account.execute(address(usd), 0, abi.encodeCall(usd.transfer, (vendor, 1e6)));
    }

    function test_EntryPointCannotSendNativeValue() public {
        vm.prank(address(entryPoint));
        vm.expectRevert(RestrictedAgentAccount.NativeValueForbidden.selector);
        account.execute(address(vault), 1, abi.encodeCall(vault.remainingDailyCap, (address(account))));
    }

    function test_EntryPointCannotCallVaultOwnerMethod() public {
        vm.prank(address(entryPoint));
        vm.expectRevert(RestrictedAgentAccount.InvalidCallData.selector);
        account.execute(address(vault), 0, abi.encodeCall(vault.revokeAgent, (address(account))));
    }

    function test_EntryPointCanExecuteSpend() public {
        bytes memory callData = abi.encodeCall(vault.executeSpend, (address(usd), vendor, 4e6, "", keccak256("spend")));
        vm.prank(address(entryPoint));
        account.execute(address(vault), 0, callData);
        assertEq(usd.balanceOf(vendor), 4e6);
    }

    function test_ValidationRejectsWrongPaymasterEvenWhenAccountIsFunded() public {
        vm.deal(address(account), 1 ether);
        entryPoint.depositTo{value: 1 ether}(address(account));
        PackedUserOperation memory op;
        op.sender = address(account);
        op.paymasterAndData = abi.encodePacked(makeAddr("attackerPaymaster"));
        op.signature = _sign(bytes32(uint256(1)));
        vm.prank(address(entryPoint));
        assertEq(account.validateUserOp(op, bytes32(uint256(1)), 0), 1);
    }

    function test_ValidationAcceptsBoundPaymasterAndOwner() public {
        PackedUserOperation memory op;
        op.sender = address(account);
        op.paymasterAndData = abi.encodePacked(paymaster);
        bytes32 hash = keccak256("user-op");
        op.signature = _sign(hash);
        vm.prank(address(entryPoint));
        assertEq(account.validateUserOp(op, hash, 0), 0);
    }

    function test_MalformedSignatureReturnsValidationFailure() public {
        PackedUserOperation memory op;
        op.sender = address(account);
        op.paymasterAndData = abi.encodePacked(paymaster);
        op.signature = hex"1234";
        vm.prank(address(entryPoint));
        assertEq(account.validateUserOp(op, keccak256("malformed"), 0), 1);
    }

    function _sign(bytes32 hash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
