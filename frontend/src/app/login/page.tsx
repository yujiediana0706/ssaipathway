"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signIn, signUp, resendConfirmation, signOut } = useAuth();

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(""); // 注册后进入"去邮箱验证"页
  const [resendHint, setResendHint] = useState("");

  const next = searchParams.get("next") || "";
  const justVerified = searchParams.get("verified") === "1";
  const modeParam = searchParams.get("mode");

  // 根据 URL param 自动切换 Tab
  useEffect(() => {
    if (modeParam === "signup") setMode("signup");
    else if (modeParam === "signin") setMode("signin");
  }, [modeParam]);

  // 已登录但有 next 参数（如邮箱验证后回来、protected 页面被拦下来的）→ 直接跳
  // 否则停留在 login 页给用户看到登录/注册界面
  useEffect(() => {
    if (loading) return;
    if (user && next && !sentTo) {
      router.replace(next);
    }
  }, [user, loading, next, sentTo, router]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    setError("");
    setResendHint("");

    if (mode === "signup") {
      if (!name.trim()) return setError("请输入你的名字或昵称");
      if (!emailValid) return setError("请输入有效的邮箱地址");
      if (password.length < 6) return setError("密码至少 6 位");
      if (password !== confirm) return setError("两次输入的密码不一致");
    } else {
      if (!emailValid) return setError("请输入有效的邮箱地址");
      if (!password) return setError("请输入密码");
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation, error: err } = await signUp(name, email, password);
        if (err) {
          setError(friendlyAuthError(err));
        } else if (needsConfirmation) {
          setSentTo(email.trim());
        }
        // 若无需验证（session 直接返回），useEffect 会自动跳转
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(friendlyAuthError(err));
        } else {
          // 登录成功 → 手动跳转
          setTimeout(() => {
            if (next) {
              router.replace(next);
              return;
            }
            // 判断是否有完整数据 → coach 或 onboarding
            const storedRaw = localStorage.getItem("pathway:user");
            const storedHasData = storedRaw
              ? (() => {
                  try { return !!JSON.parse(storedRaw)?.currentRole; } catch { return false; }
                })()
              : false;
            if (profile?.current_role || storedHasData) {
              router.replace("/coach");
            } else {
              router.replace("/onboarding");
            }
          }, 300); // 等 loadProfile 跑完
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResendHint("");
    const { error: err } = await resendConfirmation(sentTo || email);
    setResendHint(err ? `重发失败：${friendlyAuthError(err)}` : "验证邮件已重新发送，请查收（含垃圾邮件）");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // —— 注册后：去邮箱验证 ——
  if (sentTo) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fafaf9]">
        <Header />
        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md text-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
              📧
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">
              还差最后一步
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              我们已向 <span className="font-medium text-foreground">{sentTo}</span> 发送了一封验证邮件。
              <br />
              请打开邮件，点击里面的验证链接完成注册。
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-white p-5 text-left text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">没收到邮件？</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>检查一下垃圾邮件 / 推广邮件文件夹</li>
                <li>确认邮箱地址没有拼写错误</li>
                <li>稍等 1-2 分钟，或点击下方按钮重发</li>
              </ul>
            </div>
            <button
              onClick={handleResend}
              className="mt-5 w-full rounded-xl border border-brand bg-white py-3 text-sm font-medium text-brand transition-colors hover:bg-brand-light"
            >
              重新发送验证邮件
            </button>
            {resendHint && <p className="mt-3 text-xs text-muted-foreground">{resendHint}</p>}
            <button
              onClick={() => {
                setSentTo("");
                setMode("signin");
              }}
              className="mt-4 text-sm text-muted-foreground hover:text-brand"
            >
              已验证？返回登录 →
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf9]">
      <Header />

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          {/* 已登录但想切换账号的提示 */}
          {user && !loading && (
            <div className="mb-6 rounded-2xl border border-brand-light bg-brand-light/40 px-4 py-3">
              <p className="text-sm text-brand">
                你已登录为 <b>{displayName || user.email}</b>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => router.replace("/coach")}
                  className="flex-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
                >
                  去工作台
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    router.refresh();
                  }}
                  className="flex-1 rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-white"
                >
                  切换账号
                </button>
              </div>
            </div>
          )}

          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
              🔑
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">
              {mode === "signin" ? "欢迎回来" : "创建你的 Pathway 账号"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "用邮箱登录，继续你的转型之旅"
                : "用邮箱注册，你的档案与数据都会安全保存在账号里"}
            </p>
          </div>

          {justVerified && mode === "signin" && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ 邮箱验证成功，请用刚注册的邮箱和密码登录。
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-white text-brand shadow-sm" : "text-muted-foreground hover:text-brand"
                }`}
              >
                {m === "signin" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
            {mode === "signup" && (
              <Field label="你的名字 / 昵称">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="小北会怎么称呼你？"
                  autoFocus
                  className="input-primary"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  这个名字会同步到你的转型旅程中，全程保持一致。
                </p>
              </Field>
            )}

            <Field label="邮箱">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="you@example.com"
                autoComplete="email"
                className="input-primary"
              />
            </Field>

            <Field label="密码">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode === "signup" ? "至少 6 位" : "请输入密码"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="input-primary"
              />
            </Field>

            {mode === "signup" && (
              <Field label="确认密码">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="再输入一次密码"
                  autoComplete="new-password"
                  className="input-primary"
                />
              </Field>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "请稍候…"
                : mode === "signin"
                ? "登录"
                : "注册并发送验证邮件"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            仅支持邮箱注册登录 · 注册需点击邮件链接验证邮箱
          </p>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[#fafaf9]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
            <path d="M4 20 L12 4 L20 20" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 14 H16" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-tight text-brand">Pathway</span>
      </Link>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function friendlyAuthError(msg: string): string {
  if (/already registered|user already|already exists/i.test(msg))
    return "这个邮箱已经注册过了，请直接登录";
  if (/invalid login credentials/i.test(msg)) return "邮箱或密码不正确";
  if (/email not confirmed/i.test(msg)) return "邮箱还未验证，请先去邮箱点击验证链接";
  return msg;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">加载中…</div>}>
      <LoginInner />
    </Suspense>
  );
}
