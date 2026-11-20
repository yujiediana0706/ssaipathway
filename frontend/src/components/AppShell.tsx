"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/routing";
import NavBar from "./NavBar";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/lib/auth";

/**
 * 全站统一外壳：顶部导航 + （登录后）左侧竖排导航。
 * 登录页/支付回调等独立页面不加侧栏。
 *
 * fixedShell：桌面端把外壳锁定为一屏高度，header/侧栏固定，
 * 仅主内容区滚动（用于 /coach 这类多栏独立滚动的工作台）。
 * 移动端不受影响，仍按整页滚动。
 */
export default function AppShell({
  children,
  sidebar = true,
  fixedShell = false,
}: {
  children: React.ReactNode;
  sidebar?: boolean;
  fixedShell?: boolean;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement | null>(null);

  // 路由切换后把内容区滚动位置重置到顶部
  useEffect(() => {
    if (!fixedShell) return;
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname, fixedShell]);

  return (
    <div
      className={`flex flex-col bg-background ${
        fixedShell ? "min-h-screen lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden" : "min-h-screen"
      }`}
    >
      <NavBar />
      <div
        className={`mx-auto flex w-full max-w-[1440px] flex-1 items-start ${
          fixedShell ? "lg:min-h-0 lg:overflow-hidden" : ""
        }`}
      >
        {sidebar && user && <AppSidebar fixed={fixedShell} />}
        <main
          ref={mainRef}
          className={`min-w-0 flex-1 ${
            fixedShell ? "lg:h-full lg:min-h-0 lg:overflow-y-auto" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
