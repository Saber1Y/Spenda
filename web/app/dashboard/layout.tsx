"use client";

import {useAuth} from "@/components/AuthProvider";
import {Sidebar} from "@/components/dashboard/Sidebar";

export default function DashboardLayout({children}: {children: React.ReactNode}) {
  const {user} = useAuth();

  return (
    <div className="flex min-h-screen bg-paper-white">
      <Sidebar user={user} />
      <main className="flex-1 ml-[240px] pb-16">
        {children}
      </main>
    </div>
  );
}
