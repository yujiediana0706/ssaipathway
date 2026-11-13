"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { applyActionCode, getAuth } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

type Status = "loading" | "success" | "expired" | "error";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("正在验证你的邮箱...");

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!oobCode) {
        if (!active) return;
        setStatus("error");
        setMessage("缺少验证链接参数。请重新点击邮件里的链接。");
        return;
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        if (!active) return;
        setStatus("error");
        setMessage("服务配置错误，请联系支持。");
        return;
      }

      try {
        // Firebase Client SDK 的 applyActionCode 会确认 oobCode 并标记用户为已验证
        await applyActionCode(auth, oobCode);
        if (!active) return;
        setStatus("success");
        setMessage("邮箱验证成功！");

        // 2 秒后跳转回登录页
        setTimeout(() => {
          router.replace("/login?verified=1");
        }, 2000);
      } catch (err: unknown) {
        if (!active) return;
        const code = (err as { code?: string } | null)?.code || "";
        const msg = (err as Error | null)?.message || "";

        if (
          code.includes("expired") ||
          code.includes("invalid") ||
          msg.includes("expired") ||
          msg.includes("invalid")
        ) {
          setStatus("expired");
          setMessage("验证链接已过期或无效。请回到登录页重新发送验证邮件。");
        } else {
          setStatus("error");
          setMessage(`验证失败：${msg || code}`);
        }
      }
    }

    verify();
    return () => {
      active = false;
    };
  }, [oobCode, router]);

  const bgColor =
    status === "success"
      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
      : status === "loading"
      ? "bg-gradient-to-br from-indigo-500 to-violet-600"
      : "bg-gradient-to-br from-rose-500 to-pink-600";

  const icon = status === "success" ? "✅" : status === "loading" ? "⏳" : "❌";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`${bgColor} px-6 py-10 text-center text-white`}>
          <div className="mb-3 text-5xl">{icon}</div>
          <h1 className="text-xl font-semibold">{status === "loading" ? "邮箱验证" : message}</h1>
        </div>
        <div className="px-6 py-8 text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
              </div>
              <p className="text-sm text-slate-500">请稍候，正在验证...</p>
            </>
          )}

          {status === "success" && (
            <>
              <p className="mb-4 text-sm text-slate-500">
                你的邮箱已成功验证。正在返回登录页...
              </p>
              <button
                onClick={() => router.replace("/login?verified=1")}
                className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-600"
              >
                立即返回
              </button>
            </>
          )}

          {(status === "expired" || status === "error") && (
            <>
              <p className="mb-4 text-sm text-slate-500">{message}</p>
              <button
                onClick={() => router.replace("/login")}
                className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-600"
              >
                去登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">加载中...</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
