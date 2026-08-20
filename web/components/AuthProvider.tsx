"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import {getBase44Client} from "@/lib/base44";
import type {Base44Client, User} from "@base44/sdk";
import {useAccount, useSignMessage} from "wagmi";
import {walletChallenge, walletLogin, walletLogout, type WalletSession} from "@/lib/wallet-auth";

interface AuthState {
  user: User | null;
  loading: boolean;
  client: Base44Client;
  refresh: () => Promise<void>;
  walletSession: WalletSession | null;
  walletLoading: boolean;
  signInWithWallet: () => Promise<void>;
  signOutWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const client = getBase44Client();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const {address} = useAccount();
  const {signMessageAsync} = useSignMessage();

  const refresh = async () => {
    try {
      const me = await client.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    fetch("/api/auth/wallet/me").then((response) => response.json()).then((data) => setWalletSession(data.authenticated ? data.session : null)).catch(() => setWalletSession(null));
  }, []);

  const signInWithWallet = async () => {
    if (!address) throw new Error("Connect a wallet first.");
    setWalletLoading(true);
    try {
      const challenge = await walletChallenge(address);
      const signature = await signMessageAsync({message: challenge.message});
      setWalletSession(await walletLogin(address, signature));
    } finally { setWalletLoading(false); }
  };

  const signOutWallet = async () => {
    await walletLogout();
    setWalletSession(null);
  };

  return <AuthContext.Provider value={{user, loading, client, refresh, walletSession, walletLoading, signInWithWallet, signOutWallet}}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
