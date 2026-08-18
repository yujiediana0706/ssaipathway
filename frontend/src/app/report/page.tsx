"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { storeReport, syncReportToSupabase } from "@/lib/reportStore";
import { getStoredUser } from "@/lib/userStore";

type Priority = "high" | "medium" | "low";
type Feasibility = "high" | "medium" | "low";

interface SkillItem {
  name: string;
  description: string;
  priority: Priority;
}

interface PlanStep {
  phase: string;
  duration: string;
  title: string;
  details: string[];
}

interface Pathway {
  title: string;
  description: string;
  tags: string[];
}

interface ReportData {
  matchScore: number;
  currentAssessment: string;
  feasibility: Feasibility;
  feasibilityExplanation: string;
  skillsToAcquire: SkillItem[];
  actionPlan: PlanStep[];
  possiblePaths: Pathway[];
}

interface UserProfileInput {
  type: string;
  name: string;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  targetRole?: string;
}

function parseParams(searchParams: URLSearchParams): UserProfileInput {
  return {
    type: searchParams.get("type") || "A",
    name: searchParams.get("name") || "",
    currentRole: searchParams.get("role") || "",
    years: searchParams.get("years") || "",
    skills: searchParams.get("skills") || "",
    interests: searchParams.get("interests") || "",
    targetRole: searchParams.get("target") || undefined,
  };
}

function buildFallbackReport(profile: UserProfileInput): ReportData {
  const role = profile.currentRole || "用户";
  const target = profile.targetRole || "AI 产品方向";
  const skills = profile.skills || "通用能力";
  const interests = profile.interests || "未明确";

  const matchScore = profile.type === "B" ? 72 : 65;

  const currentAssessment = `你目前从事 ${role} 岗位${
    profile.years ? `，拥有 ${profile.years} 经验` : ""
  }。核心技能包括：${skills}。兴趣方向聚焦在 ${interests}。${
    profile.type === "B"
      ? `目标转型方向是 ${target}，你的背景与该方向存在一定的可迁移性，但仍有明显的能力缺口需要补齐。`
      : `尚未锁定明确目标，但你的技能组合与兴趣方向指向数个潜力赛道，需要进一步匹配与探索。`
  }`;

  const feasibility: Feasibility = matchScore >= 75 ? "high" : matchScore >= 55 ? "medium" : "low";

  return {
    matchScore,
    currentAssessment,
    feasibility,
    feasibilityExplanation:
      feasibility === "high"
        ? "你的现有能力与目标岗位高度契合，预计通过 3-4 个月的集中学习与项目实践即可完成转型。"
        : feasibility === "medium"
        ? "你的软技能与目标方向有较好匹配，主要障碍在于专业技能的系统性积累。预计 4-6 个月可成功转型。"
        : "当前能力与目标岗位差距较大，建议先进行更深入的职业探索，或选择更接近现有能力的过渡方向。",
    skillsToAcquire: [
      {
        name: "Prompt Engineering",
        description: "掌握 LLM 对话设计与输出控制技巧",
        priority: "high",
      },
      {
        name: "AI 产品架构",
        description: "理解 RAG、Agent、MCP 等核心范式",
        priority: "high",
      },
      {
        name: "Python 数据分析",
        description: "使用 Pandas / NumPy 进行数据清洗与分析",
        priority: "medium",
      },
      {
        name: "SQL 与数据查询",
        description: "编写复杂查询支持业务决策",
        priority: "medium",
      },
      {
        name: "前端原型设计",
        description: "使用 React / Next.js 快速搭建 Demo",
        priority: "low",
      },
    ],
    actionPlan: [
      {
        phase: "第一阶段",
        duration: "第 1-6 周",
        title: "AI 基础与 Prompt 入门",
        details: [
          "完成 Prompt Engineering 系统课程",
          "每周完成 2 个 Prompt 设计实战案例",
          "搭建个人 AI 知识卡片库",
        ],
      },
      {
        phase: "第二阶段",
        duration: "第 7-14 周",
        title: "数据能力构建",
        details: [
          "系统学习 Python 基础与 Pandas",
          "完成 3 个数据分析项目",
          "每周固定 10 小时编码练习",
        ],
      },
      {
        phase: "第三阶段",
        duration: "第 15-22 周",
        title: `${target} 实践与作品集`,
        details: [
          "独立完成 1 个 AI Agent / RAG 项目",
          "输出 2 篇深度文章",
          "参与 1 次 Hackathon 或开源贡献",
        ],
      },
      {
        phase: "第四阶段",
        duration: "第 23-26 周",
        title: "求职冲刺与面试准备",
        details: [
          "打磨简历与作品集，突出转型亮点",
          "进行 5 次以上模拟面试",
          `定向投递 ${target} 相关岗位`,
        ],
      },
    ],
    possiblePaths:
      profile.type === "B"
        ? [
            {
              title: target,
              description: "你的首选目标方向，结合现有经验可直接切入，市场需求旺盛。",
              tags: ["首选", "目标明确", "可迁移"],
            },
            {
              title: `${target}（解决方案方向）`,
              description: "面向企业客户，负责场景设计与方案交付，适合沟通能力强的你。",
              tags: ["方案设计", "客户沟通", "行业理解"],
            },
            {
              title: "AI 创业 / 独立开发者",
              description: "基于 AI 技术打造独立产品，自由度高，对技术深度要求更高。",
              tags: ["全栈能力", "商业嗅觉", "风险承受"],
            },
          ]
        : [
            {
              title: "AI 产品经理",
              description: "聚焦 AI 产品规划与落地，市场需求旺盛，入门门槛适中。",
              tags: ["产品思维", "AI 素养", "用户洞察"],
            },
            {
              title: "数据分析师",
              description: "结合你的数据敏感度，向数据驱动决策方向转型。",
              tags: ["数据敏感", "逻辑分析", "业务理解"],
            },
            {
              title: "AI 解决方案顾问",
              description: "面向企业客户设计 AI 场景，发挥你的沟通与理解能力。",
              tags: ["方案设计", "客户沟通", "行业理解"],
            },
          ],
  };
}

