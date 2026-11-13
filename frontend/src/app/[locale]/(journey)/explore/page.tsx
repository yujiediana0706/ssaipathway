"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceButton from "@/components/VoiceButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { storeUser, syncUserToSupabase, getAnonId, type StoredUser } from "@/lib/userStore";

/* ───────────────────────────────────────────────
 *  8 个固定问题（前 6 职业风格 + 后 2 日常有趣）
 *  每个选项 → archetype 加分
 * ─────────────────────────────────────────────── */

type ArchetypeKey = "commander" | "strategist" | "mediator" | "architect" | "adventurer" | "mentor";

interface QOption {
  key: string;
  score: Partial<Record<ArchetypeKey, number>>;
}

interface FixedQuestion {
  id: string;
  options: QOption[];
}

const FIXED_QUESTIONS: FixedQuestion[] = [
  {
    id: "q1_decision",
    options: [
      { key: "a", score: { strategist: 3, architect: 2 } },
      { key: "b", score: { mediator: 3, mentor: 2 } },
      { key: "c", score: { adventurer: 3, commander: 2 } },
      { key: "d", score: { architect: 3, strategist: 1 } },
    ],
  },
  {
    id: "q2_pressure",
    options: [
      { key: "a", score: { architect: 3, mentor: 1 } },
      { key: "b", score: { adventurer: 3, commander: 2 } },
      { key: "c", score: { mediator: 3, mentor: 2 } },
      { key: "d", score: { commander: 3, strategist: 2 } },
    ],
  },
  {
    id: "q3_communication",
    options: [
      { key: "a", score: { architect: 3, strategist: 2 } },
      { key: "b", score: { mediator: 2, strategist: 3 } },
      { key: "c", score: { adventurer: 3, commander: 1 } },
      { key: "d", score: { architect: 2, commander: 2, strategist: 1 } },
    ],
  },
  {
    id: "q4_rhythm",
    options: [
      { key: "a", score: { architect: 3, mentor: 1 } },
      { key: "b", score: { strategist: 2, commander: 2 } },
      { key: "c", score: { adventurer: 3, commander: 2 } },
      { key: "d", score: { architect: 2, strategist: 2 } },
    ],
  },
  {
    id: "q5_team",
    options: [
      { key: "a", score: { commander: 4 } },
      { key: "b", score: { strategist: 4 } },
      { key: "c", score: { mediator: 4 } },
      { key: "d", score: { architect: 4 } },
    ],
  },
  {
    id: "q6_change",
    options: [
      { key: "a", score: { commander: 3, adventurer: 2 } },
      { key: "b", score: { strategist: 4 } },
      { key: "c", score: { mediator: 3, mentor: 2 } },
      { key: "d", score: { architect: 3, strategist: 1 } },
    ],
  },
  {
    id: "q7_weekend",
    options: [
      { key: "a", score: { strategist: 3, architect: 2 } },
      { key: "b", score: { adventurer: 4 } },
      { key: "c", score: { mediator: 3, mentor: 2 } },
      { key: "d", score: { mediator: 2, architect: 2 } },
    ],
  },
  {
    id: "q8_freeday",
    options: [
      { key: "a", score: { commander: 3, adventurer: 1 } },
      { key: "b", score: { strategist: 3, architect: 2 } },
      { key: "c", score: { mentor: 3, mediator: 2 } },
      { key: "d", score: { adventurer: 2, mediator: 1, architect: 1 } },
    ],
  },
];

const TOTAL_FIXED_QUESTIONS = FIXED_QUESTIONS.length;

/* ───────────────────────────────────────────────
 *  通用类型 & 工具
 * ─────────────────────────────────────────────── */

type MessageRole = "ai" | "user" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

type FlowStage =
  | "welcome"
  | "questions"  // 固定 8 问
  | "free_chat"  // 自由发言
  | "resume"     // 上传简历
  | "final_note" // 最后的话（如果用户跳过了自由发言，可以在这里补）
  | "generating";

interface ExploreProfile {
  // 从 onboarding 继承
  type: "A" | "B" | null;
  name: string;
  currentRole: string;
  years: string;
  target: string;

  // 8 问结果
  answers: Record<string, { label: string; score: Partial<Record<ArchetypeKey, number>> }>;

  // 自由发言 & 简历
  freeChat: string;
  resumeFileName: string;
  resumeStoragePath: string;
  hasResume: boolean;
  finalNote: string;

  // 最终人格原型（由 8 问汇总）
  finalArchetype: ArchetypeKey | null;
  // 分数明细，展示在报告里
  archetypeScores: Record<ArchetypeKey, number>;
}

