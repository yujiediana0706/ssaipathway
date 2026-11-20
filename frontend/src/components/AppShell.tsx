"use client";

import NavBar from "./NavBar";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/lib/auth";

/**
 * 全站统一外壳：顶部导航 + （登录后）左侧竖排导航。
 * 登录页/支付回调等独立页面不加侧栏。
 */
export default function AppShell({
  children,
  sidebar = true,
}: {
  children: React.ReactNode;
  sidebar?: boolean;
}) {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-start">
        {sidebar && user && <AppSidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
