"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { storeUser, syncUserToSupabase } from "@/lib/userStore";
import { useAuth } from "@/lib/auth";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import type { StoredUser } from "@/lib/userStore";

type Step = 1 | 2 | 3 | 4;

interface Form {
  name: string;
  currentRole: string;
  years: string;
  type: "A" | "B" | null;
  target: string;
}

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const yearOptions = [
    t("step3.options.y0"),
    t("step3.options.y1"),
    t("step3.options.y2"),
    t("step3.options.y3"),
  ];
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>({
    name: "",
    currentRole: "",
    years: "",
    type: null,
    target: "",
  });
  const [error, setError] = useState("");

  const { profile, user, storedUser } = useAuth();

  // 如果已经有完整档案（任一信号命中），自动跳过 onboarding
  // 注意：仅对已登录用户生效，匿名用户（延迟注册）始终显示表单
  useEffect(() => {
    if (!user) return;
    // 信号 1：Supabase profile 有 current_role
    if (profile?.current_role) {
      const timer = setTimeout(() => router.replace("/coach"), 50);
      return () => clearTimeout(timer);
    }
    // 信号 2：localStorage 里有完整老数据（currentRole + years 都有）
    try {
      const raw = localStorage.getItem("pathway:user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.currentRole && u?.years) {
          // 自动触发 backfill（loadProfile 会做）
          const timer = setTimeout(() => router.replace("/coach"), 200);
          return () => clearTimeout(timer);
        }
      }
    } catch { /* ignore */ }
  }, [profile, storedUser, user, router]);

  // 名字以注册账号为准：预填注册时的昵称，保证账号名与旅程名字一致
  useEffect(() => {
    const accountName =
      profile?.name || user?.displayName || "";
    if (accountName) {
      setForm((f) => (f.name ? f : { ...f, name: accountName }));
    }
  }, [profile, user]);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    setError("");

    if (step === 1 && !form.name.trim()) {
      setError(t("errors.name"));
      return;
    }
    if (step === 2 && !form.currentRole.trim()) {
      setError(t("errors.role"));
      return;
    }
    if (step === 3 && !form.years) {
      setError(t("errors.years"));
      return;
    }
    if (step === 4 && !form.type) {
      setError(t("errors.type"));
      return;
    }
    if (step === 4 && form.type === "B" && !form.target.trim()) {
      setError(t("errors.target"));
      return;
    }

    if (step < 4) {
      setStep((s) => (s + 1) as Step);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    setError("");
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const completeOnboarding = async () => {
    const now = Date.now();
    const user: StoredUser = {
      name: form.name.trim(),
      currentRole: form.currentRole.trim(),
      years: form.years,
      skills: "",
      interests: "",
      target: form.type === "B" ? form.target.trim() : "",
      type: form.type,
      createdAt: now,
      updatedAt: now,
    };
    storeUser(user);

    // Sync to Supabase
    const userId = await syncUserToSupabase(user);
    if (userId) {
      console.info("[Pathway] Onboarding user synced to Supabase:", userId);
    }

    // Pass basic info to explore so AI doesn't re-ask name/role
    const params = new URLSearchParams({
      onboarded: "1",
      name: user.name,
      role: user.currentRole,
      years: user.years,
      type: user.type || "A",
    });
    if (user.target) params.set("target", user.target);
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf9]">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-brand-border">
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight text-brand">
          {t("header")}
        </span>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <span className="text-sm text-muted-foreground">
            {step} / {totalSteps}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <div key={step} className="flex flex-1 flex-col animate-[fadeIn_0.3s_ease-out]">
          {step === 1 && (
            <StepContainer
              emoji="👋"
              title={t("step1.title")}
              subtitle={t("step1.subtitle")}
            >
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder={t("step1.placeholder")}
                autoFocus
                className="input-primary py-3 text-base"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {t("step1.hint")}
              </p>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              emoji="💼"
              title={t("step2.title")}
              subtitle={t("step2.subtitle")}
            >
              <input
                type="text"
                value={form.currentRole}
                onChange={(e) => setForm({ ...form, currentRole: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder={t("step2.placeholder")}
                autoFocus
                className="input-primary py-3 text-base"
              />
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer
              emoji="⏳"
              title={t("step3.title")}
              subtitle={t("step3.subtitle")}
            >
              <div className="grid grid-cols-2 gap-3">
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    onClick={() => setForm({ ...form, years: y })}
                    className={`rounded-2xl border p-5 text-left transition-all ${
                      form.years === y
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-white text-foreground hover:border-brand-border"
                    }`}
                  >
                    <span className="text-base font-medium">{y}</span>
                  </button>
                ))}
              </div>
            </StepContainer>
          )}

          {step === 4 && (
            <StepContainer
              emoji="🧭"
              title={t("step4.title")}
              subtitle={t("step4.subtitle")}
            >
              <div className="space-y-3">
                <button
                  onClick={() => setForm({ ...form, type: "A", target: "" })}
                  className={`flex w-full flex-col gap-1 rounded-2xl border p-5 text-left transition-all ${
                    form.type === "A"
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-foreground hover:border-brand-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">A</span>
                    <span className="text-base font-medium">{t("step4.optionA.title")}</span>
                  </div>
                  <span className={`text-xs ${form.type === "A" ? "text-brand-border" : "text-muted-foreground"}`}>
                    {t("step4.optionA.desc")}
                  </span>
                </button>

                <button
                  onClick={() => setForm({ ...form, type: "B" })}
                  className={`flex w-full flex-col gap-1 rounded-2xl border p-5 text-left transition-all ${
                    form.type === "B"
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-white text-foreground hover:border-brand-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">B</span>
                    <span className="text-base font-medium">{t("step4.optionB.title")}</span>
                  </div>
                  <span className={`text-xs ${form.type === "B" ? "text-brand-border" : "text-muted-foreground"}`}>
                    {t("step4.optionB.desc")}
                  </span>
                </button>

                {form.type === "B" && (
                  <div className="animate-[fadeIn_0.3s_ease-out]">
                    <input
                      type="text"
                      value={form.target}
                      onChange={(e) => setForm({ ...form, target: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleNext()}
                      placeholder={t("step4.targetPlaceholder")}
                      autoFocus
                      className="input-primary py-3 text-base"
                    />
                  </div>
                )}
              </div>
            </StepContainer>
          )}

          {error && (
            <p className="mt-4 text-sm text-rose-600">{error}</p>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="text-sm text-muted-foreground hover:text-brand"
              >
                {t("back")}
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleNext}
              className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {step === 4 ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function StepContainer({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-3xl">
          {emoji}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
