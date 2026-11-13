"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { getStoredUser, type StoredUser } from "@/lib/userStore";
import { getStoredReport, type SavedReport } from "@/lib/reportStore";
import { authHeaders } from "@/lib/firebase";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { MarketplaceCoach } from "@/lib/marketplaceFirestore";

type TabType = "ai" | "human";
type Category = "skill" | "task" | "milestone";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ActionItem {
  id: string;
  title: string;
  category: Category;
  completed: boolean;
  source: "report" | "user";
}

interface SkillItem {
  id: string;
  name: string;
  priority: "high" | "medium" | "low";
  source: "report" | "user";
}

interface BookingForm {
  name: string;
  email: string;
  notes: string;
}

const COACH_SYS_PROMPT = `你是Pathway AI职业教练"小北"，温暖、专业、善于倾听。
用口语化中文回复，像朋友一样给建议。
不要用markdown、不要用编号列表、不要用标题。
回复要完整，不要以省略号"..."结尾，不要以"…"结尾。
每段回复控制在80-150字，简洁但要说完整。
结合用户的诊断报告数据（目标方向、技能差距、行动项）给出具体可操作的建议。
如果用户犹豫或焦虑，先共情再引导。`;

const ACTION_ITEMS_KEY = "pathway:action-items";
const SKILL_ITEMS_KEY = "pathway:skill-items";
const FULL_REPORT_KEY = "pathway:full-report";
const PRIMARY_PATH_KEY = "pathway:primary-path";

function loadActionItems(): ActionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTION_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveActionItems(items: ActionItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTION_ITEMS_KEY, JSON.stringify(items));
}

function loadSkillItems(): SkillItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKILL_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSkillItems(items: SkillItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SKILL_ITEMS_KEY, JSON.stringify(items));
}

function seedFromReport(report: SavedReport | null): { actions: ActionItem[]; skills: SkillItem[] } {
  if (!report) return { actions: [], skills: [] };

  const actions: ActionItem[] = [];
  report.actionPlan.forEach((step, phaseIdx) => {
    step.details.forEach((detail, detailIdx) => {
      actions.push({
        id: `r-${phaseIdx}-${detailIdx}`,
        title: detail,
        category: phaseIdx === 0 ? "milestone" : "task",
        completed: false,
        source: "report",
      });
    });
  });
  if (actions.length > 0) actions[0].completed = true;

  const skills: SkillItem[] = report.skillsToAcquire.map((s, i) => ({
    id: `rs-${i}`,
    name: s.name,
    priority: s.priority,
    source: "report",
  }));

  return { actions, skills };
}

const categoryLabelKeys: Record<Category, string> = {
  skill: "dashboard.categorySkill",
  task: "dashboard.categoryTask",
  milestone: "dashboard.categoryMilestone",
};

const categoryIcons: Record<Category, string> = {
  skill: "📚",
  task: "✅",
  milestone: "🎯",
};

const categoryColors: Record<Category, string> = {
  skill: "bg-amber-50 text-amber-700 border-amber-200",
  task: "bg-blue-50 text-blue-700 border-blue-200",
  milestone: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const priorityLabelKeys = {
  high: "dashboard.priorityHigh",
  medium: "dashboard.priorityMedium",
  low: "dashboard.priorityLow",
};
const priorityColors: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function CoachPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted" />}>
      <CoachPageInner />
    </Suspense>
  );
}

function CoachPageInner() {
  const t = useTranslations("coachChat");
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  // 从 URL 读取 tab 参数
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "human") setActiveTab("human");
    else if (tab === "ai") setActiveTab("ai");
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-7xl px-6 py-4">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand">
              {t("header.title")}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("header.subtitle")}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-white p-1">
            <button
              onClick={() => setActiveTab("ai")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === "ai"
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:text-brand"
              }`}
            >
              {t("header.tabAi")}
            </button>
            <button
              onClick={() => setActiveTab("human")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === "human"
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:text-brand"
              }`}
            >
              {t("header.tabHuman")}
            </button>
          </div>
        </header>

        {activeTab === "ai" ? <AICoachTab /> : <HumanCoachTab />}
      </main>
    </div>
  );
}

