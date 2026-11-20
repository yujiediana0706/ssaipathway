"use client";

import { ANON_ID_KEY } from "./analytics";

/** 首次访问生成的匿名标识，登录后服务端会与 userId 关联 */
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `a_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

type Props = Record<string, string | number | boolean | undefined | null>;

/**
 * 异步上报，失败静默，绝不阻塞页面或对话流。
 * 使用 sendBeacon 确保跳转前也能送达。
 */
export function track(event: string, props: Props = {}, extra: Props = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event,
      props: { ...props, ...extra },
      anon_id: getAnonId(),
      path: window.location.pathname,
      ts: Date.now(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* 静默失败 */
  }
}
