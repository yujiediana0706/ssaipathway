"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { storeUser, syncUserToSupabase } from "@/lib/userStore";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analyticsClient";
import { EVENTS } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
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
  const locale = useLocale();
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

  const { profile, user } = useAuth();

  // 从首页点「开始职业诊断」始终从头开始；
  // 账号里的名字只作为可选项提示，不自动写进输入框。
  const suggestedName = profile?.name || user?.displayName || "";

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

  useEffect(() => {
    track(EVENTS.quizStart, { surface: "onboarding" });
  }, []);

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

    // 档案已写入本地（storeUser），explore 会从本地读取；
    // URL 只保留一个无敏感信息的标记，避免姓名/岗位进入历史记录与访问日志
    router.push("/explore?onboarded=1");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          <button
            onClick={() => {
              if (step > 1 && !window.confirm(locale === "zh" ? "离开后本次填写不会保存，确定退出吗？" : "Your progress won't be saved. Leave anyway?")) return;
              router.push("/");
            }}
            className="text-xs text-muted-foreground hover:text-brand"
          >
            {locale === "zh" ? "退出" : "Exit"}
          </button>
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
              {suggestedName && !form.name.trim() && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, name: suggestedName })}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand-border hover:text-brand"
                >
                  {locale === "zh" ? `继续使用 ${suggestedName}` : `Continue as ${suggestedName}`}
                </button>
              )}
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
              <Button variant="ghost" onClick={handleBack}>
                {t("back")}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={handleNext} className="rounded-full">
              {step === 4 ? t("finish") : t("next")}
            </Button>
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
