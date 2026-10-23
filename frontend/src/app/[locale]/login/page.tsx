"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import SiteFooter from "@/components/SiteFooter";
import LocaleSwitcher from "@/components/LocaleSwitcher";

type Mode = "signin" | "signup";

function LoginInner() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signIn, signUp, resendConfirmation, resetPassword, signOut } = useAuth();

  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(""); // 注册后进入"去邮箱验证"页
  const [emailSent, setEmailSent] = useState(true);
  const [resendHint, setResendHint] = useState("");
  const [resetSent, setResetSent] = useState(false);

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
      if (!name.trim()) return setError(t("errors.nameRequired"));
      if (!emailValid) return setError(t("errors.emailInvalid"));
      if (password.length < 6) return setError(t("errors.passwordTooShort"));
      if (password !== confirm) return setError(t("errors.passwordMismatch"));
    } else {
      if (!emailValid) return setError(t("errors.emailInvalid"));
      if (!password) return setError(t("errors.passwordRequired"));
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation, emailSent: sent, error: err } = await signUp(name, email, password);
        if (err) {
          setError(friendlyAuthError(err));
        } else if (needsConfirmation) {
          setEmailSent(sent);
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

  const handleForgot = async () => {
    setError("");
    if (!emailValid) return setError(t("errors.emailInvalid"));
    setBusy(true);
    try {
      const { error: err } = await resetPassword(email);
      if (err) {
        setError(friendlyAuthError(err));
      } else {
        setResetSent(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResendHint("");
    const { error: err } = await resendConfirmation(sentTo || email);
    setResendHint(
      err
        ? t("step.resendFailed", { error: friendlyAuthError(err) })
        : t("step.resendSent")
    );
  };

  const friendlyAuthError = (msg: string): string => {
    if (/already registered|user already|already exists/i.test(msg))
      return t("errors.alreadyRegistered");
    if (/invalid login credentials/i.test(msg)) return t("errors.invalidCredentials");
    if (/email not confirmed/i.test(msg)) return t("errors.emailNotConfirmed");
    return msg;
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
              {t("step.title")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("step.sentPrefix")} <span className="font-medium text-foreground">{sentTo}</span>{" "}
              {t("step.sentSuffix")}
              <br />
              {t("step.instruction")}
            </p>
            {!emailSent && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                {t("step.sendFailed")}
              </p>
            )}
            <div className="mt-6 rounded-2xl border border-border bg-white p-5 text-left text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">{t("step.notReceived")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("step.tip1")}</li>
                <li>{t("step.tip2")}</li>
                <li>{t("step.tip3")}</li>
              </ul>
            </div>
            <button
              onClick={handleResend}
              className="mt-5 w-full rounded-xl border border-brand bg-white py-3 text-sm font-medium text-brand transition-colors hover:bg-brand-light"
            >
              {t("step.resend")}
            </button>
            {resendHint && <p className="mt-3 text-xs text-muted-foreground">{resendHint}</p>}
            <button
              onClick={() => router.replace("/onboarding")}
              className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {t("step.continueAnyway")}
            </button>
            <button
              onClick={() => {
                setSentTo("");
                setMode("signin");
              }}
              className="mt-4 text-sm text-muted-foreground hover:text-brand"
            >
              {t("step.backToSignIn")}
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
                {t("signedInAsPrefix")} <b>{displayName || user.email}</b>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => router.replace("/coach")}
                  className="flex-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
                >
                  {t("goWorkspace")}
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    router.refresh();
                  }}
                  className="flex-1 rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-white"
                >
                  {t("switchAccount")}
                </button>
              </div>
            </div>
          )}

          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
              🔑
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">
              {mode === "signin" ? t("titleSignIn") : t("titleSignUp")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin" ? t("subtitleSignIn") : t("subtitleSignUp")}
            </p>
          </div>

          {justVerified && mode === "signin" && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t("verified")}
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
                {m === "signin" ? t("tabs.signin") : t("tabs.signup")}
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
            {mode === "signup" && (
              <Field label={t("fields.name")}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t("fields.namePlaceholder")}
                  autoFocus
                  className="input-primary"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("fields.nameHint")}
                </p>
              </Field>
            )}

            <Field label={t("fields.email")}>
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

            <Field label={t("fields.password")}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode === "signup" ? t("fields.passwordPlaceholderSignUp") : t("fields.passwordPlaceholderSignIn")}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="input-primary"
              />
            </Field>

            {mode === "signup" && (
              <Field label={t("fields.confirm")}>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t("fields.confirmPlaceholder")}
                  autoComplete="new-password"
                  className="input-primary"
                />
              </Field>
            )}

            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={busy || resetSent}
                className="self-end text-xs text-muted-foreground underline hover:text-brand disabled:opacity-60"
              >
                {resetSent ? t("forgot.sent") : t("forgot.link")}
              </button>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? t("submit.busy")
                : mode === "signin"
                ? t("submit.signin")
                : t("submit.signup")}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("footnote")}
          </p>
        </div>
      </main>

      <SiteFooter />
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
      <LocaleSwitcher />
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

export default function LoginPage() {
  const t = useTranslations("login");
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>}>
      <LoginInner />
    </Suspense>
  );
}
