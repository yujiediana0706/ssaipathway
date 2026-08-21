"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeUser, syncUserToSupabase } from "@/lib/userStore";
import type { StoredUser } from "@/lib/userStore";

type Step = 1 | 2 | 3 | 4;

interface Form {
  name: string;
  currentRole: string;
  years: string;
  type: "A" | "B" | null;
  target: string;
}

const yearOptions = ["0-1 年", "2-4 年", "5-8 年", "8 年以上"];

export default function OnboardingPage() {
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

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    setError("");

    if (step === 1 && !form.name.trim()) {
      setError("请输入你的名字");
      return;
    }
    if (step === 2 && !form.currentRole.trim()) {
      setError("请输入你的当前岗位");
      return;
    }
    if (step === 3 && !form.years) {
      setError("请选择工作年限");
      return;
    }
    if (step === 4 && !form.type) {
      setError("请选择探索方向");
      return;
    }
    if (step === 4 && form.type === "B" && !form.target.trim()) {
      setError("请输入你的目标岗位");
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
          创建转型档案
        </span>
        <span className="text-sm text-muted-foreground">
          {step} / {totalSteps}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <div key={step} className="flex flex-1 flex-col animate-[fadeIn_0.3s_ease-out]">
          {step === 1 && (
            <StepContainer
              emoji="👋"
              title="欢迎使用 Pathway。我是小北，你的职业发展教练"
              subtitle="先告诉我，怎么称呼你？"
            >
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder="你的名字或昵称"
                autoFocus
                className="input-primary py-3 text-base"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                你的名字仅用于个性化体验，不会被分享给第三方。
              </p>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              emoji="💼"
              title="你目前从事什么岗位？"
              subtitle="小北想先了解一下你的职业背景"
            >
              <input
                type="text"
                value={form.currentRole}
                onChange={(e) => setForm({ ...form, currentRole: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder="例如：产品经理、前端开发、教师、运营..."
                autoFocus
                className="input-primary py-3 text-base"
              />
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer
              emoji="⏳"
              title="你在当前领域工作多久了？"
              subtitle="小北会结合你的经验，帮你找到更适合的转型节奏"
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
              title="你的转型方向？"
              subtitle="告诉小北，你想走向哪里"
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
                    <span className="text-base font-medium">还在探索，没有明确方向</span>
                  </div>
                  <span className={`text-xs ${form.type === "A" ? "text-brand-border" : "text-muted-foreground"}`}>
                    小北会结合你的背景，帮你找到 3–5 个潜力方向
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
                    <span className="text-base font-medium">已有目标方向</span>
                  </div>
                  <span className={`text-xs ${form.type === "B" ? "text-brand-border" : "text-muted-foreground"}`}>
                    小北会围绕你的目标，帮你梳理能力缺口和转型路线
                  </span>
                </button>

                {form.type === "B" && (
                  <div className="animate-[fadeIn_0.3s_ease-out]">
                    <input
                      type="text"
                      value={form.target}
                      onChange={(e) => setForm({ ...form, target: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleNext()}
                      placeholder="你的目标岗位，例如：AI 产品经理"
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
                ← 上一步
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleNext}
              className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {step === 4 ? "完成，开始探索 →" : "继续 →"}
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
