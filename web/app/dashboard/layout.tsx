"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/AuthProvider";

export default function DashboardLayout({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-white">
        <p className="text-body-sm text-fog">Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
