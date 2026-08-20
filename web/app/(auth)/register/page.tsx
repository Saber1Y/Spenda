"use client";

import {useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {getBase44Client} from "@/lib/base44";
import {loginWithGoogle} from "@/lib/auth";
import {Logo} from "@/components/ui/Logo";
import {Button} from "@/components/ui/Button";
import {WalletAuthButton} from "@/components/WalletAuthButton";

type Step = "register" | "verify";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const client = getBase44Client();
      await client.auth.register({email, password});
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const client = getBase44Client();
      await client.auth.verifyOtp({email, otpCode: otp});
      await client.auth.loginViaEmailPassword(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    getBase44Client().auth.resendOtp(email);
  }

  function handleGoogle() {
    loginWithGoogle("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-white px-4">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo height={32} />
          <h1 className="font-heading text-heading-sm text-aubergine">
            {step === "register" ? "Create your account" : "Verify your email"}
          </h1>
          <p className="text-body-sm text-fog">
            {step === "register" ? "Set up your Spenda dashboard" : `We sent a code to ${email}`}
          </p>
        </div>

        {step === "register" ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="rounded-card border border-blush-mist bg-blush-mist/20 px-4 py-3 text-body-sm text-aubergine">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-body-sm font-medium text-aubergine">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-card border border-ash bg-bone px-4 py-3 text-body text-aubergine placeholder-fog outline-none transition focus:border-periwinkle"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-body-sm font-medium text-aubergine">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-card border border-ash bg-bone px-4 py-3 text-body text-aubergine placeholder-fog outline-none transition focus:border-periwinkle"
                placeholder="Choose a strong password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="rounded-card border border-blush-mist bg-blush-mist/20 px-4 py-3 text-body-sm text-aubergine">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="otp" className="text-body-sm font-medium text-aubergine">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-card border border-ash bg-bone px-4 py-3 text-body text-aubergine placeholder-fog outline-none transition focus:border-periwinkle"
                placeholder="000000"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify & sign in"}
            </Button>

            <button type="button" onClick={handleResend} className="w-full text-center text-body-sm text-fog transition hover:text-aubergine">
              Resend code
            </button>
          </form>
        )}

        {step === "register" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ash" />
              </div>
              <div className="relative flex justify-center text-caption">
                <span className="bg-paper-white px-3 text-fog">or</span>
              </div>
            </div>

            <Button variant="secondary" className="w-full" onClick={handleGoogle}>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
            <div className="flex justify-center"><WalletAuthButton /></div>
          </>
        )}

        <p className="text-center text-body-sm text-fog">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-periwinkle transition hover:text-aubergine">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
