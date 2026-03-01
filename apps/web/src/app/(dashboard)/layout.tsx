"use client";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { BrandingProvider } from "@/contexts/BrandingContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <BrandingProvider>
        <div className="flex min-h-screen bg-bg">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <Header />
            <main className="flex-1 p-6 pb-24 md:pb-6 overflow-auto">
              {children}
            </main>
          </div>
          <BottomNav />
        </div>
      </BrandingProvider>
    </AuthGuard>
  );
}