const emptyProfile = (): ExploreProfile => ({
  type: null,
  name: "",
  currentRole: "",
  years: "",
  target: "",
  answers: {},
  freeChat: "",
  resumeFileName: "",
  resumeStoragePath: "",
  hasResume: false,
  finalNote: "",
  finalArchetype: null,
  archetypeScores: { commander: 0, strategist: 0, mediator: 0, architect: 0, adventurer: 0, mentor: 0 },
});

const uid = () => Math.random().toString(36).slice(2, 10);

const COACH_SYS =
  "你是'小北 coach'，Pathway 的职业发展教练。性格温暖、有趣、口语化，像朋友一样聊天。先回应用户刚才的回答（共情/肯定/小幽默），然后自然地带出下一个问题。30字以内，不要 markdown，不要标题。";

/* ───────────────────────────────────────────────
 *  简历上传：通过服务端 API（service role key，绕过 RLS）
 * ─────────────────────────────────────────────── */

async function uploadResumeToStorage(
  file: File,
  userName: string
): Promise<{ path: string; name: string } | null> {
  if (typeof window === "undefined") return null;
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userName", userName || "user");
    // 延迟注册：匿名上传用 anonId 隔离路径
    formData.append("anonId", getAnonId());

    const res = await fetch("/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[Resume] Upload failed:", res.status, errText);
      return null;
    }
    const data = await res.json();
    return { path: data.path, name: data.name };
  } catch (err) {
    console.warn("[Resume] Upload error:", err);
    return null;
  }
}

/* ───────────────────────────────────────────────
 *  汇总 8 问 → archetype
 * ─────────────────────────────────────────────── */

function computeArchetype(answers: ExploreProfile["answers"]): {
  final: ArchetypeKey;
  scores: Record<ArchetypeKey, number>;
} {
  const scores: Record<ArchetypeKey, number> = {
    commander: 0, strategist: 0, mediator: 0, architect: 0, adventurer: 0, mentor: 0,
  };
  Object.values(answers).forEach((a) => {
    Object.entries(a.score).forEach(([k, v]) => {
      scores[k as ArchetypeKey] += v || 0;
    });
  });
  // 随机 tiebreak
  const entries = Object.entries(scores) as [ArchetypeKey, number][];
  entries.sort((a, b) => b[1] - a[1] + (Math.random() - 0.5) * 0.001);
  return { final: entries[0][0], scores };
}

/* ───────────────────────────────────────────────
 *  Page
 * ─────────────────────────────────────────────── */

