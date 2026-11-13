"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
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

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

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

function buildFallbackReport(profile: UserProfileInput, t: TranslateFn): ReportData {
  const role = profile.currentRole || t("fallback.defaultRole");
  const target = profile.targetRole || t("fallback.defaultTarget");
  const skills = profile.skills || t("fallback.defaultSkills");
  const interests = profile.interests || t("fallback.defaultInterests");
  const isExploration = profile.type !== "B" || !profile.targetRole;

  const matchScore = isExploration ? undefined : (profile.type === "B" ? 72 : 65);

  const assessmentTail = isExploration
    ? t("fallback.assessmentTailExplore")
    : t("fallback.assessmentTailTarget", { target });

  const currentAssessment = profile.years
    ? t("fallback.assessmentWithYears", { role, years: profile.years, skills, interests, tail: assessmentTail })
    : t("fallback.assessmentNoYears", { role, skills, interests, tail: assessmentTail });

  const feasibility: Feasibility = matchScore === undefined ? "low" : matchScore >= 85 ? "high" : matchScore >= 65 ? "medium" : "low";

  const exploreDetail = profile._exploreDetail;
  const choiceAnalysis = exploreDetail?.answers
    ? t("fallback.choiceAnalysis", {
        team: exploreDetail.answers.q5_team || t("fallback.teamDefault"),
        pressure: exploreDetail.answers.q2_pressure || t("fallback.pressureDefault"),
        archetype: profile.archetype || "",
      })
    : undefined;

  const resumeSummary = profile.resume
    ? t("fallback.resumeSummary", { role })
    : undefined;

  return {
    matchScore,
    aiReplaceRisk: 55,
    aiReplaceAnalysis: t("fallback.aiAnalysis", { role }),
    riskPoints: [
      t("fallback.riskDirectSwitch", { role: profile.currentRole || t("fallback.currentRole"), target }),
      t("fallback.riskSalary"),
      t("fallback.riskNetwork"),
    ],
    currentAssessment,
    feasibility,
    feasibilityExplanation:
      feasibility === "high"
        ? t("fallback.feasibilityHigh")
        : feasibility === "medium"
        ? t("fallback.feasibilityMedium")
        : t("fallback.feasibilityLow"),
    resumeSummary,
    choiceAnalysis,
    skillsToAcquire: [
      { name: t("fallback.skillPromptName"), description: t("fallback.skillPromptDesc"), priority: "high" },
      { name: t("fallback.skillArchName"), description: t("fallback.skillArchDesc"), priority: "high" },
      { name: t("fallback.skillPythonName"), description: t("fallback.skillPythonDesc"), priority: "medium" },
      { name: t("fallback.skillSqlName"), description: t("fallback.skillSqlDesc"), priority: "medium" },
      { name: t("fallback.skillFrontendName"), description: t("fallback.skillFrontendDesc"), priority: "low" },
    ],
    actionPlan: [
      {
        phase: t("fallback.phase1"), duration: t("fallback.duration1"), title: t("fallback.phase1Title"),
        details: [t("fallback.phase1Detail1"), t("fallback.phase1Detail2"), t("fallback.phase1Detail3")],
      },
      {
        phase: t("fallback.phase2"), duration: t("fallback.duration2"), title: t("fallback.phase2Title"),
        details: [t("fallback.phase2Detail1"), t("fallback.phase2Detail2"), t("fallback.phase2Detail3")],
      },
      {
        phase: t("fallback.phase3"), duration: t("fallback.duration3"), title: t("fallback.phase3Title"),
        details: [t("fallback.phase3Detail1"), t("fallback.phase3Detail2"), t("fallback.phase3Detail3")],
      },
      {
        phase: t("fallback.phase4"), duration: t("fallback.duration4"), title: t("fallback.phase4Title"),
        details: [t("fallback.phase4Detail1"), t("fallback.phase4Detail2"), t("fallback.phase4Detail3")],
      },
    ],
    possiblePaths: isExploration
      ? [
          {
            title: t("fallback.explorePath1Title"),
            description: t("fallback.explorePath1Desc"),
            tags: [t("fallback.explorePath1Tag1"), t("fallback.explorePath1Tag2"), t("fallback.explorePath1Tag3")],
            matchScore: 78,
          },
          {
            title: t("fallback.explorePath2Title"),
            description: t("fallback.explorePath2Desc"),
            tags: [t("fallback.explorePath2Tag1"), t("fallback.explorePath2Tag2"), t("fallback.explorePath2Tag3")],
            matchScore: 72,
          },
          {
            title: t("fallback.explorePath3Title"),
            description: t("fallback.explorePath3Desc"),
            tags: [t("fallback.explorePath3Tag1"), t("fallback.explorePath3Tag2"), t("fallback.explorePath3Tag3")],
            matchScore: 65,
          },
        ]
      : [
          {
            title: target,
            description: t("fallback.targetPathDesc"),
            tags: [t("fallback.targetPathTag1"), t("fallback.targetPathTag2"), t("fallback.targetPathTag3")],
            matchScore: matchScore || 72,
          },
          {
            title: t("fallback.targetSolutionTitle", { target }),
            description: t("fallback.targetSolutionDesc"),
            tags: [t("fallback.targetSolutionTag1"), t("fallback.targetSolutionTag2")],
            matchScore: 68,
          },
          {
            title: t("fallback.aiStartupTitle"),
            description: t("fallback.aiStartupDesc"),
            tags: [t("fallback.aiStartupTag1"), t("fallback.aiStartupTag2")],
            matchScore: 55,
          },
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

function normalizeSkills(raw: unknown, t: TranslateFn): SkillItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => ({
    name: s.name ?? t("fallback.unnamedSkill"),
    description: s.description ?? "",
    priority: (s.priority as Priority) ?? "medium",
  }));
}

function normalizeActionPlan(raw: unknown, t: TranslateFn): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const details: string[] = p.details ?? p.steps ?? [];
    return {
      phase: p.phase ?? t("fallback.defaultPhase"),
      duration: p.duration ?? "",
      title: p.title ?? p.phase ?? "",
      details: Array.isArray(details) ? details.map((d: unknown) => String(d)) : [],
    };
  });
}

