"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

type Dimension = "execution" | "strategy" | "collaboration" | "userFocus";

interface Choice {
  id: string;
  label: string;
  description: string;
  scores: Partial<Record<Dimension, number>>;
}

interface Task {
  id: number;
  title: string;
  scenario: string;
  context: string;
  time: string;
  choices: Choice[];
}

const tasks: Task[] = [
  {
    id: 1,
    title: "需求评审会议",
    scenario:
      "周一上午，你正在参加产品需求评审会。工程师反馈本季度资源有限，无法同时实现三个核心功能：A（用户期待已久的体验优化）、B（业务方强推的商业化功能）、C（技术团队建议的底层架构升级）。",
    context:
      "你是某 C 端产品经理，需在资源约束下做出取舍决策，并向团队解释你的优先级逻辑。",
    time: "09:30 · 会议室",
    choices: [
      {
        id: "1a",
        label: "优先 A：聚焦用户体验，兑现对用户的承诺",
        description: "选择用户价值为首要标准，说服业务方接受延后 B。",
        scores: { userFocus: 3, execution: 1 },
      },
      {
        id: "1b",
        label: "优先 B：商业化压力大，需要对营收负责",
        description: "以业务结果为导向，推动快速落地变现。",
        scores: { execution: 3, strategy: 1 },
      },
      {
        id: "1c",
        label: "优先 C：没有基建，后续功能都会受限",
        description: "从长远技术架构出发，说服团队接受短期功能延期。",
        scores: { strategy: 3, collaboration: 1 },
      },
    ],
  },
  {
    id: 2,
    title: "线上事故处理",
    scenario:
      "周二下午，监控告警发现核心支付流程出现 bug，影响约 5% 的用户。工程师定位需要 30 分钟，但客服已经收到大量用户投诉。",
    context:
      "你需要在紧急情况下协调多方资源，既要止损，也要维护用户信任。",
    time: "15:20 · 工位",
    choices: [
      {
        id: "2a",
        label: "立即发布公告，告知用户问题并致歉",
        description: "先稳住用户情绪，同步进展，再推动技术修复。",
        scores: { userFocus: 3, collaboration: 2 },
      },
      {
        id: "2b",
        label: "通知技术团队优先修复，暂不对外发声",
        description: "争分夺秒解决问题，等修复完成再统一说明。",
        scores: { execution: 3, strategy: 1 },
      },
      {
        id: "2c",
        label: "拉紧急会议，多部门同步制定应急预案",
        description: "组织产品、技术、客服、运营协同应对。",
        scores: { collaboration: 3, strategy: 2 },
      },
    ],
  },
  {
    id: 3,
    title: "跨团队协作冲突",
    scenario:
      "周三上午，设计团队与工程团队就新功能的交互方案产生分歧：设计认为复杂交互能提供更好的用户体验，但工程反馈实现成本高且容易出 bug。双方僵持不下，需要你来做决定。",
    context:
      "作为产品经理，你需要在设计体验与工程可行性之间找到平衡点。",
    time: "10:00 · 产品办公区",
    choices: [
      {
        id: "3a",
        label: "支持设计：用户体验至上，说服工程团队克服技术挑战",
        description: "坚持理想方案，协助工程团队拆解实现路径。",
        scores: { userFocus: 3, strategy: 1 },
      },
      {
        id: "3b",
        label: "支持工程：简化交互方案，优先保证上线节奏",
        description: "接受 MVP 方案，先上线收集数据再迭代。",
        scores: { execution: 3, userFocus: 1 },
      },
      {
        id: "3c",
        label: "双方各让一步：设计核心交互保留，边缘部分简化",
        description: "组织共创会，找到双方都能接受的折中方案。",
        scores: { collaboration: 3, userFocus: 1, execution: 1 },
      },
    ],
  },
  {
    id: 4,
    title: "季度产品规划汇报",
    scenario:
      "周四下午，你需要向 CEO 和高管团队汇报下季度的产品规划。时间紧张，只有 15 分钟。你需要决定汇报的重点方向。",
    context:
      "这是你首次向高层汇报，需要在有限时间内展现你的产品思维和战略视野。",
    time: "16:00 · 大会议室",
    choices: [
      {
        id: "4a",
        label: "聚焦数据与成果：用数据证明过去的成绩，展示增长潜力",
        description: "以业务结果为核心，展示 ROI 和增长曲线。",
        scores: { execution: 2, strategy: 2 },
      },
      {
        id: "4b",
        label: "聚焦用户洞察：用用户故事和调研数据传递产品价值",
        description: "以用户为中心，讲述用户痛点和产品如何解决。",
        scores: { userFocus: 3, collaboration: 1 },
      },
      {
        id: "4c",
        label: "聚焦战略布局：从行业趋势切入，阐述产品的长期壁垒",
        description: "展示宏观视野，讲述产品如何卡位未来赛道。",
        scores: { strategy: 3, collaboration: 1 },
      },
    ],
  },
];