export default function ExplorePage() {
  const t = useTranslations("explore");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          {t("loading")}
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarded = searchParams.get("onboarded") === "1";

  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState<FlowStage>("welcome");
  const [questionIndex, setQuestionIndex] = useState(0); // 0..8
  const [profile, setProfile] = useState<ExploreProfile>(() => {
    const name = searchParams.get("name") || "";
    const role = searchParams.get("role") || "";
    const years = searchParams.get("years") || "";
    const target = searchParams.get("target") || "";
    const type = (searchParams.get("type") as "A" | "B") || null;
    return {
      ...emptyProfile(),
      name, currentRole: role, years, target, type,
    };
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const initializedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questionText = (q: FixedQuestion) => t(`questions.${q.id}.text`);
  const questionHint = (q: FixedQuestion) => t(`questions.${q.id}.hint`);
  const optionLabel = (q: FixedQuestion, opt: QOption) => t(`questions.${q.id}.options.${opt.key}`);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } =
    useVoiceInput({
      onFinal: (text) => setInput((prev) => (prev ? prev + " " + text : text)),
    });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, generating]);

  /* 欢迎 → 直接进入第一题 */
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const name = profile.name?.trim() ? profile.name : t("chat.greetingFallback");
    aiSay(t("chat.greeting", { name }));
    setTimeout(() => {
      askQuestion(0);
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushMessage = (msg: Omit<Message, "id">) =>
    setMessages((prev) => [...prev, { ...msg, id: uid() }]);

  const aiSay = async (content: string) => {
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 250));
    setIsTyping(false);
    pushMessage({ role: "ai", content });
  };

  /** 调用 AI 生成「用户回答回应 + 下一题引入」 */
  const fetchAIBridge = async (
    userAnswerLabel: string,
    nextQuestionText: string,
    nextQuestionHint: string,
    questionNo: number,
  ): Promise<string> => {
    const ctx = [
      profile.name ? `用户叫${profile.name}` : "",
      profile.currentRole ? `现在做${profile.currentRole}` : "",
      profile.years ? `工作${profile.years}` : "",
      profile.target ? `想转${profile.target}` : "",
    ].filter(Boolean).join("，");
    const prompt = `用户背景：${ctx || "未知"}。
用户对第 ${questionNo} 题的回答是：「${userAnswerLabel}」。
下一题是：「${nextQuestionText}」（${nextQuestionHint}）。
要求：先 1 句话共情/肯定用户的回答，然后自然地问出下一题。整体 30 字以内，口语化。`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          systemPrompt: COACH_SYS,
          maxTokens: 100,
          locale,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      let content = (data.content || "").trim()
        .replace(/[#*`>_~\-]/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
      if (content.length > 60) content = content.slice(0, 60);
      return content;
    } catch {
      return "";
    }
  };

  const askQuestion = (index: number) => {
    const q = FIXED_QUESTIONS[index];
    if (!q) return;
    setQuestionIndex(index);
    setStage("questions");
  };

  /** 用户选择了 8 问中的一个选项 */
  const selectAnswer = async (qIndex: number, optIndex: number) => {
    if (isAdvancing) return;
    const q = FIXED_QUESTIONS[qIndex];
    if (!q) return;
    const option = q.options[optIndex];
    const label = optionLabel(q, option);

    setIsAdvancing(true);
    try {
      // 保存答案
      const newAnswers = {
        ...profile.answers,
        [q.id]: { label, score: option.score },
      };
      setProfile((p) => ({ ...p, answers: newAnswers }));
      pushMessage({ role: "user", content: label });

      // 判断是不是最后一题
      const isLast = qIndex >= TOTAL_FIXED_QUESTIONS - 1;

      // AI 先回应，再引入下一阶段
      if (isLast) {
        // 最后一个选择题回答完 → 进入自由发言，提一个有指向性的问题
        const ctx = [
          profile.name ? `用户叫${profile.name}` : "",
          profile.currentRole ? `现在做${profile.currentRole}` : "",
          profile.years ? `工作${profile.years}` : "",
          profile.target ? `想转${profile.target}` : "",
        ].filter(Boolean).join("，");
        const bridgePrompt = `用户背景：${ctx || "未知"}。
用户刚完成了8道性格选择题，最后一题的回答是：「${label}」。
现在要进入自由发言环节。请提一个有指向性的、和职业转型相关的开放问题，让用户可以具体回答。
比如："如果现在有一个转型的机会摆在你面前，你最担心的是什么？"或者"回想一下你工作中最有成就感的一件事，是什么让你印象深刻？"或者"如果要在3个月内开始转型，你觉得最大的阻碍会是什么？"
要求：只问这一个问题，口语化，35字以内。不要说"随便聊聊"之类的话。`;
        let bridge = "";
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: bridgePrompt }],
              systemPrompt: COACH_SYS,
              maxTokens: 100,
              locale,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            bridge = (data.content || "").trim()
              .replace(/[#*`>_~\-]/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
            if (bridge.length > 70) bridge = bridge.slice(0, 70);
          }
        } catch { /* ignore */ }
        aiSay(bridge || t("chat.afterQuestions"));
        // 汇总 archetype
        const { final, scores } = computeArchetype(newAnswers);
        setProfile((p) => ({ ...p, finalArchetype: final, archetypeScores: scores }));
        setStage("free_chat");
      } else {
        const nextQ = FIXED_QUESTIONS[qIndex + 1];
        const bridge = await fetchAIBridge(
          label,
          questionText(nextQ),
          questionHint(nextQ),
          qIndex + 1,
        );
        await aiSay(bridge || questionText(nextQ));
        askQuestion(qIndex + 1);
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  /** 自由发言：提交文字 */
  const submitFreeChat = async () => {
    const text = input.trim();
    if (!text || isAdvancing) return;
    setIsAdvancing(true);
    try {
      pushMessage({ role: "user", content: text });
      setProfile((p) => ({
        ...p,
        freeChat: p.freeChat ? p.freeChat + "\n" + text : text,
      }));
      setInput("");
      // AI 回应一句，然后引导到简历
      aiSay(t("chat.freeChatDone"));
      setStage("resume");
    } finally {
      setIsAdvancing(false);
    }
  };

  const skipFreeChat = () => {
    if (isAdvancing) return;
    pushMessage({ role: "user", content: t("chat.skipFreeChatUser") });
    aiSay(t("chat.skipFreeChatAi"));
    setStage("resume");
  };

  /** 简历上传 */
  const handleFileUpload = async (file: File) => {
    if (isAdvancing || !file) return;
    setIsAdvancing(true);
    try {
      // 通过服务端 API 上传到 Supabase Storage
      const up = await uploadResumeToStorage(file, profile.name);
      if (up?.path) {
        setProfile((p) => ({
          ...p,
          hasResume: true,
          resumeFileName: file.name,
          resumeStoragePath: up.path,
        }));
        pushMessage({ role: "user", content: t("chat.resumeUploadedUser", { name: file.name }) });
        aiSay(t("chat.resumeUploadedAi"));
      } else {
        // 上传失败：不阻塞流程，但告知用户
        setProfile((p) => ({
          ...p,
          hasResume: false,
          resumeFileName: file.name,
          resumeStoragePath: "",
        }));
        pushMessage({ role: "user", content: t("chat.resumeSelectedUser", { name: file.name }) });
        aiSay(t("chat.resumeFailedAi"));
      }
      setStage("final_note");
    } finally {
      setIsAdvancing(false);
    }
  };

  const skipResume = () => {
    if (isAdvancing) return;
    pushMessage({ role: "user", content: t("chat.skipResumeUser") });
    aiSay(t("chat.skipResumeAi"));
    setStage("final_note");
  };

  /** 最后的留言（选填）→ 直接生成报告 */
  const submitFinal = async () => {
    const text = input.trim();
    if (text) pushMessage({ role: "user", content: text });
    setProfile((p) => ({
      ...p,
      finalNote: text ? (p.finalNote ? p.finalNote + "\n" + text : text) : p.finalNote,
    }));
    setInput("");
    beginGenerate();
  };

  const skipFinal = () => beginGenerate();

  /* 生成报告 */
  const beginGenerate = () => {
    setStage("generating");
    setGenerating(true);
    pushMessage({ role: "system", content: t("chat.generating") });

    setTimeout(async () => {
      // 汇总 archetype（万一有 bug 没算）
      let archetype = profile.finalArchetype;
      let scores = profile.archetypeScores;
      if (!archetype) {
        const r = computeArchetype(profile.answers);
        archetype = r.final;
        scores = r.scores;
      }
      const personalityTag = `archetype:${archetype}`;

      // 构建 StoredUser（含 8 问选择详情、简历路径、最终留言）
      const now = Date.now();
      const userData: StoredUser & { exploreDetail?: any } = {
        id: undefined as any,
        name: profile.name,
        currentRole: profile.currentRole,
        years: profile.years,
        skills: "", // 报告里再生成
        interests: "",
        target: profile.target,
        type: profile.type,
        personality: personalityTag,
        coachNote: [profile.freeChat, profile.finalNote].filter(Boolean).join("\n") || "",
        resumeFileName: profile.resumeFileName,
        resumeStoragePath: profile.resumeStoragePath,
        createdAt: now,
        updatedAt: now,
        exploreDetail: {
          answers: Object.fromEntries(
            Object.entries(profile.answers).map(([k, v]) => [k, v.label])
          ),
          archetypeScores: scores,
        },
      };

      // 先存 localStorage
      storeUser(userData);

      // 同步到 Supabase
      try {
        const userId = await syncUserToSupabase(userData);
        if (userId) {
          userData.id = userId as any;
          console.info("[Pathway] User synced:", userId);
        }
      } catch (err) {
        console.warn("[Pathway] Supabase sync failed:", err);
      }

      // 带参数跳 report 页（报告页还会读 localStorage 更完整的详情）
      const params = new URLSearchParams({
        type: profile.type || "A",
        name: profile.name,
        role: profile.currentRole,
        years: profile.years,
        personality: personalityTag,
        archetype: archetype,
      });
      if (profile.target) params.set("target", profile.target);
      if (profile.freeChat || profile.finalNote)
        params.set("note", [profile.freeChat, profile.finalNote].filter(Boolean).join(" "));
      if (profile.resumeStoragePath) params.set("resume", profile.resumeStoragePath);
      router.push(`/report?${params.toString()}`);
    }, 1600);
  };

  /* ─── 渲染 ─── */

  const lastMsg = messages[messages.length - 1];
  const currentQ = FIXED_QUESTIONS[questionIndex];

  const showOptions = stage === "questions" && currentQ && !isAdvancing && lastMsg?.role === "ai";

  const showFreeInput =
    (stage === "free_chat" || stage === "final_note") && !isAdvancing && lastMsg?.role === "ai";

  const showResumeButtons = stage === "resume" && !isAdvancing && lastMsg?.role === "ai";

  const progressPct = useMemo(() => {
    if (stage === "welcome") return 0;
    if (stage === "questions") return Math.round(((questionIndex + 1) / (TOTAL_FIXED_QUESTIONS + 3)) * 100);
    if (stage === "free_chat") return Math.round(((TOTAL_FIXED_QUESTIONS + 1) / (TOTAL_FIXED_QUESTIONS + 3)) * 100);
    if (stage === "resume") return Math.round(((TOTAL_FIXED_QUESTIONS + 2) / (TOTAL_FIXED_QUESTIONS + 3)) * 100);
    if (stage === "final_note") return 92;
    return 100;
  }, [stage, questionIndex]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header + progress */}
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="h-1 w-full bg-brand-border">
          <div
            className="h-full bg-brand transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🧭</span>
            <span className="font-semibold text-brand text-sm">{t("header.title")}</span>
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] text-muted-foreground">
              {stage === "questions"
                ? `${questionIndex + 1} / ${TOTAL_FIXED_QUESTIONS}`
                : stage === "free_chat"
                ? t("header.stage.freeChat")
                : stage === "resume"
                ? t("header.stage.resume")
                : stage === "final_note"
                ? t("header.stage.finalNote")
                : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <button
              onClick={() => {
                router.push("/onboarding");
              }}
              className="text-xs text-muted-foreground hover:text-brand"
            >
              {t("header.back")}
            </button>
          </div>
        </div>
      </header>

      {/* 消息滚动区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 self-start rounded-xl bg-brand-light px-3 py-2 text-muted-foreground">
              <TypingDots />
            </div>
          )}
          {generating && !isTyping && (
            <div className="mx-auto mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-white px-8 py-8 text-center">
              <div className="flex gap-1.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"></span>
              </div>
              <div className="text-sm font-medium text-brand">{t("chat.generatingBanner")}</div>
            </div>
          )}
        </div>
      </div>

      {/* 底部交互区 */}
      <div className="border-t border-border bg-white">
        <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4">
          {/* 选项 UI：2x2 网格，和 onboarding 风格对齐 */}
          {showOptions && currentQ && (
            <div className="mb-2">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight text-brand">
                  {questionText(currentQ)}
                </h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{questionHint(currentQ)}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(questionIndex, idx)}
                    className="group rounded-2xl border border-border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-sm active:translate-y-0"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-light text-[10px] font-semibold text-brand group-hover:bg-brand group-hover:text-white">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-brand leading-relaxed">
                      {optionLabel(currentQ, opt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 自由发言 / 最后留言 input */}
          {showFreeInput && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {stage === "free_chat"
                  ? t("input.freeChatHint")
                  : t("input.finalNoteHint")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  stage === "free_chat" ? submitFreeChat() : submitFinal();
                }}
                className="flex items-end gap-2 rounded-xl border border-border bg-muted p-1.5 focus-within:border-brand"
              >
                {voiceSupported && (
                  <VoiceButton
                    listening={listening}
                    supported={voiceSupported}
                    onClick={toggleVoice}
                  />
                )}
                <textarea
                  rows={1}
                  value={input + (interim ? " " + interim : "")}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      stage === "free_chat" ? submitFreeChat() : submitFinal();
                    }
                  }}
                  placeholder={
                    listening
                      ? t("input.placeholderListening")
                      : stage === "free_chat"
                      ? t("input.placeholderFreeChat")
                      : t("input.placeholderFinalNote")
                  }
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-brand outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
                >
                  {t("input.send")}
                </button>
              </form>
              <div className="flex justify-end">
                <button
                  onClick={stage === "free_chat" ? skipFreeChat : skipFinal}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-brand hover:underline"
                >
                  {t("input.skip")}
                </button>
              </div>
            </div>
          )}

          {/* 简历上传按钮 */}
          {showResumeButtons && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("resume.hint")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-brand bg-brand-light px-5 py-2 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
                >
                  {t("resume.upload")}
                </button>
                <button
                  onClick={skipResume}
                  className="rounded-full border border-border bg-white px-5 py-2 text-xs text-foreground transition hover:border-brand"
                >
                  {t("resume.later")}
                </button>
                {profile.resumeFileName && (
                  <span className="self-center text-xs text-muted-foreground">
                    {t("resume.selected", { name: profile.resumeFileName })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    );
  }
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-brand text-white"
            : "rounded-bl-sm bg-brand-light text-foreground"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></span>
      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></span>
      <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground"></span>
    </span>
  );
}
