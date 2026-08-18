"use client";

import { useState, useRef, useEffect } from "react";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { mockCoaches } from "@/lib/mockData";
import type { CoachProfile } from "@/lib/types";

type TabType = "ai" | "human";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface BookingForm {
  name: string;
  email: string;
  notes: string;
}

const aiResponsePool = [
  "这是一个很好的职业转型问题。让我们先从你的核心优势开始分析——你目前的技能中，哪些是可以直接迁移到新领域的？",
  "我理解你的顾虑。职业转型确实需要系统性的规划，但不必焦虑。我们可以把目标拆解为可执行的小步骤。",
  "根据你的背景，我建议重点关注以下三个方向：技术能力补全、行业知识积累、以及人脉网络拓展。",
  "你提到的这个转型方向很有前景。根据市场数据，这个领域在未来三年内预计会有 30% 的人才需求增长。",
  "让我们做一个具体的能力差距分析。对比目标岗位的 JD，你目前最需要补的技能是什么？",
  "好消息是，你现有的经验并非浪费——它们是你的「差异化优势」。关键是如何讲好你的转型故事。",
  "我建议你在接下来两周内完成三件事：1) 选择一个目标岗位；2) 拆解能力差距；3) 制定学习计划。",
  "很多人在职业转型时犯的错误是同时追多个方向。我建议你聚焦一个主方向，深耕 6-12 个月。",
  "你的转型动机很清晰，这非常重要。动机是支撑你走过转型低谷的核心动力。",
  "让我们用一个具体的例子来梳理思路。假设你要从 A 领域转到 B 领域，你觉得最大的障碍是什么？",
];

const userProfileSummary = {
  name: "张同学",
  currentRole: "市场营销专员",
  targetRole: "AI 产品经理",
  skills: ["项目管理", "用户调研", "数据分析", "内容创作"],
  progress: [
    { label: "AI 基础", status: "completed" as const },
    { label: "产品思维", status: "in-progress" as const },
    { label: "行业调研", status: "in-progress" as const },
    { label: "实战项目", status: "not-started" as const },
  ],
  overallProgress: 45,
};

function generateAIResponse(userMessage: string): string {
  const idx = Math.floor(Math.random() * aiResponsePool.length);
  const base = aiResponsePool[idx];
  return `${base}\n\n（你刚才说"${userMessage.slice(0, 30)}${userMessage.length > 30 ? "..." : ""}"——我已经记录下来了，后续会结合你的情况持续跟进。）`;
}

export default function CoachPage() {
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8">
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是你的 AI 职业教练 🤖\n\n我可以帮你梳理职业转型思路、分析能力差距、制定行动计划。有什么想聊的？",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } =
    useVoiceInput({
      onFinal: (text) => {
        setInput((prev) => (prev ? prev + " " + text : text));
      },
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: generateAIResponse(trimmed),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
            {[
              "如何评估我转型的可行性？",
              "AI 产品经理需要哪些核心技能？",
              "如何制定 3 个月的转型计划？",
            ].map((suggestion) => (
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

      <ContextPanel />
    </div>
  );
}

function ContextPanel() {
  const statusConfig = {
    completed: { label: "已完成", className: "bg-emerald-100 text-emerald-700" },
    "in-progress": {
      label: "进行中",
      className: "bg-amber-100 text-amber-700",
    },
    "not-started": { label: "未开始", className: "bg-brand-light text-muted-foreground" },
  };

  return (
    <aside className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-semibold text-brand">个人档案</h3>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">姓名</p>
            <p className="text-sm font-medium text-brand">
              {userProfileSummary.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前角色</p>
            <p className="text-sm text-foreground">
              {userProfileSummary.currentRole}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">目标角色</p>
            <p className="text-sm font-medium text-brand">
              {userProfileSummary.targetRole}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">核心技能</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {userProfileSummary.skills.map((skill) => (
                <span key={skill} className="chip">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand">转型进度</h3>
          <span className="text-sm font-semibold text-brand">
            {userProfileSummary.overallProgress}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${userProfileSummary.overallProgress}%` }}
          />
        </div>
        <div className="mt-4 space-y-2.5">
          {userProfileSummary.progress.map((item) => {
            const cfg = statusConfig[item.status];
            return (
              <div
                key={item.label}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-brand">AI 建议</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>本周重点完成 AI 基础课程的最后一章</span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>尝试用 Prompt Engineering 完成一个小项目</span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>预约一次真人教练辅导，校准方向</span>
          </li>
        </ul>
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