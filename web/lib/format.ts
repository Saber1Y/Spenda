import {formatUnits, type Address} from "viem";
import {MUSD_DECIMALS} from "./contracts";

/** Mainnet USDT uses 6 decimals — base-unit math everywhere, format only at display. */
export function formatMusd(base: bigint, opts: {maxFractionDigits?: number} = {}): string {
  const s = formatUnits(base, MUSD_DECIMALS);
  const n = Number(s);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.maxFractionDigits ?? 2,
  });
}

/** Native BOT is 18 decimals. */
export function formatBot(wei: bigint, digits = 4): string {
  return Number(formatUnits(wei, 18)).toLocaleString("en-US", {maximumFractionDigits: digits});
}

export function truncateAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** unix seconds -> compact "3m ago" style, relative to now. */
export function timeAgo(unixSeconds: number, nowMs = Date.now()): string {
  const secs = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatExpiry(unixSeconds: bigint): {label: string; expired: boolean} {
  if (unixSeconds === 0n) return {label: "never", expired: false};
  const nowS = Math.floor(Date.now() / 1000);
  const expired = Number(unixSeconds) <= nowS;
  const d = new Date(Number(unixSeconds) * 1000);
  return {label: d.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"}), expired};
}

export const isSameAddress = (a?: string, b?: string): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export type {Address};
