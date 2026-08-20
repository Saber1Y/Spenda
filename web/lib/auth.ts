"use client";

import {getBase44Client} from "@/lib/base44";

const CALLBACK_PATH = "/api/apps/auth/final-callback";

export function authCallbackUrl(nextPath = "/dashboard"): string {
  if (typeof window === "undefined") return CALLBACK_PATH;
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const url = new URL(CALLBACK_PATH, window.location.origin);
  url.searchParams.set("next", safeNext);
  return url.toString();
}

export function loginWithGoogle(nextPath = "/dashboard"): void {
  getBase44Client().auth.loginWithProvider("google", authCallbackUrl(nextPath));
}