const dimensionLabels: Record<Dimension, { short: string; full: string }> = {
  execution: { short: "执行", full: "落地执行" },
  strategy: { short: "策略", full: "策略思维" },
  collaboration: { short: "协作", full: "协作沟通" },
  userFocus: { short: "用户", full: "用户导向" },
};

function computePersonalityTag(scores: Record<Dimension, number>): {
  tag: string;
  top: Dimension;
  sorted: Dimension[];
} {
  const sorted = (Object.keys(scores) as Dimension[]).sort(
    (a, b) => scores[b] - scores[a]
  );
  const top = sorted[0];
  const second = sorted[1];

  const tagMap: Record<string, string> = {
    execution: "你是偏向落地执行型产品经理",
    strategy: "你是偏向策略规划型产品经理",
    collaboration: "你是偏向协作沟通型产品经理",
    userFocus: "你是偏向用户洞察型产品经理",
  };

  let tag = tagMap[top];
  if (scores[second] >= scores[top] - 1) {
    const comboMap: Record<string, string> = {
      "execution-userFocus": "你是兼顾用户与执行的实干型产品经理",
      "execution-strategy": "你是兼具战略视野的落地型产品经理",
      "execution-collaboration": "你是善于协作推动的执行型产品经理",
      "strategy-userFocus": "你是兼具用户洞察的策略型产品经理",
      "strategy-collaboration": "你是善于整合资源的策略型产品经理",
      "userFocus-collaboration": "你是善于共情沟通的用户型产品经理",
    };
    const key = [top, second].sort().join("-");
    if (comboMap[key]) {
      tag = comboMap[key];
    }
  }

  return { tag, top, sorted };
}

function computeStrengths(
  scores: Record<Dimension, number>,
  sorted: Dimension[]
): string[] {
  const top = sorted.slice(0, 2);
  const strengthMap: Record<Dimension, string> = {
    execution: "快速将想法转化为可落地的行动方案",
    strategy: "从全局视角思考产品方向和长期价值",
    collaboration: "跨团队沟通协调，推动共识达成",
    userFocus: "深入理解用户需求，用同理心驱动产品决策",
  };
  return top.map((d) => strengthMap[d]);
}

function computeScore(scores: Record<Dimension, number>): number {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const max = tasks.reduce((acc, t) => {
    const taskMax = Math.max(...t.choices.map((c) =>
      Object.values(c.scores).reduce((a, b) => a + b, 0)
    ));
    return acc + taskMax;
  }, 0);
  return Math.round((total / max) * 100);
}

