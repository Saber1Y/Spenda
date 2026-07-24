// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {VerifyingPaymaster} from "@account-abstraction/contracts/samples/VerifyingPaymaster.sol";
import {BOTSpendPaymaster} from "../src/BOTSpendPaymaster.sol";

/// @notice Differential test: BOTSpendPaymaster.getHash must be byte-identical to the eth-infinitism
///         VerifyingPaymaster.getHash @ v0.7.0. getHash includes `address(this)`, so we deploy mine,
///         compute my hash, then `vm.etch` the reference's runtime code onto the SAME address and
///         recompute — isolating pure logic from the address field. Equality proves the reproduction.
contract GetHashDifferentialTest is Test {
    EntryPoint ep;
    BOTSpendPaymaster mine;
    VerifyingPaymaster refPaymaster;

    address constant SIGNER = address(0x5161);
    address constant VAULT = address(0xFEED);

    struct FuzzInput {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint128 vgl;
        uint128 cgl;
        uint128 pmVgl;
        uint128 pmPgl;
        uint256 pvg;
        uint128 maxPrio;
        uint128 maxFee;
        uint48 validUntil;
        uint48 validAfter;
    }

    function setUp() public {
        ep = new EntryPoint();
        mine = new BOTSpendPaymaster(IEntryPoint(address(ep)), SIGNER, VAULT);
        refPaymaster = new VerifyingPaymaster(IEntryPoint(address(ep)), SIGNER);
    }

    function testFuzz_GetHash_MatchesReference(FuzzInput calldata f) public {
        PackedUserOperation memory op;
        op.sender = f.sender;
        op.nonce = f.nonce;
        op.initCode = f.initCode;
        op.callData = f.callData;
        op.accountGasLimits = bytes32((uint256(f.vgl) << 128) | uint256(f.cgl));
        op.preVerificationGas = f.pvg;
        op.gasFees = bytes32((uint256(f.maxPrio) << 128) | uint256(f.maxFee));
        op.paymasterAndData = abi.encodePacked(address(mine), f.pmVgl, f.pmPgl, abi.encode(f.validUntil, f.validAfter));

        bytes32 mineHash = mine.getHash(op, f.validUntil, f.validAfter);

        // run the reference logic AT mine's address (same address(this)) to isolate pure logic
        vm.etch(address(mine), address(refPaymaster).code);
        bytes32 refHash = VerifyingPaymaster(address(mine)).getHash(op, f.validUntil, f.validAfter);

        assertEq(mineHash, refHash, "getHash diverged from VerifyingPaymaster v0.7.0");
    }
}
