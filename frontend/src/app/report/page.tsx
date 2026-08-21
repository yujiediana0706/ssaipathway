"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { storeReport, syncReportToSupabase } from "@/lib/reportStore";
import { getStoredUser } from "@/lib/userStore";
import {
  determineArchetype,
  type PersonalityArchetype,
  getArchetypeCartoonUrl,
  ALL_ARCHETYPES,
} from "@/lib/archetypes";

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
  matchScore?: number;
}

interface RecommendedCompany {
  name: string;
  position: string;
  reason: string;
}

interface ReportData {
  matchScore?: number;
  aiReplaceRisk?: number;
  aiReplaceAnalysis?: string;
  riskPoints?: string[];
  currentAssessment: string;
  feasibility: Feasibility;
  feasibilityExplanation: string;
  skillsToAcquire: SkillItem[];
  actionPlan: PlanStep[];
  possiblePaths: Pathway[];
  resumeSummary?: string;
  choiceAnalysis?: string;
  recommendedCompanies?: RecommendedCompany[];
}

interface UserProfileInput {
  type: string;
  name: string;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  targetRole?: string;
  personality?: string;
  coachNote?: string;
  archetype?: string;
  resume?: string;
  _exploreDetail?: {
    answers?: Record<string, string>;
    archetypeScores?: Record<string, number>;
  };
}

function parseParams(searchParams: URLSearchParams): UserProfileInput {
  // Try to enrich from localStorage user (has exploreDetail, resume paths etc.)
  let exploreDetail: UserProfileInput["_exploreDetail"] = undefined;
  let storedResumePath: string | undefined = undefined;
  try {
    const u = getStoredUser();
    if (u) {
      const anyU = u as any;
      if (anyU.exploreDetail) exploreDetail = anyU.exploreDetail;
      if (anyU.resumeStoragePath) storedResumePath = anyU.resumeStoragePath;
    }
  } catch {
    /* ignore */
  }

  return {
    type: searchParams.get("type") || "A",
    name: searchParams.get("name") || "",
    currentRole: searchParams.get("role") || "",
    years: searchParams.get("years") || "",
    skills: searchParams.get("skills") || "",
    interests: searchParams.get("interests") || "",
    targetRole: searchParams.get("target") || undefined,
    personality: searchParams.get("personality") || undefined,
    coachNote: searchParams.get("note") || undefined,
    archetype: searchParams.get("archetype") || undefined,
    resume: searchParams.get("resume") || storedResumePath || undefined,
    _exploreDetail: exploreDetail,
  };
}

