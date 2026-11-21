"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";
import { getStoredUser, syncUserToSupabase } from "@/lib/userStore";
import SiteFooter from "@/components/SiteFooter";
import LocaleSwitcher from "@/components/LocaleSwitcher";

type Mode = "signin" | "signup";

function LoginInner() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signIn, signUp, resendConfirmation, resetPassword, signOut } = useAuth();

  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "";
  const inviteParam = (searchParams.get("invite") || "").trim();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false); // 注册前必须勾选条款与隐私政策
  const [consentCrossBorder, setConsentCrossBorder] = useState(false); // 个人信息出境处理，独立勾选
  const [ageConfirmed, setAgeConfirmed] = useState(false); // 年满 18 周岁声明
  const [inviteCode, setInviteCode] = useState(inviteParam);
  const [inviteRequired, setInviteRequired] = useState(false);
  const [inviteType, setInviteType] = useState<"peer" | "coach" | null>(null);
  const [inviteProblem, setInviteProblem] = useState("");
  // 邀请码校验三态：校验中 / 校验失败（超时或网络异常）/ 已得出结果
  const [inviteChecking, setInviteChecking] = useState(true);
  const [inviteCheckFailed, setInviteCheckFailed] = useState(false);
  const [inviteRetry, setInviteRetry] = useState(0);
  const [sentTo, setSentTo] = useState(""); // 注册后进入"去邮箱验证"页
  const [signupInProgress, setSignupInProgress] = useState(false); // 注册中禁止自动跳转
  const [emailSent, setEmailSent] = useState(true);
  const [resendHint, setResendHint] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const next = searchParams.get("next") || "";
  const justVerified = searchParams.get("verified") === "1";
  const unverified = searchParams.get("unverified") === "1";
  const modeParam = searchParams.get("mode");

  // 根据 URL param 自动切换 Tab
  useEffect(() => {
    if (modeParam === "signup") setMode("signup");
    else if (modeParam === "signin") setMode("signin");
  }, [modeParam]);

  // 邀请码：服务端返回开关状态；带 ?invite=CODE 时校验并区分 peer / coach 落地文案
  useEffect(() => {
    let active = true;
    setInviteChecking(true);
    setInviteCheckFailed(false);
    (async () => {
      try {
        const qs = inviteParam ? `?code=${encodeURIComponent(inviteParam)}` : "";
        const r = await fetch(`/api/auth/invite${qs}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        const d = r.ok ? await r.json() : null;
        if (!active) return;
        if (!d) {
          setInviteCheckFailed(true);
          return;
        }
        setInviteRequired(Boolean(d.required));
        if (inviteParam) {
          setMode("signup");
          if (d.valid && (d.type === "peer" || d.type === "coach")) {
            setInviteType(d.type);
            setInviteProblem("");
          } else {
            setInviteProblem(d.reason || "not_found");
            // 开关关闭时仍允许公开注册：清掉失效链接里的旧码，避免误提交
            if (!d.required) setInviteCode("");
          }
        }
      } catch {
        // 网络异常 / 超时：明确提示并允许重试，不把"未校验"当成"无效"
        if (active) setInviteCheckFailed(true);
      } finally {
        if (active) setInviteChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [inviteParam, inviteRetry]);

  // 已登录但有 next 参数（如邮箱验证后回来、protected 页面被拦下来的）→ 直接跳
  // 否则停留在 login 页给用户看到登录/注册界面
  // 注册过程中禁止跳转，避免闪现 dashboard
  useEffect(() => {
    if (loading || signupInProgress) return;
    if (user && next && !sentTo) {
      router.replace(next);
    }
  }, [user, loading, next, sentTo, signupInProgress, router]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const inviteErrorMessage = (reason?: string): string => {
    if (reason === "used") return t("invite.used");
    if (reason === "exhausted") return t("invite.exhausted");
    if (reason === "expired") return t("invite.expired");
    if (reason === "email_mismatch") return t("invite.emailMismatch");
    return t("invite.invalid");
  };

  const inviteLandingPath = (type: "peer" | "coach") => `/become-coach?role=${type}`;

  const handleSubmit = async () => {
    setError("");
    setResendHint("");

    if (mode === "signup") {
      if (!name.trim()) return setError(t("errors.nameRequired"));
      if (!emailValid) return setError(t("errors.emailInvalid"));
      if (password.length < 8) return setError(t("errors.passwordTooShort"));
      if (password !== confirm) return setError(t("errors.passwordMismatch"));
      if (!agree) return setError(t("errors.agreeRequired"));
      if (!consentCrossBorder) return setError(t("errors.crossBorderRequired"));
      if (!ageConfirmed) return setError(t("errors.ageRequired"));
      if (inviteRequired && !inviteCode.trim()) return setError(t("errors.inviteRequired"));
      if (inviteRequired && inviteCode.trim() && inviteProblem) {
        return setError(inviteErrorMessage(inviteProblem));
      }
    } else {
      if (!emailValid) return setError(t("errors.emailInvalid"));
      if (!password) return setError(t("errors.passwordRequired"));
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const code = inviteCode.trim();
        let resolvedType = inviteType;
        if (code) {
          const res = await fetch("/api/auth/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, email: email.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            setError(inviteErrorMessage(data.reason));
            return;
          }
          if (data.type === "peer" || data.type === "coach") {
            resolvedType = data.type;
            setInviteType(data.type);
          }
          setInviteProblem("");
        }
        setSignupInProgress(true);
        const { needsConfirmation, emailSent: sent, error: err } = await signUp(name, email, password);

        // 注册成功后立即激活一次性邀请码，并记录身份类型用于后续路径
        if (!err && code && resolvedType) {
          try {
            const claim = await fetch("/api/auth/invite/claim", {
              method: "POST",
              headers: { ...(await authHeaders()), "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            if (!claim.ok) {
              setError(t("invite.claimFailed"));
              setSignupInProgress(false);
              return;
            }
            localStorage.setItem("pathway:invite-type", resolvedType);
          } catch {
            setError(t("invite.claimFailed"));
            setSignupInProgress(false);
            return;
          }
        }

        if (err) {
          setError(friendlyAuthError(err));
          setSignupInProgress(false);
        } else if (needsConfirmation) {
          setEmailSent(sent);
          setSentTo(email.trim());
          // sentTo 设置后，重定向 effect 会被 !sentTo 条件拦截，这里再释放标记
          setSignupInProgress(false);
        } else {
          // 无需验证，直接跳转；顺带把游客阶段存在本地的档案补同步到云端
          const stored = getStoredUser();
          if (stored) void syncUserToSupabase(stored);
          setSignupInProgress(false);
          if (resolvedType) {
            setTimeout(() => router.replace(inviteLandingPath(resolvedType)), 300);
          }
        }
        // 若无需验证（session 直接返回），useEffect 会自动跳转
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(friendlyAuthError(err));
        } else {
          // 登录成功 → 把游客阶段存在本地的档案补同步到云端
          const stored = getStoredUser();
          if (stored) void syncUserToSupabase(stored);
          // 手动跳转
          setTimeout(() => {
            if (next) {
              router.replace(next);
              return;
            }
            // 持邀请码注册的用户：登录后直接进入对应申请路径，身份类型已默认选好
            const pendingInvite = localStorage.getItem("pathway:invite-type");
            if (pendingInvite === "peer" || pendingInvite === "coach") {
              localStorage.removeItem("pathway:invite-type");
              router.replace(inviteLandingPath(pendingInvite));
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
      setSignupInProgress(false);
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
    const { error: err } = await resendConfirmation(sentTo || email || user?.email || "");
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmit();
  };

  // —— 注册后：去邮箱验证 ——
  if (sentTo) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
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
              onClick={() => {
                const storedType = localStorage.getItem("pathway:invite-type");
                const target =
                  inviteType || (storedType === "peer" || storedType === "coach" ? storedType : null);
                router.replace(target ? inviteLandingPath(target) : "/onboarding");
              }}
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          {/* 已登录但想切换账号的提示（只在 signin tab 显示，signup tab 下不显示，避免误导） */}
          {user && !loading && mode === "signin" && (
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
              {unverified && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p>{t("errors.emailNotConfirmed")}</p>
                  <button
                    onClick={handleResend}
                    className="mt-2 font-medium underline"
                  >
                    {t("step.resend")}
                  </button>
                  {resendHint && <p className="mt-1">{resendHint}</p>}
                </div>
              )}
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

          {inviteParam && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                inviteType && !inviteChecking && !inviteCheckFailed
                  ? "border-brand-light bg-brand-light/40 text-brand"
                  : inviteChecking
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-medium">
                {inviteChecking
                  ? t("invite.checking")
                  : inviteCheckFailed
                    ? t("invite.checkFailed")
                    : inviteType
                      ? t("invite.title")
                      : inviteErrorMessage(inviteProblem)}
              </p>
              {!inviteChecking && !inviteCheckFailed && inviteType && (
                <p className="mt-1 text-xs leading-5">
                  {inviteType === "coach" ? t("invite.coach") : t("invite.peer")}
                </p>
              )}
              {inviteCheckFailed && (
                <button
                  type="button"
                  onClick={() => setInviteRetry((n) => n + 1)}
                  className="mt-2 rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  {t("invite.retry")}
                </button>
              )}
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

          <form
            onSubmit={onSubmit}
            noValidate
            className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
          >
            {mode === "signup" && (
              <Field label={t("fields.name")} htmlFor="login-name">
                <input
                  id="login-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("fields.namePlaceholder")}
                  autoComplete="nickname"
                  className="input-primary"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("fields.nameHint")}
                </p>
              </Field>
            )}

            <Field label={t("fields.email")} htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="input-primary"
              />
            </Field>

            <Field label={t("fields.password")} htmlFor="login-password">
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? t("fields.passwordPlaceholderSignUp") : t("fields.passwordPlaceholderSignIn")}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="input-primary pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t("fields.hidePassword") : t("fields.showPassword")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-brand"
                >
                  {showPw ? t("fields.hidePassword") : t("fields.showPassword")}
                </button>
              </div>
            </Field>

            {mode === "signup" && (
              <Field label={t("fields.confirm")} htmlFor="login-confirm">
                <input
                  id="login-confirm"
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("fields.confirmPlaceholder")}
                  autoComplete="new-password"
                  className="input-primary"
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="mt-2 text-xs text-rose-600">{t("errors.passwordMismatch")}</p>
                )}
              </Field>
            )}

            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={busy || resetSent}
                className="ml-auto block text-xs text-muted-foreground underline hover:text-brand disabled:opacity-60"
              >
                {resetSent ? t("forgot.sent") : t("forgot.link")}
              </button>
            )}

            {mode === "signup" && (inviteRequired || inviteChecking || inviteCheckFailed) && (
              <Field label={t("consent.inviteLabel")} htmlFor="login-invite">
                <input
                  id="login-invite"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    setInviteProblem("");
                  }}
                  placeholder={t("consent.invitePlaceholder")}
                  autoComplete="off"
                  className="input-primary"
                />
                {inviteChecking && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("invite.checking")}</p>
                )}
                {inviteCheckFailed && (
                  <p className="mt-2 text-xs text-amber-700">{t("invite.checkFailed")}</p>
                )}
              </Field>
            )}

            {mode === "signup" && (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span>
                    {t("agree.prefix")}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="mx-0.5 text-brand underline underline-offset-2"
                    >
                      {t("agree.terms")}
                    </Link>
                    {t("agree.and")}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="mx-0.5 text-brand underline underline-offset-2"
                    >
                      {t("agree.privacy")}
                    </Link>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consentCrossBorder}
                    onChange={(e) => setConsentCrossBorder(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span>{t("consent.crossBorder")}</span>
                </label>

                <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span>{t("consent.age")}</span>
                </label>
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={
                busy ||
                (mode === "signup" &&
                  (!agree ||
                    !consentCrossBorder ||
                    !ageConfirmed ||
                    (inviteRequired && !inviteCode.trim())))
              }
              className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? t("submit.busy")
                : mode === "signin"
                ? t("submit.signin")
                : t("submit.signup")}
            </button>
          </form>

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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-background">
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

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
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
