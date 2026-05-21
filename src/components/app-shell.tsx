"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPage = pathname.startsWith("/accept/");

  if (publicPage) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
