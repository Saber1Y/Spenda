"use client";

import {useAccount, useConnect} from "wagmi";
import {useAuth} from "@/components/AuthProvider";
import {Button} from "@/components/ui/Button";

export function WalletAuthButton({compact = false}: {compact?: boolean}) {
  const {address} = useAccount();
  const {connect, connectors, isPending} = useConnect();
  const {walletSession, walletLoading, signInWithWallet, signOutWallet} = useAuth();
  if (walletSession) return <Button variant="secondary" size="sm" onClick={() => void signOutWallet()}>{compact ? "Wallet session" : "Sign out wallet"}</Button>;
  if (!address) return <Button variant="secondary" size="sm" onClick={() => connectors[0] && connect({connector: connectors[0]})} disabled={isPending}>{isPending ? "Connecting..." : "Connect wallet"}</Button>;
  return <Button variant="primary" size="sm" onClick={() => void signInWithWallet()} disabled={walletLoading}>{walletLoading ? "Signing in..." : "Sign in with wallet"}</Button>;
}
