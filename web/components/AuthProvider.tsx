"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import {getBase44Client} from "@/lib/base44";
import type {Base44Client, User} from "@base44/sdk";

interface AuthState {
  user: User | null;
  loading: boolean;
  client: Base44Client;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const client = getBase44Client();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return <AuthContext.Provider value={{user, loading, client, refresh}}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
