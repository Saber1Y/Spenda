"use client";

import {Sidebar} from "@/components/dashboard/Sidebar";

export default function DashboardLayout({children}: {children: React.ReactNode}) {
  return (
    <div className="flex min-h-screen bg-paper-white">
      <Sidebar />
      <main className="flex-1 ml-[240px] pb-16">
        {children}
      </main>
    </div>
  );
}
