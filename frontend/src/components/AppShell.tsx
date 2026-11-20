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

  // 关闭浏览器的滚动位置恢复，避免刷新后停在半屏
  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  // 进入页面/路由切换后，内容区与文档都回到顶部（只有用户操作才会滚动）
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      className={`flex flex-col bg-background ${
        fixedShell ? "min-h-screen lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden" : "min-h-screen"
      }`}
    >
      <NavBar />
      <div
        className={`mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-stretch lg:flex-row lg:items-start ${
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
