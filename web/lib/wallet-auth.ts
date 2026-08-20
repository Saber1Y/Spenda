"use client";

import type {Address, Hex} from "viem";

export interface WalletSession {
  address: Address;
  chainId: number;
  expiresAt: number;
}

export async function walletChallenge(address: Address): Promise<{message: string; nonce: string}> {
  const response = await fetch("/api/auth/wallet/challenge", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({address}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not create wallet challenge");
  return data;
}

export async function walletLogin(address: Address, signature: Hex): Promise<WalletSession> {
  const response = await fetch("/api/auth/wallet/verify", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({address, signature}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Wallet authentication failed");
  return data.session;
}

export async function walletLogout(): Promise<void> {
  await fetch("/api/auth/wallet/logout", {method: "POST"});
}
