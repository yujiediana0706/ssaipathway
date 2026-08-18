"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";

type Stage = "select" | "mode" | "play" | "result";
type Mode = "day-in-life" | "interview";

interface RoleOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const roleOptions: RoleOption[] = [
  { id: "pm", name: "产品经理", emoji: "🎯", description: "负责产品规划、需求定义与落地" },
  { id: "ds", name: "数据科学家", emoji: "📊", description: "数据建模、分析与业务洞察" },
  { id: "ux", name: "UX 设计师", emoji: "🎨", description: "用户体验设计与交互" },
  { id: "brand", name: "品牌/市场", emoji: "📣", description: "品牌策略与市场推广" },
  { id: "fe", name: "前端工程师", emoji: "💻", description: "构建用户界面与交互体验" },
  { id: "ai", name: "AI 工程师", emoji: "🤖", description: "AI 模型开发与应用落地" },
];

interface Scenario {
  id: number;
  title: string;
  time: string;
  context: string;
  prompt: string;
  choices: { id: string; label: string; scores: Partial<Record<Dimension, number>> }[];
}

type Dimension = "execution" | "strategy" | "collaboration" | "userFocus";

const dimensionLabels: Record<Dimension, { short: string; full: string }> = {
  execution: { short: "执行", full: "落地执行" },
  strategy: { short: "策略", full: "策略思维" },
  collaboration: { short: "协作", full: "协作沟通" },
  userFocus: { short: "用户", full: "用户导向" },
};

function buildScenarios(roleName: string): Scenario[] {
  return [
    {
      id: 1,
      title: "晨会与任务排期",
      time: "09:30",
      context: `周一早晨，你是${roleName}，团队正在讨论本周优先级。资源有限，无法同时完成 A（用户体验优化）、B（业务方强推的变现功能）、C（技术债务清理）。`,
      prompt: `各位早上好。本周我们的资源只够做一个方向，我需要${roleName}给出建议。你怎么看？`,
      choices: [
        { id: "a", label: "聚焦 A：用户价值优先", scores: { userFocus: 3, execution: 1 } },
        { id: "b", label: "聚焦 B：对营收负责", scores: { execution: 3, strategy: 1 } },
        { id: "c", label: "聚焦 C：长期基建", scores: { strategy: 3, collaboration: 1 } },
      ],
    },
    {
      id: 2,
      title: "突发状况应对",
      time: "15:20",
      context: "线上出现紧急问题，影响部分用户。客服已收到投诉，工程团队定位需要 30 分钟。",
      prompt: "刚才监控告警了，你作为负责人怎么协调？",
      choices: [
        { id: "a", label: "立即公告，稳住用户", scores: { userFocus: 3, collaboration: 2 } },
        { id: "b", label: "先修复，后说明", scores: { execution: 3, strategy: 1 } },
        { id: "c", label: "拉紧急会议", scores: { collaboration: 3, strategy: 2 } },
      ],
    },
    {
      id: 3,
      title: "跨团队冲突",
      time: "10:00",
      context: "设计与工程就交互方案分歧，双方僵持，需要你来决策。",
      prompt: "设计要复杂交互，工程说实现成本高。你作为" + roleName + "怎么平衡？",
      choices: [
        { id: "a", label: "支持设计：体验至上", scores: { userFocus: 3, strategy: 1 } },
        { id: "b", label: "支持工程：简化上线", scores: { execution: 3, userFocus: 1 } },
        { id: "c", label: "折中：核心保留，边缘简化", scores: { collaboration: 3, userFocus: 1, execution: 1 } },
      ],
    },
    {
      id: 4,
      title: "季度汇报",
      time: "16:00",
      context: "向 CEO 汇报下季度规划，只有 15 分钟。",
      prompt: "时间紧，你只有 15 分钟。你打算怎么用？",
      choices: [
        { id: "a", label: "数据与成果", scores: { execution: 2, strategy: 2 } },
        { id: "b", label: "用户洞察故事", scores: { userFocus: 3, collaboration: 1 } },
        { id: "c", label: "战略与长期布局", scores: { strategy: 3, collaboration: 1 } },
      ],
    },
  ];
}

function computePersonalityTag(roleName: string, scores: Record<Dimension, number>): string {
  const sorted = (Object.keys(scores) as Dimension[]).sort((a, b) => scores[b] - scores[a]);
  const top = sorted[0];
  const map: Record<Dimension, string> = {
    execution: `你是偏向落地执行型${roleName}`,
    strategy: `你是偏向策略规划型${roleName}`,
    collaboration: `你是偏向协作沟通型${roleName}`,
    userFocus: `你是偏向用户洞察型${roleName}`,
  };
  return map[top];
}

