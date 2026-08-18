"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredUser } from "@/lib/userStore";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请输入你的名字");
      return;
    }
    setError("");
    setLoading(true);

    setTimeout(() => {
      const stored = getStoredUser();
      if (stored && stored.name === trimmed) {
        router.push("/dashboard");
      } else if (stored) {
        setError(`本地档案中没有找到名为「${trimmed}」的用户，请确认名字是否正确`);
        setLoading(false);
      } else {
        setError("本地还没有你的转型档案，请先创建一个");
        setLoading(false);
      }
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf9]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[#fafaf9]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M4 20 L12 4 L20 20" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14 H16" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-brand">
            Pathway
          </span>
        </Link>
        <Link
          href="/onboarding"
          className="text-sm text-muted-foreground transition-colors hover:text-brand"
        >
          创建新档案 →
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
              🔑
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">
              欢迎回来
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              输入你的名字，继续你的转型之旅
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-foreground">
              你的名字
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入你创建档案时使用的名字"
              autoFocus
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-brand outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:bg-white"
            />

            {error && (
              <p className="mt-3 text-sm text-rose-600">{error}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !name.trim()}
              className="mt-5 w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "验证中…" : "登录"}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            还没有档案？
            <Link
              href="/onboarding"
              className="ml-1 font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
            >
              立即创建 →
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            本产品为 MVP 原型，暂未接入账号系统。<br />
            你的档案信息存储在本地浏览器中。
          </p>
        </div>
      </main>
    </div>
  );
}
