import {describe, expect, test} from "vitest";
import {getAddress, pad, size, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {sponsor, SKEW_SECONDS, TTL_SECONDS, type SignerConfig} from "../src/signer.js";
import {mkOp, executeSpendCallData, executeToDest, dirtyUpperDestCallData, REGISTERED_SENDER} from "./opFixtures.js";

const VAULT: Address = getAddress(pad("0xfeed", {size: 20}));
const PAYMASTER: Address = getAddress(pad("0xface", {size: 20}));
const TOKEN: Address = getAddress(pad("0x0dad", {size: 20}));
const VENDOR: Address = getAddress(pad("0x0b0b", {size: 20}));
const ACTION: Hex = "0x0000000000000000000000000000000000000000000000000000000000000001";

// throwaway signer (test only)
const signer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

const CFG: SignerConfig = {
  chainId: 968n,
  paymaster: PAYMASTER,
  vault: VAULT,
  registeredSenders: [REGISTERED_SENDER],
};

const NOW = 1_800_000_000;

describe("B5b — stateless signer decision flow (pure, no chain)", () => {
  test("ALLOWED: registered sender + execute + dest==vault -> sponsored with correct window", async () => {
    const op = mkOp({callData: executeSpendCallData(VAULT, TOKEN, VENDOR, 4_000_000n, ACTION)});
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r.sponsored).toBe(true);
    if (!r.sponsored) return;
    expect(r.validAfter).toBe(NOW - SKEW_SECONDS);
    expect(r.validUntil).toBe(NOW + TTL_SECONDS);
    expect(r.skewSeconds).toBe(SKEW_SECONDS);
    expect(r.ttlSeconds).toBe(TTL_SECONDS);
    // paymasterAndData = 20 + 16 + 16 + 64 + 65 = 181 bytes
    expect(size(r.paymasterAndData)).toBe(181);
  });

  test("REFUSED: unregistered sender", async () => {
    const op = mkOp({
      sender: getAddress(pad("0xdeadbeef", {size: 20})),
      callData: executeSpendCallData(VAULT, TOKEN, VENDOR, 1n, ACTION),
    });
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "sender not registered"});
  });

  test("REFUSED: wrong outer selector", async () => {
    // valid length but not execute()
    const op = mkOp({callData: `0x12345678${"00".repeat(32)}` as Hex});
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "selector not execute"});
  });

  test("REFUSED: well-formed execute to a non-vault dest", async () => {
    const op = mkOp({callData: executeToDest(getAddress(pad("0xc0de", {size: 20})))});
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "dest not vault"});
  });

  test("REFUSED: malformed/truncated callData (< 36 bytes) — clean, no throw", async () => {
    const op = mkOp({callData: "0xb61d27f6"}); // selector only, 4 bytes
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "callData too short"});
  });

  test("REFUSED: gas field out of uint128 range — clean, no throw", async () => {
    const op = mkOp({
      callData: executeSpendCallData(VAULT, TOKEN, VENDOR, 1n, ACTION),
      paymasterVerificationGasLimit: 1n << 128n,
    });
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "malformed input: gas field out of uint128 range"});
  });

  test("dest gate mirrors on-chain low-20-byte mask (dirty upper bytes still match vault)", async () => {
    const op = mkOp({callData: dirtyUpperDestCallData(VAULT)});
    const r = await sponsor(op, CFG, signer, NOW);
    expect(r.sponsored).toBe(true);
  });

  test("inner-selector check (enabled): non-executeSpend inner refused", async () => {
    const cfg: SignerConfig = {...CFG, checkInnerSelector: true};
    // execute(vault, 0, <not executeSpend>) — executeToDest uses empty func -> inner selector absent
    const op = mkOp({callData: executeToDest(VAULT)});
    const r = await sponsor(op, cfg, signer, NOW);
    expect(r).toEqual({sponsored: false, reason: "malformed input: inner callData"});
  });

  test("inner-selector check (enabled): executeSpend inner sponsored", async () => {
    const cfg: SignerConfig = {...CFG, checkInnerSelector: true};
    const op = mkOp({callData: executeSpendCallData(VAULT, TOKEN, VENDOR, 1n, ACTION)});
    const r = await sponsor(op, cfg, signer, NOW);
    expect(r.sponsored).toBe(true);
  });
});
