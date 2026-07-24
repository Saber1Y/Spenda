import {readFileSync} from "node:fs";
import {getAddress} from "viem";
import type {SignerConfig} from "./signer.js";

/// Load the v1 signer config from JSON. chainId is a string in JSON (JSON has no bigint);
/// addresses are checksum-normalized so registration compares agree with on-chain.
export function loadSignerConfig(path: string): SignerConfig {
  const j = JSON.parse(readFileSync(path, "utf8")) as {
    chainId: string;
    paymaster: string;
    vault: string;
    registeredSenders: string[];
    checkInnerSelector?: boolean;
  };
  return {
    chainId: BigInt(j.chainId),
    paymaster: getAddress(j.paymaster),
    vault: getAddress(j.vault),
    registeredSenders: j.registeredSenders.map(getAddress),
    checkInnerSelector: Boolean(j.checkInnerSelector),
  };
}
