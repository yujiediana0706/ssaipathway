"use client";

import { useEffect } from "react";
import { track } from "@/lib/analyticsClient";

/** 轻量埋点组件：服务端页面也能用（渲染后异步上报） */
export default function Tracker({
  event,
  props,
}: {
  event: string;
  props?: Record<string, string | number | boolean | undefined>;
}) {
  const key = JSON.stringify(props || {});
  useEffect(() => {
    track(event, props || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);
  return null;
}