function AICoachTab() {
  const t = useTranslations("coachChat");
  const locale = useLocale();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [fullReport, setFullReport] = useState<any>(null);
  const [primaryPath, setPrimaryPath] = useState<string>("");
  const [resumes, setResumes] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [skillItems, setSkillItems] = useState<SkillItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);

    // 读取完整报告
    try {
      const raw = localStorage.getItem(FULL_REPORT_KEY);
      if (raw) setFullReport(JSON.parse(raw));
    } catch { /* ignore */ }

    // 读取主推方向
    const path = localStorage.getItem(PRIMARY_PATH_KEY) || "";
    setPrimaryPath(path);

    // 读取行动项 + 技能
    setActionItems(loadActionItems());
    setSkillItems(loadSkillItems());

    // 从服务端加载长期记忆：档案、最新报告、简历、历史对话
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/coach/context", { headers });
        if (!res.ok) return;
        const ctx = await res.json();

        if (Array.isArray(ctx.resumes)) setResumes(ctx.resumes);

        // 换设备 / 清缓存后也能从 Firestore 恢复档案
        if (ctx.profile) {
          const p = ctx.profile;
          setUser((prev) => {
            const base = prev ?? ({} as StoredUser);
            const merged: StoredUser = {
              ...base,
              id: base.id || p.id,
              email: base.email || p.email || undefined,
              name: base.name || p.name || "",
              currentRole: base.currentRole || p.current_role || "",
              years: base.years || p.experience || "",
              skills:
                base.skills ||
                (Array.isArray(p.skills) ? p.skills.join("、") : ""),
              interests: base.interests || p.interests || "",
              target: base.target || p.target_role || "",
              type:
                base.type ||
                (p.user_type === "A" ? "A" : p.user_type === "B" ? "B" : null),
              personality: base.personality || p.personality || undefined,
              coachNote: base.coachNote || p.coach_note || undefined,
              createdAt: base.createdAt || Date.now(),
              updatedAt: base.updatedAt || Date.now(),
            };
            try {
              localStorage.setItem("pathway:user", JSON.stringify(merged));
            } catch {
              /* ignore */
            }
            return merged;
          });
        }

        // 本地没有报告时用服务端最新报告兜底
        try {
          if (!localStorage.getItem(FULL_REPORT_KEY) && ctx.report) {
            setFullReport(ctx.report);
            localStorage.setItem(FULL_REPORT_KEY, JSON.stringify(ctx.report));
          }
        } catch {
          /* ignore */
        }

        // 恢复历史对话，让小北跨会话记得上下文
        if (Array.isArray(ctx.messages) && ctx.messages.length > 0) {
          setMessages(
            ctx.messages.slice(-20).map(
              (m: { role?: string; content?: string; at?: string }, i: number) => ({
                id: `h-${i}-${m.at || ""}`,
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content || "",
                timestamp: new Date(m.at || Date.now()),
              })
            )
          );
        }
      } catch {
        /* ignore */
      }
    })();

    // 检查是否从报告页"开始转型"按钮跳转
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");

    if (action === "start" && u) {
      const targetDir = path || u.target || t("welcome.fallbackTarget");
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcome.withReport", { name: u.name, target: targetDir }),
          timestamp: new Date(),
        },
      ]);
    } else if (u?.name) {
      const targetDir = path || u.target;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcome.withProfile", {
            name: u.name,
            role: u.currentRole || t("welcome.defaultRole"),
            direction: targetDir
              ? t("welcome.withDirection", { target: targetDir })
              : t("welcome.exploring"),
          }),
          timestamp: new Date(),
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcome.generic"),
          timestamp: new Date(),
        },
      ]);
    }
  }, [t]);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } =
    useVoiceInput({
      onFinal: (text) => {
        setInput((prev) => (prev ? prev + " " + text : text));
      },
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildSystemPrompt = useMemo(() => {
    const parts: string[] = [];
    if (user) {
      if (user.name) parts.push(`姓名：${user.name}`);
      if (user.currentRole) parts.push(`当前岗位：${user.currentRole}`);
      if (user.target) parts.push(`目标岗位：${user.target}`);
      if (user.skills) parts.push(`技能：${user.skills}`);
      if (user.interests) parts.push(`兴趣方向：${user.interests}`);
      if (user.personality) parts.push(`性格画像：${user.personality}`);
      if (user.type) parts.push(`模式：${user.type === "A" ? "探索模式" : "定向模式"}`);
      // 用户在探索模式跟小北说过的意愿（最高优先级）
      if ((user as any).coachNote) parts.push(`重要：用户在探索模式里说过的真实意愿：${(user as any).coachNote}`);
    }
    if (primaryPath) parts.push(`主推转型方向：${primaryPath}`);

    // 从完整报告中提取关键信息
    let reportContext = "";
    if (fullReport) {
      const r = fullReport;
      const reportParts: string[] = [];
      if (r.possiblePaths?.[0]?.title) reportParts.push(`主推方向：${r.possiblePaths[0].title}`);
      if (r.currentAssessment) reportParts.push(`状态评估：${r.currentAssessment.slice(0, 150)}`);
      if (r.feasibilityExplanation) reportParts.push(`可行性分析：${r.feasibilityExplanation.slice(0, 150)}`);
      if (r.resumeSummary) reportParts.push(`简历分析：${r.resumeSummary.slice(0, 200)}`);
      if (r.skillsToAcquire?.length) {
        reportParts.push(`需补技能：${r.skillsToAcquire.map((s: any) => s.name).join("、")}`);
      }
      if (r.actionPlan?.length) {
        const steps = r.actionPlan.flatMap((p: any) => p.details || []).slice(0, 5);
        reportParts.push(`行动项：${steps.join("；")}`);
      }
      if (r.recommendedCompanies?.length) {
        reportParts.push(`推荐公司：${r.recommendedCompanies.map((c: any) => c.name).join("、")}`);
      }
      if (reportParts.length > 0) reportContext = `\n\n【诊断报告数据】\n${reportParts.join("\n")}`;
    }

    // 正在跟踪的行动项 + 技能（右侧面板）
    let trackingContext = "";
    if (actionItems.length > 0 || skillItems.length > 0) {
      const tracking: string[] = [];
      if (actionItems.length > 0) {
        const done = actionItems.filter((a) => a.completed).map((a) => a.title).join("、");
        const todo = actionItems.filter((a) => !a.completed).map((a) => a.title).join("、");
        if (done) tracking.push(`已完成的行动项：${done}`);
        if (todo) tracking.push(`待推进的行动项：${todo}`);
      }
      if (skillItems.length > 0) {
        tracking.push(`正在补的技能：${skillItems.map((s) => s.name).join("、")}`);
      }
      if (tracking.length > 0) trackingContext = `\n\n【用户在做的事】\n${tracking.join("\n")}`;
    }

    // 简历全文（全部简历都拼进去，最多 8000 字）
    let resumeContext = "";
    if (resumes.length > 0) {
      const resumeBlocks: string[] = [];
      resumes.forEach((r, i) => {
        const text = r.extracted_text?.trim();
        resumeBlocks.push(
          `简历${i + 1}（${r.file_name}${r.is_primary ? " · 主简历" : ""}）：\n${text || "（无法自动解析，请让用户描述简历经历）"}`
        );
      });
      resumeContext = `\n\n【用户上传的简历】\n${resumeBlocks.join("\n\n").slice(0, 8000)}`;
    }

    return (
      `${COACH_SYS_PROMPT}\n\n` +
      `以下是你的专属用户档案，请牢记并在对话中引用：\n` +
      `${parts.join("；")}。` +
      `${reportContext}` +
      `${trackingContext}` +
      `${resumeContext}` +
      `\n\n你是这个用户的专属AI教练小北，每次对话都要基于上面这些信息给出个性化建议，` +
      `让用户感觉到"你真的懂我、记得我之前说过什么、看过我的简历"。` +
      `\n\n${
        locale === "en"
          ? "The user's interface language is English. You MUST reply in English for every message."
          : "用户的界面语言是中文，请务必用中文回复每一条消息。"
      }`
    );
  }, [user, primaryPath, fullReport, resumes, actionItems, skillItems, locale]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: buildSystemPrompt,
          maxTokens: 500,
          locale,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      let content = (data.content || "").trim();
      // 只做轻度清理，不截断
      content = content
        .replace(/[#*`>_~]/g, "")
        .replace(/^\d+[\.\)、]\s*/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      // 去掉结尾的省略号（... 或 …），保持回复完整
      content = content.replace(/\s*[\.．…]+\s*$/, "");
      // 如果不以标点结尾，补句号
      if (content && !/[。！？.!?\n]$/.test(content)) {
        content += "。";
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: content || t("chat.emptyReply"),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // 写入长期记忆：下次打开教练页仍能接上这段对话
      authHeaders()
        .then((headers) =>
          fetch("/api/coach/context", {
            method: "POST",
            headers,
            body: JSON.stringify({
              messages: [
                { role: "user", content: trimmed },
                { role: "assistant", content: content },
              ],
            }),
          })
        )
        .catch(() => undefined);
    } catch (err) {
      console.error("[AI Coach] API error:", err);
      const fallbackMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: t("chat.errorReply"),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = useMemo(() => {
    if (primaryPath) {
      return [
        t("suggestions.firstAction", { path: primaryPath }),
        t("suggestions.biggestGap"),
        t("suggestions.bestCompany"),
      ];
    }
    if (!user) {
      return [
        t("suggestions.feasibility"),
        t("suggestions.aiPmSkills"),
        t("suggestions.threeMonthPlan"),
      ];
    }
    if (user.target) {
      return [
        t("suggestions.skillsForTarget", { target: user.target }),
        t("suggestions.transitionStory"),
        t("suggestions.nextThreeMonths"),
      ];
    }
    return [
      t("suggestions.suitableDirection"),
      t("suggestions.planAsRole", { role: user.currentRole || t("welcome.defaultRole") }),
      t("suggestions.coreStrengths"),
    ];
  }, [user, primaryPath, t]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      {/* AI 对话区 - 缩小占比 */}
      <div className="card flex h-[calc(100vh-140px)] flex-col">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm text-white">
            🤖
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand">{t("chat.coachTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {primaryPath
                ? t("chat.statusReport", { path: primaryPath })
                : t("chat.statusOnline")}
            </p>
          </div>
          {fullReport && (
            <span className="rounded-full bg-gold-light px-2 py-0.5 text-[10px] font-medium text-brand">
              {t("chat.reportLoaded")}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand text-white"
                    : "bg-brand-light text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-brand-light px-4 py-2.5">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-end gap-2">
            {voiceSupported && (
              <VoiceButton
                listening={listening}
                supported={voiceSupported}
                onClick={toggleVoice}
              />
            )}
            <textarea
              value={input + (interim ? " " + interim : "")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? t("chat.listening") : t("chat.placeholder")}
              rows={1}
              className="input-primary resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("chat.send")}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="chip hover:bg-brand-light"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DashboardPanel primaryPath={primaryPath} fullReport={fullReport} />
    </div>
  );
}

function DashboardPanel({ primaryPath, fullReport }: { primaryPath?: string; fullReport?: any }) {
  const t = useTranslations("coachChat");
  const [user, setUser] = useState<StoredUser | null>(null);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionCategory, setNewActionCategory] = useState<Category>("task");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillPriority, setNewSkillPriority] = useState<"high" | "medium" | "low">("medium");

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    const r = getStoredReport();
    setReport(r);

    const savedActions = loadActionItems();
    const savedSkills = loadSkillItems();

    if (savedActions.length === 0 && savedSkills.length === 0 && r) {
      const seeded = seedFromReport(r);
      setActions(seeded.actions);
      setSkills(seeded.skills);
      saveActionItems(seeded.actions);
      saveSkillItems(seeded.skills);
    } else {
      setActions(savedActions);
      setSkills(savedSkills);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveActionItems(actions);
  }, [actions, loaded]);

  useEffect(() => {
    if (loaded) saveSkillItems(skills);
  }, [skills, loaded]);

  const completedCount = actions.filter((a) => a.completed).length;
  const totalTasks = actions.length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);

  const toggleAction = useCallback((id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a))
    );
  }, []);

  const deleteAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAction = useCallback(() => {
    const title = newActionTitle.trim();
    if (!title) return;
    setActions((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        title,
        category: newActionCategory,
        completed: false,
        source: "user",
      },
    ]);
    setNewActionTitle("");
    setNewActionCategory("task");
  }, [newActionTitle, newActionCategory]);

  const addSkill = useCallback(() => {
    const name = newSkillName.trim();
    if (!name) return;
    setSkills((prev) => [
      ...prev,
      {
        id: `us-${Date.now()}`,
        name,
        priority: newSkillPriority,
        source: "user",
      },
    ]);
    setNewSkillName("");
    setNewSkillPriority("medium");
  }, [newSkillName, newSkillPriority]);

  const removeSkill = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const userSkills = useMemo(() => {
    if (!user?.skills) return [];
    return user.skills.split(/[、,，\s]+/).filter(Boolean);
  }, [user]);

  return (
    <aside className="space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
      {/* 个人档案 + 主推方向 */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand">{t("dashboard.profileTitle")}</h3>
        {user ? (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("dashboard.name")}</span>
              <span className="text-sm font-medium text-brand">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("dashboard.currentRole")}</span>
              <span className="text-sm text-foreground">{user.currentRole || t("dashboard.notSet")}</span>
            </div>
            {(primaryPath || user.target) && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("dashboard.primaryPath")}</span>
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">
                  {primaryPath || user.target}
                </span>
              </div>
            )}
            {userSkills.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">{t("dashboard.coreSkills")}</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {userSkills.map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("dashboard.profileEmpty")}
          </p>
        )}
      </div>

      {/* 转型进度 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">{t("dashboard.progressTitle")}</h3>
          <span className="text-lg font-semibold text-brand">{progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("dashboard.completed", { done: completedCount, total: totalTasks })}</span>
          {report && (
            <span>
              {t("dashboard.matchScorePrefix")}
              <span className="font-semibold text-brand">{report.matchScore}</span>/100
            </span>
          )}
        </div>
      </div>

      {/* 行动项 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">{t("dashboard.actionsTitle")}</h3>
          <span className="chip">{completedCount}/{totalTasks}</span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {actions.map((action) => (
            <li
              key={action.id}
              className={`group flex items-start gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border ${
                action.completed ? "opacity-60" : ""
              }`}
            >
              <span className="mt-0.5 text-base shrink-0" aria-hidden="true">
                {categoryIcons[action.category]}
              </span>
              <input
                type="checkbox"
                checked={action.completed}
                onChange={() => toggleAction(action.id)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border text-brand focus:ring-brand"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs text-brand leading-relaxed ${action.completed ? "line-through text-muted-foreground" : ""}`}>
                  {action.title}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${categoryColors[action.category]}`}>
                    {t(categoryLabelKeys[action.category])}
                  </span>
                  {action.source === "report" && (
                    <span className="inline-flex items-center rounded-full bg-gold-light px-1.5 py-0 text-[10px] font-medium text-brand">
                      {t("dashboard.aiSuggested")}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteAction(action.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
                aria-label={t("dashboard.delete")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
          {actions.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {t("dashboard.noActions")}
            </li>
          )}
        </ul>

        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="flex gap-1.5">
            <select
              value={newActionCategory}
              onChange={(e) => setNewActionCategory(e.target.value as Category)}
              className="w-20 shrink-0 rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-brand outline-none focus:border-brand-border"
            >
              <option value="skill">{t("dashboard.categorySkill")}</option>
              <option value="task">{t("dashboard.categoryTask")}</option>
              <option value="milestone">{t("dashboard.categoryMilestone")}</option>
            </select>
            <input
              type="text"
              value={newActionTitle}
              onChange={(e) => setNewActionTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder={t("dashboard.addActionPlaceholder")}
              className="input-primary py-1.5 text-xs"
            />
          </div>
          <button onClick={addAction} className="btn-primary w-full py-1.5 text-xs">
            {t("dashboard.add")}
          </button>
        </div>
      </div>

      {/* 待掌握技能 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">{t("dashboard.skillsTitle")}</h3>
          <span className="chip">{t("dashboard.skillCount", { count: skills.length })}</span>
        </div>
        {report && (
          <p className="mt-1 text-[10px] text-tech">{t("dashboard.skillsFromReport")}</p>
        )}

        <ul className="mt-3 space-y-1.5">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="group flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border"
            >
              <span className="text-base shrink-0" aria-hidden="true">📖</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-brand">
                  {skill.name}
                  {skill.source === "report" && (
                    <span className="ml-1 rounded-full bg-gold-light px-1.5 py-0 text-[9px] font-medium text-brand">
                      AI
                    </span>
                  )}
                </p>
                <span className={`mt-0.5 inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-medium ${priorityColors[skill.priority]}`}>
                  {t(priorityLabelKeys[skill.priority])}
                </span>
              </div>
              <button
                onClick={() => removeSkill(skill.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
                aria-label={t("dashboard.delete")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
          {skills.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {t("dashboard.noSkills")}
            </li>
          )}
        </ul>

        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="flex gap-1.5">
            <select
              value={newSkillPriority}
              onChange={(e) => setNewSkillPriority(e.target.value as "high" | "medium" | "low")}
              className="w-20 shrink-0 rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-brand outline-none focus:border-brand-border"
            >
              <option value="high">{t("dashboard.priorityHigh")}</option>
              <option value="medium">{t("dashboard.priorityMedium")}</option>
              <option value="low">{t("dashboard.priorityLow")}</option>
            </select>
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder={t("dashboard.addSkillPlaceholder")}
              className="input-primary py-1.5 text-xs"
            />
          </div>
          <button onClick={addSkill} className="btn-primary w-full py-1.5 text-xs">
            {t("dashboard.addSkill")}
          </button>
        </div>
      </div>

      {/* 推荐公司 */}
      {fullReport?.recommendedCompanies?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-brand">{t("dashboard.companiesTitle")}</h3>
          <ul className="mt-3 space-y-2">
            {fullReport.recommendedCompanies.slice(0, 5).map((c: any) => (
              <li key={c.name + c.position} className="rounded-lg border border-border bg-white p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand">{c.name}</span>
                  <span className="rounded-full bg-brand-light px-1.5 py-0 text-[10px] font-medium text-brand">
                    {c.position}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">{c.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand">{t("dashboard.quickLinksTitle")}</h3>
        <div className="mt-3 space-y-2">
          <Link
            href="/simulator"
            className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border hover:bg-muted"
          >
            <span className="text-base">🎮</span>
            <span className="text-xs font-medium text-brand">{t("dashboard.simulator")}</span>
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border hover:bg-muted"
          >
            <span className="text-base">🔄</span>
            <span className="text-xs font-medium text-brand">{t("dashboard.reExplore")}</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

function HumanCoachTab() {
  const t = useTranslations("coachChat");
  const [coaches, setCoaches] = useState<MarketplaceCoach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coaches")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCoaches((d.coaches ?? []).slice(0, 4)))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5">
        <div>
          <h3 className="text-base font-semibold text-brand">{t("human.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("human.desc")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/coach/manage" className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-brand">
            {t("human.manage")}
          </Link>
          <Link href="/coaches" className="rounded-full bg-brand px-5 py-2 text-xs font-medium text-white hover:bg-brand-hover">
            {t("human.viewAll")}
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("human.loading")}</p>
      ) : coaches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-14 text-center">
          <p className="text-sm text-muted-foreground">{t("human.empty")}</p>
          <Link href="/become-coach" className="mt-4 inline-block rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            {t("human.becomeCoach")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {coaches.map((c) => (
            <Link key={c.id} href={`/coaches/${c.id}`}
              className="card flex flex-col transition-all hover:shadow-md">
              <div className="flex items-start gap-3">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt={c.display_name}
                    className="h-12 w-12 shrink-0 rounded-full border border-border object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
                    {c.display_name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <h3 className="truncate text-sm font-semibold text-brand">{c.display_name}</h3>
                    {c.verified && <VerifiedBadge size={14} />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.headline}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.topic_tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-brand">
                  {c.price_single != null ? t("human.perSession", { price: c.price_single }) : t("human.contactForPrice")}
                </span>
                <span className="text-xs text-amber-500">
                  ★ {c.rating_avg ?? t("human.new")}
                  {(c.review_count ?? 0) > 0 && <span className="text-muted-foreground"> ({c.review_count})</span>}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
