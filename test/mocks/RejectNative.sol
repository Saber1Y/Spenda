// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Target that rejects native BOT, to exercise the vault's `NativeTransferFailed` safety revert.
contract RejectNative {
    receive() external payable {
        revert("RejectNative: no native");
    }
}