function buildFallbackReport(profile: UserProfileInput): ReportData {
  const role = profile.currentRole || "用户";
  const target = profile.targetRole || "AI 产品方向";
  const skills = profile.skills || "通用能力";
  const interests = profile.interests || "未明确";
  const isExploration = profile.type !== "B" || !profile.targetRole;

  const matchScore = isExploration ? undefined : (profile.type === "B" ? 72 : 65);

  const currentAssessment = `你目前从事 ${role} 岗位${
    profile.years ? `，拥有 ${profile.years} 经验` : ""
  }。核心技能包括：${skills}。兴趣方向聚焦在 ${interests}。${
    isExploration
      ? `尚未锁定明确目标，技能组合与兴趣方向指向数个潜力赛道，但直接转型的难度较高，需要通过实习或项目积累过渡。`
      : `目标转型方向是 ${target}，背景与该方向存在一定可迁移性，但硬性技能缺口明显，建议先从助理或运营岗切入。`
  }`;

  const feasibility: Feasibility = matchScore === undefined ? "low" : matchScore >= 75 ? "medium" : matchScore >= 55 ? "low" : "low";

  const exploreDetail = profile._exploreDetail;
  const choiceAnalysis = exploreDetail?.answers
    ? `从你的选择来看，你在团队中倾向于${exploreDetail.answers.q5_team || "团队协作"}的风格，` +
      `面对压力时${exploreDetail.answers.q2_pressure || "有自己的节奏"}。` +
      `结合你的性格画像${profile.archetype || ""}和简历经历，这些特质对推荐方向有一定参考价值，但不足以直接支撑转型。`
    : undefined;

  const resumeSummary = profile.resume
    ? `从你的简历来看，${role}背景带来了一定的可迁移能力（如沟通协调、需求理解），但缺乏目标方向所需的核心硬技能。建议先通过3-6个月实习或项目积累补齐作品集再投递正式岗位。`
    : undefined;

  return {
    matchScore,
    aiReplaceRisk: 55,
    aiReplaceAnalysis: `在AI时代，${role}岗位的部分重复性工作正在被自动化工具替代。需要客观认识：你的核心能力中，沟通协调和复杂判断是AI难以取代的，但重复性执行工作正在快速被压缩。建议主动拥抱AI工具提升效率，同时向需要"人情味"和"复杂判断"的领域迁移。`,
    riskPoints: [
      `${profile.currentRole || "当前岗位"}直接转向${target}成功率较低，通常需要先从助理或运营岗切入`,
      "转型初期薪资可能下降30-50%，需要6-12个月的收入过渡期",
      "行业人脉需要从零积累，建议通过实习或社群活动快速建立",
    ],
    currentAssessment,
    feasibility,
    feasibilityExplanation:
      feasibility === "high"
        ? "你的现有能力与目标岗位有一定契合度，但仍需3-6个月的项目积累才能正式投递。建议先做实习或副业项目验证。"
        : feasibility === "medium"
        ? "你的软技能与目标方向有部分匹配，但硬性技能缺口明显。直接转型难度较大，建议先从助理岗或运营岗切入，6-12个月后内部转岗。"
        : "当前能力与目标岗位差距较大，直接转型不现实。建议先选择更接近现有能力的过渡方向（如运营/助理），或通过6个月以上的实习+项目积累再尝试转型。",
    resumeSummary,
    choiceAnalysis,
    skillsToAcquire: [
      { name: "Prompt Engineering", description: "掌握 LLM 对话设计与输出控制技巧", priority: "high" },
      { name: "AI 产品架构", description: "理解 RAG、Agent、MCP 等核心范式", priority: "high" },
      { name: "Python 数据分析", description: "使用 Pandas / NumPy 进行数据清洗与分析", priority: "medium" },
      { name: "SQL 与数据查询", description: "编写复杂查询支持业务决策", priority: "medium" },
      { name: "前端原型设计", description: "使用 React / Next.js 快速搭建 Demo", priority: "low" },
    ],
    actionPlan: [
      {
        phase: "第一阶段", duration: "第 1-8 周", title: "基础积累 + 副业项目验证",
        details: ["系统学习 Prompt Engineering 和 AI 产品基础", "用 vibe coding 搭建 2-3 个产品 demo 积累作品集", "每周固定 10 小时学习时间"],
      },
      {
        phase: "第二阶段", duration: "第 9-16 周", title: "实习/副业切入目标领域",
        details: ["寻找 3-6 个月的产品实习或副业项目", "在真实业务中验证可迁移能力", "开始积累行业人脉"],
      },
      {
        phase: "第三阶段", duration: "第 17-24 周", title: "从助理/运营岗切入再转正",
        details: ["投递目标方向的助理或运营岗位（非直接投递正式岗）", "在岗期间持续积累作品和案例", "6-12个月后申请内部转岗"],
      },
      {
        phase: "第四阶段", duration: "第 25 周后", title: "正式转型与持续提升",
        details: ["具备足够作品和经验后投递正式岗", "持续学习 AI 工具提升效率", "定期复盘转型进展"],
      },
    ],
    possiblePaths: isExploration
      ? [
          { title: "AI 产品经理", description: "聚焦 AI 产品规划与落地，市场需求旺盛，入门门槛适中。", tags: ["产品思维", "AI 素养", "用户洞察"], matchScore: 78 },
          { title: "数据分析师", description: "结合你的数据敏感度，向数据驱动决策方向转型。", tags: ["数据敏感", "逻辑分析", "业务理解"], matchScore: 72 },
          { title: "AI 解决方案顾问", description: "面向企业客户设计 AI 场景，发挥你的沟通与理解能力。", tags: ["方案设计", "客户沟通", "行业理解"], matchScore: 65 },
        ]
      : [
          { title: target, description: "你的首选目标方向，结合现有经验可直接切入，市场需求旺盛。", tags: ["首选", "目标明确", "可迁移"], matchScore: matchScore || 72 },
          { title: `${target}（解决方案方向）`, description: "面向企业客户，负责场景设计与方案交付。", tags: ["方案设计", "客户沟通"], matchScore: 68 },
          { title: "AI 创业 / 独立开发者", description: "基于 AI 技术打造独立产品，自由度高。", tags: ["全栈能力", "商业嗅觉"], matchScore: 55 },
        ],
  };
}