function normalizePaths(raw: unknown, t: TranslateFn): Pathway[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    title: p.title ?? t("fallback.unnamedPath"),
    description: p.description ?? "",
    tags: Array.isArray(p.tags) ? p.tags.map((tag: unknown) => String(tag)) : [],
    matchScore: typeof p.matchScore === "number" ? p.matchScore : undefined,
  }));
}

async function fetchReport(
  profile: UserProfileInput,
  locale: string,
  t: TranslateFn,
  focusDirection?: string
): Promise<ReportData> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locale,
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
    skillsToAcquire: normalizeSkills(data.skillsToAcquire, t),
    actionPlan: normalizeActionPlan(data.actionPlan, t),
    possiblePaths: normalizePaths(data.possiblePaths, t),
    resumeSummary: data.resumeSummary ?? undefined,
    choiceAnalysis: data.choiceAnalysis ?? undefined,
    recommendedCompanies: Array.isArray(data.recommendedCompanies) ? data.recommendedCompanies : undefined,
  };
}

const feasibilityConfig: Record<
  Feasibility,
  { color: string; bg: string; border: string }
> = {
  high: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  low: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const priorityConfig: Record<
  Priority,
  { color: string; bg: string; border: string }
> = {
  high: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  low: { color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
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
  const t = useTranslations("report");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf9] px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"></span>
        </div>
        <div className="text-base font-medium text-brand">{t("loading.title")}</div>
        <div className="text-sm text-muted-foreground">{t("loading.subtitle")}</div>
      </div>
    </div>
  );
}