export default function SimulatorPage() {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    execution: 0,
    strategy: 0,
    collaboration: 0,
    userFocus: 0,
  });
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);

  const task = tasks[currentTask];
  const progress = ((currentTask + 1) / tasks.length) * 100;

  const handleSelect = (choice: Choice) => {
    if (selectedChoice) return;
    setSelectedChoice(choice);
    const newScores = { ...scores };
    for (const [dim, val] of Object.entries(choice.scores)) {
      newScores[dim as Dimension] += val || 0;
    }
    setScores(newScores);
  };

  const handleNext = () => {
    if (currentTask === tasks.length - 1) {
      setIsFinished(true);
    } else {
      setCurrentTask((t) => t + 1);
      setSelectedChoice(null);
    }
  };

  const handleRestart = () => {
    setCurrentTask(0);
    setScores({ execution: 0, strategy: 0, collaboration: 0, userFocus: 0 });
    setSelectedChoice(null);
    setIsFinished(false);
  };

  if (isFinished) {
    const { tag, sorted } = computePersonalityTag(scores);
    const finalScore = computeScore(scores);
    const strengths = computeStrengths(scores, sorted);
    const topDimension = sorted[0];

    return (
      <div className="flex min-h-screen flex-col bg-zinc-50">
        <NavBar />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16">
          <div className="w-full rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
            <div className="mb-8 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                模拟完成
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                你的产品经理画像
              </h1>
            </div>

            <div className="mb-8 flex flex-col items-center">
              <div className="relative mb-4 h-32 w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#e4e4e7"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="10"
                    strokeDasharray={`${(finalScore / 100) * 326.7} 326.7`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-zinc-900">
                    {finalScore}
                  </span>
                  <span className="text-sm text-zinc-500">/ 100</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {sorted.map((dim) => (
                  <span
                    key={dim}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      dim === topDimension
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {dimensionLabels[dim].full} · {scores[dim]}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-8 rounded-2xl bg-zinc-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-zinc-900">
                {tag}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600">
                基于你在四个典型工作场景中的决策选择，我们识别出你作为产品经理的核心特征。
              </p>
            </div>

            <div className="mb-10">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                核心优势
              </h3>
              <div className="space-y-3">
                {strengths.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-700">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/coach")}
                className="flex-1 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                前往 Coach 获取针对性建议 →
              </button>
              <button
                onClick={handleRestart}
                className="flex-1 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                重新开始模拟
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const personalityTag = (() => {
    const { tag } = computePersonalityTag(scores);
    return tag;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <NavBar />

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
              产品经理 · 一日模拟
            </span>
            <span className="text-sm text-zinc-500">{task.time}</span>
          </div>
          <div className="text-sm text-zinc-500">
            任务 <span className="font-semibold text-zinc-900">{currentTask + 1}</span>
            <span className="text-zinc-400"> / {tasks.length}</span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-5">
          <aside className="lg:col-span-2">
            <div className="sticky top-20 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                {tasks.map((t, i) => (
                  <div key={t.id} className="flex flex-1 items-center gap-1">
                    <div
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        i < currentTask
                          ? "bg-emerald-500"
                          : i === currentTask
                          ? "bg-zinc-900"
                          : "bg-zinc-200"
                      }`}
                    />
                  </div>
                ))}
              </div>

              <h2 className="mb-1 text-lg font-semibold text-zinc-900">
                {task.title}
              </h2>
              <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
                <span>任务 {currentTask + 1} of {tasks.length}</span>
              </div>

              <p className="mb-6 text-sm leading-relaxed text-zinc-600">
                {task.scenario}
              </p>

              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  背景
                </p>
                <p className="text-sm leading-relaxed text-zinc-700">
                  {task.context}
                </p>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="mb-6 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 p-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  场景
                </p>
                <p className="text-base leading-relaxed text-zinc-800">
                  {task.scenario}
                </p>
              </div>

              <p className="mb-4 text-sm font-medium text-zinc-500">
                请选择你的应对方式：
              </p>

              <div className="space-y-3">
                {task.choices.map((choice) => {
                  const isSelected = selectedChoice?.id === choice.id;
                  const isDisabled = !!selectedChoice && !isSelected;

                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSelect(choice)}
                      onMouseEnter={() => setHoveredChoice(choice.id)}
                      onMouseLeave={() => setHoveredChoice(null)}
                      disabled={!!selectedChoice}
                      className={`group w-full rounded-2xl border p-5 text-left transition-all ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : isDisabled
                          ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                          : hoveredChoice === choice.id
                          ? "border-zinc-400 bg-white shadow-md"
                          : "border-zinc-200 bg-white hover:border-zinc-400"
                      }`}
                    >
                      <div className="mb-2 flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected
                              ? "bg-white text-zinc-900"
                              : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                          }`}
                        >
                          {choice.id}
                        </span>
                        <div className="flex-1">
                          <p
                            className={`text-sm font-semibold ${
                              isSelected ? "text-white" : "text-zinc-900"
                            }`}
                          >
                            {choice.label}
                          </p>
                          <p
                            className={`mt-1 text-xs leading-relaxed ${
                              isSelected ? "text-zinc-300" : "text-zinc-500"
                            }`}
                          >
                            {choice.description}
                          </p>
                        </div>
                        {isSelected && (
                          <svg
                            className="h-5 w-5 shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedChoice && (
                <div className="mt-6 rounded-xl bg-emerald-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    选择反馈
                  </p>
                  <p className="text-sm text-emerald-900">
                    你选择了「{selectedChoice.label}」。这体现了你在
                    <span className="font-semibold">
                      {" "}
                      {Object.entries(selectedChoice.scores)
                        .map(
                          ([k, v]) =>
                            dimensionLabels[k as Dimension].full +
                            (v && v > 1 ? ` +${v}` : "")
                        )
                        .join("、")}{" "}
                    </span>
                    方面的倾向。
                  </p>
                </div>
              )}

              {selectedChoice && (
                <button
                  onClick={handleNext}
                  className="mt-6 w-full rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  {currentTask === tasks.length - 1
                    ? "查看你的产品经理画像 →"
                    : "继续下一个场景 →"}
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  当前得分
                </p>
                <p className="text-2xl font-bold text-zinc-900">
                  {Object.values(scores).reduce((a, b) => a + b, 0)}
                  <span className="text-sm font-normal text-zinc-400">
                    {" "}
                    分
                  </span>
                </p>
              </div>
              {currentTask > 0 && (
                <div className="h-10 w-px bg-zinc-200" />
              )}
              {currentTask > 0 && (
                <div className="hidden sm:block">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    画像雏形
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {personalityTag}
                  </p>
                </div>
              )}
            </div>

            <div className="hidden items-center gap-2 md:flex">
              {(Object.keys(dimensionLabels) as Dimension[]).map((dim) => (
                <div key={dim} className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">
                    {dimensionLabels[dim].short}
                  </span>
                  <div className="h-2 w-12 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full bg-zinc-900 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          (scores[dim] / Math.max(currentTask * 4, 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-4 text-right text-xs font-semibold text-zinc-700">
                    {scores[dim]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}