function normalizeFeasibility(raw: unknown): Feasibility {
  if (typeof raw !== "string") return "medium";
  const lower = raw.toLowerCase().trim();
  if (lower === "high" || lower.includes("高") || lower.includes("优秀")) return "high";
  if (lower === "low" || lower.includes("低")) return "low";
  if (lower === "medium" || lower.includes("中")) return "medium";
  return "medium";
}

function normalizeSkills(raw: unknown): SkillItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => ({
    name: s.name ?? "未命名技能",
    description: s.description ?? "",
    priority: (s.priority as Priority) ?? "medium",
  }));
}

function normalizeActionPlan(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const details: string[] = p.details ?? p.steps ?? [];
    return {
      phase: p.phase ?? "阶段",
      duration: p.duration ?? "",
      title: p.title ?? p.phase ?? "",
      details: Array.isArray(details) ? details.map((d: unknown) => String(d)) : [],
    };
  });
}

function normalizePaths(raw: unknown): Pathway[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    title: p.title ?? "未命名路径",
    description: p.description ?? "",
    tags: Array.isArray(p.tags) ? p.tags.map((t: unknown) => String(t)) : [],
    matchScore: typeof p.matchScore === "number" ? p.matchScore : undefined,
  }));
}

async function fetchReport(profile: UserProfileInput, focusDirection?: string): Promise<ReportData> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userProfile: {
        name: profile.name || "匿名用户",
        currentRole: profile.currentRole || "未知",
        experience: profile.years || "未提供",
        skills: profile.skills ? profile.skills.split(/[、,，\s]+/).filter(Boolean) : ["通用能力"],
        interests: profile.interests || "",
        targetRole: profile.targetRole,
        personality: profile.personality || "",
        coachNote: profile.coachNote || "",
        archetype: profile.archetype || "",
        resumeStoragePath: profile.resume || "",
        exploreAnswers: profile._exploreDetail?.answers,
        archetypeScores: profile._exploreDetail?.archetypeScores,
        focusDirection: focusDirection || undefined,
      },
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    matchScore: typeof data.matchScore === "number" ? data.matchScore : undefined,
    aiReplaceRisk: typeof data.aiReplaceRisk === "number" ? data.aiReplaceRisk : undefined,
    aiReplaceAnalysis: data.aiReplaceAnalysis ?? undefined,
    riskPoints: Array.isArray(data.riskPoints) ? data.riskPoints : undefined,
    currentAssessment: data.currentAssessment ?? "",
    feasibility: normalizeFeasibility(data.feasibility),
    feasibilityExplanation: data.feasibilityExplanation ?? "",
    skillsToAcquire: normalizeSkills(data.skillsToAcquire),
    actionPlan: normalizeActionPlan(data.actionPlan),
    possiblePaths: normalizePaths(data.possiblePaths),
    resumeSummary: data.resumeSummary ?? undefined,
    choiceAnalysis: data.choiceAnalysis ?? undefined,
    recommendedCompanies: Array.isArray(data.recommendedCompanies) ? data.recommendedCompanies : undefined,
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
  const [focusDirection, setFocusDirection] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    fetchReport(profile, focusDirection)
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
  }, [focusDirection]);

  const switchDirection = useCallback((dir: string) => {
    setFocusDirection(dir);
    // 滚动到顶部，让用户看到新的主推方向
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (report) {
      const savedReportData = {
        matchScore: report.matchScore,
        skillsToAcquire: report.skillsToAcquire,
        actionPlan: report.actionPlan,
        savedAt: Date.now(),
      };
      storeReport(savedReportData);

      // 保存完整报告到 localStorage 供 coach 页面使用
      localStorage.setItem("pathway:full-report", JSON.stringify(report));
      if (report.possiblePaths[0]?.title) {
        localStorage.setItem("pathway:primary-path", report.possiblePaths[0].title);
      }

      // Sync to Supabase
      const user = getStoredUser();
      if (user?.id) {
        syncReportToSupabase(savedReportData, user.id).then((id) => {
          if (id) console.info("[Pathway] Report synced to Supabase:", id);
        });
      }
    }
  }, [report]);

  if (!report) {
    return (
      <div className="min-h-screen bg-[#fafaf9] pb-24">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
          <header className="mb-8 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">诊断报告</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-brand">
              {profile.name ? `${profile.name}的转型诊断报告` : "转型诊断报告"}
            </h1>
          </header>
          {profile.personality && (
            <PersonalityCard
              archetype={determineArchetype(profile.personality)}
              personality={profile.personality}
              exploreDetail={profile._exploreDetail}
            />
          )}
          <LoadingState />
        </div>
      </div>
    );
  }

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

        {profile.personality && (
          <PersonalityCard
            archetype={determineArchetype(profile.personality)}
            personality={profile.personality}
            exploreDetail={profile._exploreDetail}
          />
        )}

        {/* AI 替代风险 */}
        {report.aiReplaceRisk !== undefined && (
          <section className="card mb-6 border-l-4 border-l-amber-500">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-brand">
                <span className="text-base">🤖</span> AI 替代风险指数
              </h2>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${
                      report.aiReplaceRisk >= 70 ? "bg-red-500" : report.aiReplaceRisk >= 40 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${report.aiReplaceRisk}%` }}
                  />
                </div>
                <span className={`text-sm font-bold ${
                  report.aiReplaceRisk >= 70 ? "text-red-600" : report.aiReplaceRisk >= 40 ? "text-amber-600" : "text-emerald-600"
                }`}>
                  {report.aiReplaceRisk}/100
                </span>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                report.aiReplaceRisk >= 70 ? "bg-red-50 text-red-700" : report.aiReplaceRisk >= 40 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
              }`}>
                {report.aiReplaceRisk >= 70 ? "高风险：当前岗位受AI冲击较大" : report.aiReplaceRisk >= 40 ? "中等风险：部分工作将被AI改变" : "低风险：AI难以替代核心能力"}
              </span>
            </div>
            {report.aiReplaceAnalysis && (
              <p className="text-sm leading-relaxed text-muted-foreground">{report.aiReplaceAnalysis}</p>
            )}
          </section>
        )}

        {/* 简历摘要 */}
        {report.resumeSummary && (
          <section className="card mb-6 border-l-4 border-l-tech">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand">
              <span className="text-base">📄</span> 简历分析
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.resumeSummary}</p>
          </section>
        )}

        {/* 选择-结论关联分析 */}
        {report.choiceAnalysis && (
          <section className="card mb-6 border-l-4 border-l-brand">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand">
              <span className="text-base">🔗</span> 小北的分析逻辑
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.choiceAnalysis}</p>
            {profile._exploreDetail?.answers && (
              <p className="mt-2 text-xs text-muted-foreground">
                基于你的 8 题选择 + 简历内容 + 性格画像综合分析
              </p>
            )}
          </section>
        )}

        {/* 模式感知：Type A（探索）→ 主推方向在前；Type B（定向）→ 匹配度在前 */}
        {profile.type === "B" && report.matchScore !== undefined ? (
          <section className="card mb-6 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <ScoreRing score={report.matchScore} />
            <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
                {report.matchScore >= 75 ? "匹配度优秀" : report.matchScore >= 60 ? "匹配度良好" : "匹配度待提升"}
              </span>
              <h2 className="text-xl font-semibold text-brand">
                与 {profile.targetRole || "目标岗位"} 的综合匹配度
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                基于你的背景、技能画像、8 题诊断选择与简历内容综合计算，该分数反映了你目前向目标方向转型的基础扎实程度。
              </p>
            </div>
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-base font-semibold text-brand">主推转型方向</h2>
              <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] text-muted-foreground">
                探索模式
              </span>
            </div>

            {/* 主推方向大卡片 */}
            {report.possiblePaths.length > 0 && (
              <div className="card relative mb-4 overflow-hidden border-2 border-brand bg-gradient-to-br from-brand-light to-white">
                <span className="absolute right-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[10px] font-medium text-white">
                  最佳推荐
                </span>
                <div className="flex items-start justify-between gap-3 pr-20">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-brand">{report.possiblePaths[0].title}</h3>
                    {report.possiblePaths[0].matchScore !== undefined && (
                      <p className="mt-1 text-sm text-brand">
                        匹配度 <span className="text-lg font-bold">{report.possiblePaths[0].matchScore}</span>/100
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{report.possiblePaths[0].description}</p>
                {report.possiblePaths[0].tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {report.possiblePaths[0].tags.map((tag) => (
                      <span key={tag} className="chip">{tag}</span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  以下行动项与技能均围绕此方向展开
                </p>
              </div>
            )}

            {/* 其他参考方向 */}
            {report.possiblePaths.length > 1 && (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-medium text-brand">其他参考方向</h3>
                  <span className="text-[10px] text-muted-foreground">点击切换主推方向</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {report.possiblePaths.slice(1).map((pathway) => (
                    <button
                      key={pathway.title}
                      onClick={() => switchDirection(pathway.title)}
                      className="card text-left transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-brand">{pathway.title}</h4>
                        {pathway.matchScore !== undefined && (
                          <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">
                            {pathway.matchScore}/100
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{pathway.description}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-brand">
                        切换为此方向 →
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

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

        {/* 定向模式下的转型路径 */}
        {profile.type === "B" && (
          <section className="mb-6">
            <h2 className="mb-4 text-base font-semibold text-brand">适合你的转型路径</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {report.possiblePaths.map((pathway) => (
                <div key={pathway.title} className="card flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-brand">{pathway.title}</h3>
                    {pathway.matchScore !== undefined && (
                      <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand">
                        {pathway.matchScore}/100
                      </span>
                    )}
                  </div>
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
        )}

        {/* 转型风险点 */}
        {report.riskPoints && report.riskPoints.length > 0 && (
          <section className="card mb-6 border-l-4 border-l-red-400">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand">
              <span className="text-base">⚠️</span> 转型风险点
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              选择这个转型方向可能会面临以下挑战，提前了解有助于你做好准备
            </p>
            <ul className="space-y-2">
              {report.riskPoints.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2 rounded-lg bg-red-50/50 p-2.5">
                  <span className="mt-0.5 text-xs text-red-500 shrink-0">●</span>
                  <span className="text-sm leading-relaxed text-foreground/80">{risk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 推荐公司 */}
        {report.recommendedCompanies && report.recommendedCompanies.length > 0 && (
          <section className="card mb-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-brand">
              <span>🏢</span> 推荐公司
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              根据你的简历经历和性格画像，小北为你匹配了以下公司与岗位
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.recommendedCompanies.map((company) => (
                <div key={company.name + company.position} className="rounded-xl border border-border bg-white p-4 transition-colors hover:border-brand-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-brand">{company.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{company.position}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand">
                      匹配
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{company.reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 开始转型 CTA */}
        <section className="sticky bottom-0 -mx-6 mt-4 border-t border-border bg-[#fafaf9]/90 px-6 py-5 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/coach?tab=human"
              className="btn-secondary"
            >
              预约 Coach 咨询
            </Link>
            <button
              onClick={() => {
                // 保存主推方向到 localStorage，coach 页面会读取
                const primaryPath = report.possiblePaths[0]?.title || profile.targetRole || "";
                if (primaryPath) {
                  localStorage.setItem("pathway:primary-path", primaryPath);
                }
                // 保存完整报告数据供 coach 页面使用
                localStorage.setItem("pathway:full-report", JSON.stringify(report));
                window.location.href = "/coach?tab=ai&action=start";
              }}
              className="btn-primary"
            >
              开始转型 →
            </button>
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

function PersonalityCard({
  archetype,
  personality,
  exploreDetail,
}: {
  archetype: PersonalityArchetype;
  personality: string;
  exploreDetail?: UserProfileInput["_exploreDetail"];
}) {
  const cartoonUrl = getArchetypeCartoonUrl(archetype, "portrait_4_3");

  const scores = exploreDetail?.archetypeScores;
  const maxScore = scores
    ? Math.max(...Object.values(scores), 1)
    : 1;

  return (
    <section className={`mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${archetype.bgGradient}`}>
      <div className="p-6">
        {/* 顶部：卡通人物 + 标题 */}
        <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start">
          {/* 卡通人物形象 */}
          <div className="shrink-0 sm:w-48">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/60 bg-white/50 shadow-sm">
              <img
                src={cartoonUrl}
                alt={`${archetype.name} 卡通形象`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // 加载失败时回退到 emoji
                  const tgt = e.currentTarget;
                  tgt.style.display = "none";
                  const parent = tgt.parentElement;
                  if (parent && !parent.querySelector("[data-emoji-fallback]")) {
                    const fallback = document.createElement("div");
                    fallback.setAttribute("data-emoji-fallback", "true");
                    fallback.className = `flex h-full w-full items-center justify-center text-7xl ${archetype.color}`;
                    fallback.textContent = archetype.emoji;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          </div>

          {/* 标题 & 描述 */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">你的人格原型</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                {archetype.emoji} {archetype.id}
              </span>
              {personality?.startsWith?.("archetype:") && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                  基于 8 题诊断
                </span>
              )}
            </div>
            <h2 className={`mt-1 text-2xl font-bold ${archetype.color}`}>
              {archetype.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {archetype.tagline}
              </span>
            </h2>
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5`}>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">职场定位</span>
              <span className={`text-sm font-bold ${archetype.color}`}>{archetype.funTitle}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-foreground/70">{archetype.funTagline}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {archetype.description}
            </p>

            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>🤫 你可能和</span>
              <span className={`font-medium ${archetype.color}`}>{archetype.famousExample}</span>
              <span>属于同一类型</span>
            </div>
          </div>
        </div>

        {/* 8 问各原型得分分布 */}
        {scores && (
          <div className="mt-6 rounded-xl bg-white/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-brand">6 型画像得分</h3>
                <p className="text-[10px] text-muted-foreground">基于 8 道职场+日常题汇总</p>
              </div>
              <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold shadow-sm ${archetype.color}`}>
                你是 {archetype.name}
              </span>
            </div>
            <ul className="space-y-2">
              {ALL_ARCHETYPES.map((a) => {
                const v = scores[a.id] || 0;
                const pct = Math.round((v / maxScore) * 100);
                const isTop = a.id === archetype.id;
                return (
                  <li key={a.id} className="grid grid-cols-[80px_1fr_40px] items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{a.emoji}</span>
                      <span className={`text-xs font-medium ${isTop ? a.color : "text-foreground"}`}>
                        {a.name}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${
                          isTop ? "bg-brand" : "bg-brand-border"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                      {v}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 三列标签 */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/60 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              职场定位
            </div>
            <div className={`text-sm font-semibold ${archetype.color}`}>
              {archetype.funTitle}
            </div>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              核心特质
            </div>
            <div className="flex flex-wrap gap-1">
              {archetype.traits.map((t) => (
                <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-foreground/80 shadow-sm">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              核心优势
            </div>
            <div className="flex flex-wrap gap-1">
              {archetype.strengths.map((s) => (
                <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-foreground/80 shadow-sm">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