async function fetchReport(profile: UserProfileInput): Promise<ReportData> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userProfile: {
        currentRole: profile.currentRole || "未知",
        years: profile.years,
        skills: profile.skills ? profile.skills.split(/[、,，\s]+/).filter(Boolean) : [],
        interests: profile.interests,
        targetRole: profile.targetRole,
      },
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    matchScore: data.matchScore ?? 70,
    currentAssessment: data.currentAssessment ?? "",
    feasibility: data.feasibility ?? "medium",
    feasibilityExplanation: data.feasibilityExplanation ?? "",
    skillsToAcquire: data.skillsToAcquire ?? [],
    actionPlan: data.actionPlan ?? [],
    possiblePaths: data.possiblePaths ?? [],
  };
}

const feasibilityConfig: Record<
  Feasibility,
  { label: string; color: string; bg: string; border: string }
> = {
  high: { label: "高可行性", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  medium: { label: "中等可行性", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  low: { label: "低可行性", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const priorityConfig: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: { label: "高优先级", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  medium: { label: "中优先级", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  low: { label: "低优先级", color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#52525b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight text-brand">
          {score}
          <span className="text-xl font-normal text-muted-foreground">/100</span>
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf9] px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"></span>
        </div>
        <div className="text-base font-medium text-brand">正在生成你的转型诊断报告…</div>
        <div className="text-sm text-muted-foreground">整合你的背景、技能与偏好，构造个性化转型路径</div>
      </div>
    </div>
  );
}

function ReportContent({ profile }: { profile: UserProfileInput }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReport(profile)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setReport(buildFallbackReport(profile));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (report) {
      storeReport({
        matchScore: report.matchScore,
        skillsToAcquire: report.skillsToAcquire,
        actionPlan: report.actionPlan,
        savedAt: Date.now(),
      });

      // Sync to Supabase
      const user = getStoredUser();
      if (user?.id) {
        syncReportToSupabase({
          matchScore: report.matchScore,
          skillsToAcquire: report.skillsToAcquire,
          actionPlan: report.actionPlan,
          savedAt: Date.now(),
        }, user.id).then((id) => {
          if (id) console.info("[Pathway] Report synced to Supabase:", id);
        });
      }
    }
  }, [report]);

  if (!report) return <LoadingState />;

  const feasibility = feasibilityConfig[report.feasibility];

  return (
    <div className="min-h-screen bg-[#fafaf9] pb-24">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
        <header className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">诊断报告</p>
            {error && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                离线模式
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-brand">
            {profile.name ? `${profile.name}的转型诊断报告` : "转型诊断报告"}
          </h1>
          <p className="text-sm text-muted-foreground">
            报告生成时间：{new Date().toLocaleDateString("zh-CN")}
          </p>
        </header>

        <section className="card mb-6 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <ScoreRing score={report.matchScore} />
          <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
              {report.matchScore >= 75 ? "匹配度优秀" : report.matchScore >= 60 ? "匹配度良好" : "匹配度待提升"}
            </span>
            <h2 className="text-xl font-semibold text-brand">
              与 {profile.targetRole || "AI 产品方向"} 的综合匹配度
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              基于你的背景、技能画像与目标岗位需求综合计算，该分数反映了你目前向目标方向转型的基础扎实程度。
            </p>
          </div>
        </section>

        <section className="card mb-6">
          <h2 className="mb-3 text-base font-semibold text-brand">当前状态评估</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.currentAssessment}</p>
        </section>

        <section className="card mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand">转型可行性分析</h2>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${feasibility.bg} ${feasibility.color} ${feasibility.border}`}>
              {feasibility.label}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.feasibilityExplanation}</p>
        </section>

        <section className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-brand">需要补充的核心技能</h2>
          <ul className="flex flex-col divide-y divide-border">
            {report.skillsToAcquire.map((skill) => {
              const cfg = priorityConfig[skill.priority];
              return (
                <li key={skill.name} className="flex items-start justify-between gap-4 py-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-brand">{skill.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{skill.description}</p>
                  </div>
                  <span className={`shrink-0 self-center inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card mb-6">
          <h2 className="mb-6 text-base font-semibold text-brand">分阶段行动计划</h2>
          <ol className="relative ml-2 flex flex-col gap-6 border-l-2 border-dashed border-border pl-6">
            {report.actionPlan.map((step, idx) => (
              <li key={step.phase} className="relative">
                <span className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white ring-4 ring-white">
                  {idx + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="text-sm font-medium text-brand">{step.phase} · {step.title}</p>
                  <span className="text-xs text-muted-foreground">{step.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {step.details.map((detail) => (
                    <li key={detail} className="text-sm leading-relaxed text-muted-foreground">· {detail}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-brand">适合你的转型路径</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {report.possiblePaths.map((pathway) => (
              <div key={pathway.title} className="card flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-md">
                <h3 className="text-base font-semibold text-brand">{pathway.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{pathway.description}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  {pathway.tags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sticky bottom-0 -mx-6 mt-4 border-t border-border bg-[#fafaf9]/90 px-6 py-5 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/coach" className="btn-secondary">预约 Coach 咨询</Link>
            <Link href="/simulator" className="btn-primary">进入 Simulator 模拟</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReportInner />
    </Suspense>
  );
}

function ReportInner() {
  const searchParams = useSearchParams();
  const profile = parseParams(searchParams);
  return <ReportContent profile={profile} />;
}