function ReportContent({ profile }: { profile: UserProfileInput }) {
  const t = useTranslations("report");
  const locale = useLocale();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);
  const [focusDirection, setFocusDirection] = useState<string | undefined>(undefined);
  const [showWechat, setShowWechat] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    fetchReport(profile, locale, t, focusDirection)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setReport(buildFallbackReport(profile, t));
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
              <p className="text-sm text-muted-foreground">{t("header.reportLabel")}</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-brand">
              {profile.name ? t("header.titleWithName", { name: profile.name }) : t("header.title")}
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
            <p className="text-sm text-muted-foreground">{t("header.reportLabel")}</p>
            {error && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                {t("header.offlineBadge")}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-brand">
            {profile.name ? t("header.titleWithName", { name: profile.name }) : t("header.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("header.generatedAt", {
              date: new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US"),
            })}
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
                <span className="text-base">🤖</span> {t("aiRisk.title")}
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
                {report.aiReplaceRisk >= 70 ? t("aiRisk.high") : report.aiReplaceRisk >= 40 ? t("aiRisk.medium") : t("aiRisk.low")}
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
              <span className="text-base">📄</span> {t("resume.title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.resumeSummary}</p>
          </section>
        )}

        {/* 选择-结论关联分析 */}
        {report.choiceAnalysis && (
          <section className="card mb-6 border-l-4 border-l-brand">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand">
              <span className="text-base">🔗</span> {t("analysis.title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{report.choiceAnalysis}</p>
            {profile._exploreDetail?.answers && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("analysis.basis")}
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
                {report.matchScore >= 75 ? t("match.excellent") : report.matchScore >= 60 ? t("match.good") : t("match.needsWork")}
              </span>
              <h2 className="text-xl font-semibold text-brand">
                {t("match.heading", { role: profile.targetRole || t("match.defaultRole") })}
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("match.description")}
              </p>
            </div>
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-base font-semibold text-brand">{t("paths.primaryTitle")}</h2>
              <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] text-muted-foreground">
                {t("paths.explorationBadge")}
              </span>
            </div>

            {/* 主推方向大卡片 */}
            {report.possiblePaths.length > 0 && (
              <div className="card relative mb-4 overflow-hidden border-2 border-brand bg-gradient-to-br from-brand-light to-white">
                <span className="absolute right-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[10px] font-medium text-white">
                  {t("paths.bestRecommendation")}
                </span>
                <div className="flex items-start justify-between gap-3 pr-20">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-brand">{report.possiblePaths[0].title}</h3>
                    {report.possiblePaths[0].matchScore !== undefined && (
                      <p className="mt-1 text-sm text-brand">
                        {t("paths.matchScoreLabel")} <span className="text-lg font-bold">{report.possiblePaths[0].matchScore}</span>/100
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
                  {t("paths.followsDirection")}
                </p>
              </div>
            )}

            {/* 其他参考方向 */}
            {report.possiblePaths.length > 1 && (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-medium text-brand">{t("paths.otherTitle")}</h3>
                  <span className="text-[10px] text-muted-foreground">{t("paths.switchHint")}</span>
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
                        {t("paths.switchAction")}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section className="card mb-6">
          <h2 className="mb-3 text-base font-semibold text-brand">{t("assessment.title")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.currentAssessment}</p>
        </section>

        <section className="card mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand">{t("feasibility.title")}</h2>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${feasibility.bg} ${feasibility.color} ${feasibility.border}`}>
              {t(`feasibility.${report.feasibility}`)}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.feasibilityExplanation}</p>
        </section>

        <section className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-brand">{t("skills.title")}</h2>
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
                    {t(`priority.${skill.priority}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card mb-6">
          <h2 className="mb-6 text-base font-semibold text-brand">{t("plan.title")}</h2>
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
            <h2 className="mb-4 text-base font-semibold text-brand">{t("directPaths.title")}</h2>
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
              <span className="text-base">⚠️</span> {t("risks.title")}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("risks.description")}
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
              <span>🏢</span> {t("companies.title")}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {t("companies.description")}
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
                      {t("companies.matchBadge")}
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
            <button
              onClick={() => setShowWechat(true)}
              className="btn-secondary"
            >
              💬 加微信 1v1 咨询
            </button>
            <Link
              href="/coach?tab=human"
              className="btn-secondary"
            >
              {t("cta.bookCoach")}
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
              {t("cta.start")}
            </button>
          </div>
        </section>
      </div>

      {/* 微信二维码弹窗 */}
      {showWechat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowWechat(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">加微信，1v1 职业咨询</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              扫码添加专属顾问微信，<br />帮你匹配过来人 / 专业教练，<br />前 20 位用户享 <b className="text-brand">免费人工对接</b>
            </p>
            <div className="mx-auto mt-4 w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wechat/qr.jpg" alt="Pathway 微信二维码" className="w-full rounded-xl" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">长按识别 / 截图扫码加微信</p>
            <button
              onClick={() => setShowWechat(false)}
              className="mt-4 w-full rounded-full border border-border bg-white py-2 text-sm text-foreground hover:bg-muted"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
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
  const t = useTranslations("report");
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
                alt={t("personality.imageAlt", { name: archetype.name })}
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
              <span className="text-xs font-medium text-muted-foreground">{t("personality.label")}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                {archetype.emoji} {archetype.id}
              </span>
              {personality?.startsWith?.("archetype:") && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                  {t("personality.fromQuiz")}
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
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("personality.roleLabel")}</span>
              <span className={`text-sm font-bold ${archetype.color}`}>{archetype.funTitle}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-foreground/70">{archetype.funTagline}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {archetype.description}
            </p>

            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{t("personality.similarPrefix")}</span>
              <span className={`font-medium ${archetype.color}`}>{archetype.famousExample}</span>
              <span>{t("personality.similarSuffix")}</span>
            </div>
          </div>
        </div>

        {/* 8 问各原型得分分布 */}
        {scores && (
          <div className="mt-6 rounded-xl bg-white/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-brand">{t("personality.scoresTitle")}</h3>
                <p className="text-[10px] text-muted-foreground">{t("personality.scoresSubtitle")}</p>
              </div>
              <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold shadow-sm ${archetype.color}`}>
                {t("personality.youAre", { name: archetype.name })}
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
              {t("personality.roleLabel")}
            </div>
            <div className={`text-sm font-semibold ${archetype.color}`}>
              {archetype.funTitle}
            </div>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("personality.traits")}
            </div>
            <div className="flex flex-wrap gap-1">
              {archetype.traits.map((trait) => (
                <span key={trait} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-foreground/80 shadow-sm">
                  {trait}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("personality.strengths")}
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