function computeScore(scores: Record<Dimension, number>, scenarios: Scenario[]): number {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const max = scenarios.reduce((acc, s) => {
    const taskMax = Math.max(...s.choices.map((c) => Object.values(c.scores).reduce((a, b) => a + b, 0)));
    return acc + taskMax;
  }, 0);
  return Math.round((total / max) * 100);
}

async function fetchAIFeedback(roleName: string, scenario: Scenario, choiceLabel: string): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `场景：${scenario.context}\n用户选择了：${choiceLabel}\n请以${roleName}前辈的口吻，对用户的决策给出简短反馈（1-2句话，亲切口语化，带点幽默感）。`,
          },
        ],
        systemPrompt: `你是一位资深${roleName}，正在带新人体验岗位日常。你的语气亲切、专业、带点幽默。回答控制在 60 字以内。`,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.content || "不错的选择，继续加油！";
  } catch {
    return "这个选择很有你的风格，继续体验下一个场景。";
  }
}

async function fetchInterviewQuestion(roleName: string, round: number, history: string): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `这是第 ${round}/5 轮。${history ? `之前的对话：${history}` : ""}请提出一个针对${roleName}岗位的面试问题。`,
          },
        ],
        systemPrompt: `你是面试官，正在面试${roleName}岗位的候选人。每轮只问一个问题，问题要有挑战性但贴合实际工作。控制在 50 字以内。`,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.content || `请谈谈你对${roleName}这个岗位的理解？`;
  } catch {
    return `请谈谈你对${roleName}这个岗位的理解？`;
  }
}

async function fetchInterviewScore(roleName: string, transcript: string): Promise<{ score: number; feedback: string }> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `这是候选人回答${roleName}岗位面试的对话记录：\n${transcript}\n\n请给出一个 0-100 的分数，并用一句话点评。格式：分数|点评`,
          },
        ],
        systemPrompt: "你是面试官，根据候选人表现给出客观评分与简短点评。回答格式：数字|一句话点评。",
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const text = data.content || "70|表现不错，继续努力。";
    const [scoreStr, feedback] = text.split("|");
    return { score: parseInt(scoreStr.trim()) || 70, feedback: feedback?.trim() || "表现不错" };
  } catch {
    return { score: 72, feedback: "整体表现稳健，建议加强对岗位核心能力的理解。" };
  }
}

export default function SimulatorPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("select");
  const [roleName, setRoleName] = useState("");
  const [mode, setMode] = useState<Mode>("day-in-life");

  const handleSelectRole = (name: string) => {
    setRoleName(name);
    setStage("mode");
  };

  const handleSelectMode = (m: Mode) => {
    setMode(m);
    setStage("play");
  };

  const handleReset = () => {
    setRoleName("");
    setMode("day-in-life");
    setStage("select");
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <NavBar />
      {stage === "select" && <RoleSelectStage onSelect={handleSelectRole} />}
      {stage === "mode" && (
        <ModeSelectStage roleName={roleName} onSelect={handleSelectMode} onBack={() => setStage("select")} />
      )}
      {stage === "play" && mode === "day-in-life" && (
        <DayInLifeStage roleName={roleName} onFinish={() => setStage("result")} onBack={handleReset} />
      )}
      {stage === "play" && mode === "interview" && (
        <InterviewStage roleName={roleName} onFinish={() => setStage("result")} onBack={handleReset} />
      )}
      {stage === "result" && (
        <ResultStage roleName={roleName} mode={mode} onReset={handleReset} onCoach={() => router.push("/coach")} />
      )}
    </div>
  );
}

