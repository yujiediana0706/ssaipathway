"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { getStoredUser, type StoredUser } from "@/lib/userStore";
import { getStoredReport, type SavedReport } from "@/lib/reportStore";
import { authHeaders } from "@/lib/supabase";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { MarketplaceCoach } from "@/lib/marketplace";

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

const categoryLabels: Record<Category, string> = {
  skill: "技能",
  task: "任务",
  milestone: "里程碑",
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

const priorityLabels = { high: "高", medium: "中", low: "低" };
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
              教练中心
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              与 AI 教练随时对话，或预约真人教练进行深度辅导
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
              AI 教练
            </button>
            <button
              onClick={() => setActiveTab("human")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === "human"
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:text-brand"
              }`}
            >
              真人教练
            </button>
          </div>
        </header>

        {activeTab === "ai" ? <AICoachTab /> : <HumanCoachTab />}
      </main>
    </div>
  );
}

function AICoachTab() {
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

    // 加载简历（从 Supabase）
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/resume", { headers });
        const d = await (res.ok ? res.json() : null);
        if (d && Array.isArray(d.resumes)) setResumes(d.resumes);
      } catch {
        /* ignore */
      }
    })();

    // 检查是否从报告页"开始转型"按钮跳转
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");

    if (action === "start" && u) {
      const targetDir = path || u.target || "你的转型方向";
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            `你好${u.name}！我是小北 🤖\n\n` +
            `我已经看完了你的诊断报告——你的主推方向是${targetDir}。` +
            `报告里的行动项和技能已经同步到右侧进度面板，你可以边聊边跟踪进度。\n\n` +
            `想从哪里开始聊？比如第一个行动项怎么落地，或者某个技能怎么补？`,
          timestamp: new Date(),
        },
      ]);
    } else if (u?.name) {
      const targetDir = path || u.target;
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            `你好${u.name}！我是小北 🤖\n\n` +
            `我看了你的档案——目前是${u.currentRole || "职场人"}` +
            `${targetDir ? `，主推方向是${targetDir}` : "，正在探索方向"}` +
            `。有什么想聊的？`,
          timestamp: new Date(),
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "你好！我是小北 🤖\n\n我可以帮你梳理职业转型思路、分析能力差距、制定行动计划。有什么想聊的？",
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

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
      `让用户感觉到"你真的懂我、记得我之前说过什么、看过我的简历"。`
    );
  }, [user, primaryPath, fullReport, resumes, actionItems, skillItems]);

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
        content: content || "嗯，这个问题我想想。你能具体说说你的情况吗？",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("[AI Coach] API error:", err);
      const fallbackMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "抱歉，我刚才没听清楚。你能再说说吗？",
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
        `${primaryPath}第一个行动项怎么落地？`,
        "我最大的能力缺口是什么？",
        "推荐的公司里哪家最适合我？",
      ];
    }
    if (!user) {
      return [
        "如何评估我转型的可行性？",
        "AI 产品经理需要哪些核心技能？",
        "如何制定 3 个月的转型计划？",
      ];
    }
    if (user.target) {
      return [
        `转去${user.target}需要补哪些技能？`,
        "如何写一份有说服力的转型故事？",
        "接下来3个月我该怎么安排？",
      ];
    }
    return [
      "我适合转什么方向？",
      `作为${user.currentRole || "职场人"}，怎么规划转型？`,
      "如何评估我的核心优势？",
    ];
  }, [user, primaryPath]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      {/* AI 对话区 - 缩小占比 */}
      <div className="card flex h-[calc(100vh-140px)] flex-col">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm text-white">
            🤖
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand">小北 · AI 职业教练</p>
            <p className="text-xs text-muted-foreground">
              {primaryPath ? `已读取报告 · 主推${primaryPath}` : "在线 · 随时聊聊"}
            </p>
          </div>
          {fullReport && (
            <span className="rounded-full bg-tech-light px-2 py-0.5 text-[10px] font-medium text-tech">
              已读取报告
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
              placeholder={listening ? "正在聆听…" : "和小北聊聊或按麦克风说话..."}
              rows={1}
              className="input-primary resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
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
        <h3 className="text-sm font-semibold text-brand">个人档案</h3>
        {user ? (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">姓名</span>
              <span className="text-sm font-medium text-brand">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">当前角色</span>
              <span className="text-sm text-foreground">{user.currentRole || "未设置"}</span>
            </div>
            {(primaryPath || user.target) && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">主推方向</span>
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">
                  {primaryPath || user.target}
                </span>
              </div>
            )}
            {userSkills.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">核心技能</span>
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
            请先完成探索旅程，建立你的档案～
          </p>
        )}
      </div>

      {/* 转型进度 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">转型进度</h3>
          <span className="text-lg font-semibold text-brand">{progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedCount} / {totalTasks} 已完成</span>
          {report && (
            <span>
              AI 匹配度：
              <span className="font-semibold text-brand">{report.matchScore}</span>/100
            </span>
          )}
        </div>
      </div>

      {/* 行动项 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">行动项</h3>
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
                    {categoryLabels[action.category]}
                  </span>
                  {action.source === "report" && (
                    <span className="inline-flex items-center rounded-full bg-tech-light px-1.5 py-0 text-[10px] font-medium text-tech">
                      AI建议
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteAction(action.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
                aria-label="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
          {actions.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              暂无行动项
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
              <option value="skill">技能</option>
              <option value="task">任务</option>
              <option value="milestone">里程碑</option>
            </select>
            <input
              type="text"
              value={newActionTitle}
              onChange={(e) => setNewActionTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAction()}
              placeholder="添加行动项..."
              className="input-primary py-1.5 text-xs"
            />
          </div>
          <button onClick={addAction} className="btn-primary w-full py-1.5 text-xs">
            添加
          </button>
        </div>
      </div>

      {/* 待掌握技能 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">待掌握技能</h3>
          <span className="chip">{skills.length} 项</span>
        </div>
        {report && (
          <p className="mt-1 text-[10px] text-tech">基于 AI 诊断报告推荐</p>
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
                    <span className="ml-1 rounded-full bg-tech-light px-1.5 py-0 text-[9px] font-medium text-tech">
                      AI
                    </span>
                  )}
                </p>
                <span className={`mt-0.5 inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-medium ${priorityColors[skill.priority]}`}>
                  {priorityLabels[skill.priority]}
                </span>
              </div>
              <button
                onClick={() => removeSkill(skill.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-brand-light hover:text-foreground group-hover:opacity-100"
                aria-label="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M8.75 3.75V4h-3a.75.75 0 000 1.5H6v10A2.5 2.5 0 008.5 18h3a2.5 2.5 0 002.5-2.5v-10h.25a.75.75 0 000-1.5h-3v-.25A1.75 1.75 0 009.5 2h-1a1.75 1.75 0 00-1.75 1.75zM7.5 5.5h5v10a1 1 0 01-1 1h-3a1 1 0 01-1-1v-10z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
          {skills.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              暂无技能
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
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder="添加技能..."
              className="input-primary py-1.5 text-xs"
            />
          </div>
          <button onClick={addSkill} className="btn-primary w-full py-1.5 text-xs">
            添加技能
          </button>
        </div>
      </div>

      {/* 推荐公司 */}
      {fullReport?.recommendedCompanies?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-brand">🏢 推荐公司</h3>
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
        <h3 className="text-sm font-semibold text-brand">快捷入口</h3>
        <div className="mt-3 space-y-2">
          <a
            href="/simulator"
            className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border hover:bg-muted"
          >
            <span className="text-base">🎮</span>
            <span className="text-xs font-medium text-brand">职业模拟器</span>
          </a>
          <a
            href="/onboarding"
            className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 transition-colors hover:border-brand-border hover:bg-muted"
          >
            <span className="text-base">🔄</span>
            <span className="text-xs font-medium text-brand">重新探索</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

function HumanCoachTab() {
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
          <h3 className="text-base font-semibold text-brand">真人 1v1 教练市场</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            按公司、学校、话题找到与你背景相似的过来人。费用平台托管，会话完成后才放款。
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/coach/manage" className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-brand">
            教练管理台
          </a>
          <a href="/coaches" className="rounded-full bg-brand px-5 py-2 text-xs font-medium text-white hover:bg-brand-hover">
            查看全部教练 →
          </a>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">加载教练中…</p>
      ) : coaches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-14 text-center">
          <p className="text-sm text-muted-foreground">市场上还没有教练，成为第一位吧。</p>
          <a href="/become-coach" className="mt-4 inline-block rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            成为教练
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {coaches.map((c) => (
            <a key={c.id} href={`/coaches/${c.id}`}
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
                {c.topic_tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-brand">
                  {c.price_single != null ? `¥${c.price_single}/次` : "私信询价"}
                </span>
                <span className="text-xs text-amber-500">
                  ★ {c.rating_avg ?? "新"}
                  {(c.review_count ?? 0) > 0 && <span className="text-muted-foreground"> ({c.review_count})</span>}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
