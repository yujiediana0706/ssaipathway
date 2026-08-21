"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { mockCoaches } from "@/lib/mockData";
import { getStoredUser, type StoredUser } from "@/lib/userStore";
import { getStoredReport, type SavedReport } from "@/lib/reportStore";
import type { CoachProfile } from "@/lib/types";

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

const COACH_SYS_PROMPT = `你是Pathway AI职业教练，温暖、专业、善于倾听。
用口语化中文回复，简洁有力，像朋友一样给建议。
不要用markdown、不要用编号列表、不要用标题。
每段回复控制在150字以内。
针对用户的职业转型问题给出具体可操作的建议。
如果用户犹豫或焦虑，先共情再引导。`;

const ACTION_ITEMS_KEY = "pathway:action-items";
const SKILL_ITEMS_KEY = "pathway:skill-items";

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
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">
            教练中心
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            与 AI 教练随时对话，或预约真人教练进行深度辅导
          </p>
        </header>

        <div className="mb-6 inline-flex rounded-full border border-border bg-white p-1">
          <button
            onClick={() => setActiveTab("ai")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              activeTab === "ai"
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-brand"
            }`}
          >
            AI 教练
          </button>
          <button
            onClick={() => setActiveTab("human")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              activeTab === "human"
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-brand"
            }`}
          >
            真人教练
          </button>
        </div>

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (u?.name) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            `你好${u.name}！我是你的 AI 职业教练 🤖\n\n我看了你的档案——目前是${u.currentRole || "职场人"}，` +
            `${u.target ? `想转${u.target}。` : "正在探索方向。"}` +
            `有什么想聊的？`,
          timestamp: new Date(),
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "你好！我是你的 AI 职业教练 🤖\n\n我可以帮你梳理职业转型思路、分析能力差距、制定行动计划。有什么想聊的？",
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
    if (!user) return COACH_SYS_PROMPT;
    const parts: string[] = [];
    if (user.name) parts.push(`姓名：${user.name}`);
    if (user.currentRole) parts.push(`当前岗位：${user.currentRole}`);
    if (user.target) parts.push(`目标岗位：${user.target}`);
    if (user.skills) parts.push(`技能：${user.skills}`);
    if (user.interests) parts.push(`兴趣方向：${user.interests}`);
    if (user.personality) parts.push(`性格画像：${user.personality}`);
    if (user.type) parts.push(`模式：${user.type === "A" ? "探索模式" : "定向模式"}`);

    return `${COACH_SYS_PROMPT}\n\n用户档案：${parts.join("；")}。请结合以上信息给出个性化建议。`;
  }, [user]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: buildSystemPrompt,
          maxTokens: 300,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      let content = (data.content || "").trim();
      content = content
        .replace(/[#*`>_~\-]/g, "")
        .replace(/^\d+[\.\)、]\s*/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (content.length > 200) {
        const truncated = content.slice(0, 200);
        const lastPunct = Math.max(
          truncated.lastIndexOf("。"),
          truncated.lastIndexOf("！"),
          truncated.lastIndexOf("？"),
          truncated.lastIndexOf("，")
        );
        content = (lastPunct > 100 ? truncated.slice(0, lastPunct + 1) : truncated.slice(0, 200)) + "…";
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: content || "嗯，这个问题我想想…你能具体说说你的情况吗？",
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
  }, [user]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="card flex h-[calc(100vh-220px)] flex-col">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm text-white">
            🤖
          </div>
          <div>
            <p className="text-sm font-medium text-brand">AI 职业教练</p>
            <p className="text-xs text-muted-foreground">
              在线 · 基于你的转型目标提供个性化建议
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-6 pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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

        <div className="border-t border-border pt-4">
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
              placeholder={listening ? "正在聆听…" : "和 AI 教练聊聊或按麦克风说话..."}
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
          <div className="mt-3 flex flex-wrap gap-2">
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

      <DashboardPanel />
    </div>
  );
}

function DashboardPanel() {
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
    <aside className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
      {/* 个人档案 */}
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
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">目标角色</span>
              <span className="text-sm font-medium text-brand">{user.target || "探索中"}</span>
            </div>
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
  const [selectedCoach, setSelectedCoach] = useState<CoachProfile | null>(
    null
  );

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mockCoaches.map((coach) => (
          <CoachCard
            key={coach.id}
            coach={coach}
            onBook={() => setSelectedCoach(coach)}
          />
        ))}
      </div>

      {selectedCoach && (
        <BookingModal
          coach={selectedCoach}
          onClose={() => setSelectedCoach(null)}
        />
      )}
    </div>
  );
}

function CoachCard({
  coach,
  onBook,
}: {
  coach: CoachProfile;
  onBook: () => void;
}) {
  return (
    <div className="card flex flex-col transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <img
          src={coach.avatar}
          alt={coach.name}
          className="h-14 w-14 shrink-0 rounded-full border border-border bg-brand-light"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-brand">
              {coach.name}
            </h3>
            <span className="flex items-center gap-0.5 text-xs font-medium text-amber-500">
              ★ {coach.rating}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {coach.headline}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="chip">{coach.industry}</span>
        <span className="chip">{coach.yearsExperience} 年经验</span>
        <span className="chip">{coach.sessionsCount} 次辅导</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground"> rates</p>
          <p className="text-lg font-semibold text-brand">
            ¥{coach.ratePerHour}
            <span className="text-sm font-normal text-muted-foreground">/小时</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">可预约</p>
          <p className="text-sm font-medium text-emerald-600">
            {coach.availableSlots.length} 个时段
          </p>
        </div>
      </div>

      <button
        onClick={onBook}
        className="mt-4 btn-primary w-full"
      >
        预约
      </button>
    </div>
  );
}

function BookingModal({
  coach,
  onClose,
}: {
  coach: CoachProfile;
  onClose: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [form, setForm] = useState<BookingForm>({
    name: "",
    email: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !form.name || !form.email) return;
    setSubmitted(true);
  };

  const formatSlot = (slot: { day: string; time: string }) =>
    `${slot.day} ${slot.time}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-light hover:text-muted-foreground"
        >
          ✕
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <img
              src={coach.avatar}
              alt={coach.name}
              className="h-12 w-12 rounded-full border border-border bg-brand-light"
            />
            <div>
              <h2 className="text-lg font-semibold text-brand">
                预约 {coach.name}
              </h2>
              <p className="text-sm text-muted-foreground">{coach.headline}</p>
            </div>
          </div>

          {submitted ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                ✓
              </div>
              <h3 className="mt-3 text-base font-semibold text-emerald-900">
                预约成功！
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                {coach.name} 将在 {selectedSlot} 与你联系
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                我们已将确认邮件发送至 {form.email}
              </p>
              <button
                onClick={onClose}
                className="mt-5 btn-primary"
              >
                完成
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  选择时段
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {coach.availableSlots.map((slot) => {
                    const key = formatSlot(slot);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSlot(key)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                          selectedSlot === key
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-white text-foreground hover:border-brand-border"
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  姓名
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="请输入你的姓名"
                  className="input-primary"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  邮箱
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="your@email.com"
                  className="input-primary"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  备注（选填）
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="告诉教练你希望讨论的话题..."
                  rows={3}
                  className="input-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">费用</p>
                  <p className="text-lg font-semibold text-brand">
                    ¥{coach.ratePerHour}
                    <span className="text-sm font-normal text-muted-foreground">
                      /小时
                    </span>
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!selectedSlot || !form.name || !form.email}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  确认预约
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