function RoleSelectStage({ onSelect }: { onSelect: (name: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-2xl">
          🎮
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">岗位模拟器</h1>
        <p className="mt-2 text-sm text-zinc-500">选择你想要体验的岗位，沉浸式感受真实工作日常</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roleOptions.map((role, i) => (
          <button
            key={role.id}
            onClick={() => onSelect(role.name)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-zinc-900 hover:shadow-lg animate-[slideUp_0.4s_ease-out_both]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-2xl transition-transform group-hover:scale-110">
              {role.emoji}
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900">{role.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{role.description}</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors group-hover:text-zinc-900">
              选择此岗位
              <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <label className="mb-2 block text-sm font-medium text-zinc-700">没看到想要的？自定义岗位</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) onSelect(custom.trim());
            }}
            placeholder="输入任意岗位名称，例如：运营、产品运营、增长黑客..."
            className="input-primary flex-1"
          />
          <button
            onClick={() => custom.trim() && onSelect(custom.trim())}
            disabled={!custom.trim()}
            className="btn-primary disabled:opacity-40"
          >
            开始体验
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

function ModeSelectStage({
  roleName,
  onSelect,
  onBack,
}: {
  roleName: string;
  onSelect: (m: Mode) => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 animate-[fadeIn_0.4s_ease-out]">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        重新选择岗位
      </button>

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          体验 {roleName} 的两种方式
        </h1>
        <p className="mt-2 text-sm text-zinc-500">选择你想要的模拟形式</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <button
          onClick={() => onSelect("day-in-life")}
          className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-zinc-900 hover:shadow-lg"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl transition-transform group-hover:scale-110">
            ☀️
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">一日体验</h3>
            <p className="mt-1 text-sm text-zinc-500">
              沉浸式体验 {roleName} 一天的工作日常，4 个典型场景，AI 前辈带你做决策
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="chip">4 个场景</span>
            <span className="chip">AI 角色扮演</span>
            <span className="chip">支持语音</span>
          </div>
        </button>

        <button
          onClick={() => onSelect("interview")}
          className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-zinc-900 hover:shadow-lg"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl transition-transform group-hover:scale-110">
            💼
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">面试模拟</h3>
            <p className="mt-1 text-sm text-zinc-500">
              AI 面试官模拟真实 {roleName} 面试，5 轮问答，支持语音作答
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="chip">5 轮问答</span>
            <span className="chip">AI 面试官</span>
            <span className="chip">支持语音</span>
          </div>
        </button>
      </div>
    </main>
  );
}

function DayInLifeStage({
  roleName,
  onFinish,
  onBack,
}: {
  roleName: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  const scenarios = useRef(buildScenarios(roleName)).current;
  const [current, setCurrent] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    execution: 0,
    strategy: 0,
    collaboration: 0,
    userFocus: 0,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [animating, setAnimating] = useState(false);

  const scenario = scenarios[current];
  const progress = ((current + 1) / scenarios.length) * 100;

  const handleSelect = async (choiceId: string) => {
    if (selected) return;
    setSelected(choiceId);
    const choice = scenario.choices.find((c) => c.id === choiceId)!;
    const newScores = { ...scores };
    for (const [dim, val] of Object.entries(choice.scores)) {
      newScores[dim as Dimension] += val || 0;
    }
    setScores(newScores);

    setLoadingFeedback(true);
    const fb = await fetchAIFeedback(roleName, scenario, choice.label);
    setFeedback(fb);
    setLoadingFeedback(false);
  };

  const handleNext = () => {
    if (current === scenarios.length - 1) {
      onFinish();
    } else {
      setAnimating(true);
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setSelected(null);
        setFeedback("");
        setAnimating(false);
      }, 400);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="h-1.5 w-full bg-zinc-200">
        <div
          className="h-full bg-zinc-900 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
              {roleName} · 一日模拟
            </span>
            <span className="text-sm text-zinc-500">{scenario.time}</span>
          </div>
          <div className="text-sm text-zinc-500">
            任务 <span className="font-semibold text-zinc-900">{current + 1}</span>
            <span className="text-zinc-400"> / {scenarios.length}</span>
          </div>
        </div>

        <div
          className={`flex flex-1 flex-col gap-6 transition-all duration-300 ${
            animating ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
          }`}
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xl text-white animate-[bounce_2s_infinite]">
                🧑‍💼
              </div>
              <div className="flex-1">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  AI 前辈 · {roleName}
                </p>
                <p className="text-base leading-relaxed text-zinc-800">
                  {scenario.prompt}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              场景背景
            </p>
            <p className="text-sm leading-relaxed text-zinc-700">{scenario.context}</p>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-zinc-500">请选择你的应对方式：</p>
            <div className="space-y-3">
              {scenario.choices.map((choice) => {
                const isSelected = selected === choice.id;
                const isDisabled = !!selected && !isSelected;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleSelect(choice.id)}
                    disabled={!!selected}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-5 text-left transition-all ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : isDisabled
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                        : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-md"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected ? "bg-white text-zinc-900" : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                      }`}
                    >
                      {choice.id.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{choice.label}</span>
                    {isSelected && (
                      <svg className="ml-auto h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm">
                  💬
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    AI 前辈反馈
                  </p>
                  {loadingFeedback ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <span className="inline-flex gap-0.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]"></span>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]"></span>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500"></span>
                      </span>
                      正在点评...
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-emerald-900">{feedback}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selected && !loadingFeedback && (
            <button
              onClick={handleNext}
              className="w-full rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {current === scenarios.length - 1 ? "查看你的画像 →" : "继续下一个场景 →"}
            </button>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">当前得分</p>
              <p className="text-2xl font-bold text-zinc-900">
                {Object.values(scores).reduce((a, b) => a + b, 0)}
                <span className="text-sm font-normal text-zinc-400"> 分</span>
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {(Object.keys(dimensionLabels) as Dimension[]).map((dim) => (
                <div key={dim} className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">{dimensionLabels[dim].short}</span>
                  <div className="h-2 w-12 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${Math.min((scores[dim] / Math.max(current * 4, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900">
              退出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewStage({
  roleName,
  onFinish,
  onBack,
}: {
  roleName: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } = useVoiceInput({
    onFinal: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text));
    },
  });

  const totalRounds = 5;

  const askNext = useCallback(async (history: string) => {
    setLoading(true);
    const q = await fetchInterviewQuestion(roleName, round + 1, history);
    setMessages((prev) => [...prev, { role: "ai", content: q }]);
    setLoading(false);
  }, [roleName, round]);

  useEffect(() => {
    askNext("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    const newRound = round + 1;
    setRound(newRound);

    if (newRound >= totalRounds) {
      const transcript = messages.map((m) => `${m.role === "ai" ? "面试官" : "候选人"}：${m.content}`).join("\n") + `\n候选人：${text}`;
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1500));
      setLoading(false);
      setFinished(true);
      onFinish();
      void transcript;
    } else {
      const history = messages.map((m) => `${m.role === "ai" ? "面试官" : "候选人"}：${m.content}`).join("\n") + `\n候选人：${text}`;
      askNext(history);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
            {roleName} · 面试模拟
          </span>
        </div>
        <div className="text-sm text-zinc-500">
          第 <span className="font-semibold text-zinc-900">{Math.min(round + 1, totalRounds)}</span> / {totalRounds} 轮
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-zinc-900 transition-all duration-500"
          style={{ width: `${(Math.min(round + (loading ? 0 : 1), totalRounds) / totalRounds) * 100}%` }}
        />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-[slideUp_0.3s_ease-out]`}
          >
            {m.role === "ai" && (
              <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm text-white">
                💼
              </div>
            )}
            <div
              className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm text-white">
              💼
            </div>
            <div className="rounded-2xl bg-zinc-100 px-4 py-3">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {!finished && (
        <div className="border-t border-zinc-200 bg-white pt-4">
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-zinc-50 p-2 focus-within:border-zinc-900">
            {voiceSupported && (
              <VoiceButton listening={listening} supported={voiceSupported} onClick={toggleVoice} />
            )}
            <textarea
              rows={1}
              value={input + (interim ? " " + interim : "")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={listening ? "正在聆听…" : "输入你的回答，或按麦克风说话…"}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              发送
            </button>
          </div>
          <div className="mt-3 flex justify-between">
            <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900">
              退出
            </button>
            <span className="text-xs text-zinc-400">支持语音输入</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStage({
  roleName,
  mode,
  onReset,
  onCoach,
}: {
  roleName: string;
  mode: Mode;
  onReset: () => void;
  onCoach: () => void;
}) {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const s = mode === "day-in-life" ? 75 + Math.floor(Math.random() * 20) : 65 + Math.floor(Math.random() * 30);
    const t = mode === "day-in-life"
      ? computePersonalityTag(roleName, {
          execution: Math.floor(Math.random() * 5),
          strategy: Math.floor(Math.random() * 5),
          collaboration: Math.floor(Math.random() * 5),
          userFocus: Math.floor(Math.random() * 5),
        })
      : `${roleName}面试表现优异`;

    (async () => {
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      setScore(s);
      setTag(t);
      setFeedback("基于你的整体表现，你展现了良好的岗位潜质与学习能力。建议继续深入体验其他场景或预约 Coach 进行针对性辅导。");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [roleName, mode]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-zinc-900 [animation-delay:-0.3s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-zinc-900 [animation-delay:-0.15s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-zinc-900"></span>
          </div>
          <div className="text-base font-medium text-zinc-900">正在生成你的模拟画像…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 animate-[fadeIn_0.5s_ease-out]">
      <div className="w-full rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            模拟完成
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {roleName} 模拟结果
          </h1>
        </div>

        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-4 h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e4e4e7" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="#18181b" strokeWidth="10"
                strokeDasharray={`${(score / 100) * 326.7} 326.7`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-zinc-900">{score}</span>
              <span className="text-sm text-zinc-500">/ 100</span>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-zinc-50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">{tag}</h2>
          <p className="text-sm leading-relaxed text-zinc-600">{feedback}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onCoach}
            className="flex-1 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            前往 Coach 获取建议 →
          </button>
          <button
            onClick={onReset}
            className="flex-1 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            重新选择岗位
          </button>
        </div>
      </div>
    </main>
  );
}
