"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceButton from "@/components/VoiceButton";
import { storeUser, syncUserToSupabase } from "@/lib/userStore";

type MessageRole = "ai" | "user" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  options?: string[];
  allowInput?: boolean;
  multiSelect?: boolean;
  cardOptions?: { emoji: string; label: string; desc: string }[];
  fileUpload?: boolean;
  allowOtherInput?: boolean;
}

type FlowStage =
  | "intro"
  | "name"
  | "current_role"
  | "coffee"
  | "years"
  | "skills"
  | "tarot"
  | "interests"
  | "target"
  | "resume"
  | "final"
  | "generating";

interface UserProfile {
  type: "A" | "B" | null;
  name: string;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  target: string;
  personality: string;
  coffee: string;
  tarot: string;
  resumeFileName: string;
  hasResume: boolean;
  coachNote: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const ROLE_OPTIONS = [
  "产品经理", "数据分析师", "工程师", "设计师",
  "市场/运营", "教师/培训", "咨询顾问", "学生",
  "自由职业", "其他",
];

const SKILL_OPTIONS = [
  "数据分析", "Python", "SQL", "项目管理",
  "产品设计", "用户调研", "内容创作", "商业分析",
  "团队协作", "客户沟通", "敏捷开发", "用户体验",
];

const INTEREST_OPTIONS = [
  "AI 应用", "产品创新", "设计思维", "数据科学",
  "内容创作", "教育培训", "商业创业", "社会影响",
  "心理学", "用户研究", "可持续发展", "游戏化",
];

const COFFEE_CARDS = [
  { emoji: "☕", label: "浓缩咖啡", desc: "直接高效" },
  { emoji: "🍵", label: "抹茶拿铁", desc: "外柔内刚" },
  { emoji: "🧋", label: "珍珠奶茶", desc: "多元有趣" },
  { emoji: "🍺", label: "手工啤酒", desc: "独立思考" },
  { emoji: "🥤", label: "能量饮料", desc: "越忙越精神" },
  { emoji: "🏠", label: "手冲咖啡", desc: "享受过程" },
];

const TAROT_CARDS = [
  { emoji: "🌅", label: "太阳", desc: "乐观开朗" },
  { emoji: "🌙", label: "月亮", desc: "直觉敏锐" },
  { emoji: "⚡", label: "闪电", desc: "行动派" },
  { emoji: "🌲", label: "星星", desc: "长期主义" },
  { emoji: "🔮", label: "水晶球", desc: "跨界思考" },
  { emoji: "🎭", label: "愚人", desc: "敢于冒险" },
];

const TARGET_ROLE_OPTIONS = [
  "AI 产品经理", "数据科学家", "AI 工程师",
  "UX 研究员", "增长产品", "技术作家",
  "AI 应用开发者", "数据工程师", "产品设计师",
];

const COACH_SYS = "你是Pathway AI职业教练，温暖有趣，口语化回复，30字以内，不要markdown。";

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">加载中…</div>}>
      <ExploreInner />
    </Suspense>
  );
}

function ExploreInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarded = searchParams.get("onboarded") === "1";

  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState<FlowStage>("intro");
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (onboarded) {
      const type = (searchParams.get("type") as "A" | "B") || null;
      return {
        type,
        name: searchParams.get("name") || "",
        currentRole: searchParams.get("role") || "",
        years: searchParams.get("years") || "",
        skills: "", interests: "", target: "",
        personality: "", coffee: "", tarot: "",
        resumeFileName: "", hasResume: false, coachNote: "",
      };
    }
    return {
      type: null, name: "", currentRole: "", years: "",
      skills: "", interests: "", target: "",
      personality: "", coffee: "", tarot: "",
      resumeFileName: "", hasResume: false, coachNote: "",
    };
  });

  const [input, setInput] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const initializedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } =
    useVoiceInput({
      onFinal: (text) => {
        setInput((prev) => (prev ? prev + " " + text : text));
      },
    });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping, generating]);

  useEffect(() => {
    if (initializedRef.current || !onboarded) return;
    initializedRef.current = true;
    setStage("current_role");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      pushMessage({
        role: "ai",
        content: searchParams.get("name")
            ? `欢迎回来${searchParams.get("name")}～先确认下你现在的岗位~`
            : "欢迎回来！先确认下你现在的岗位~",
        options: ROLE_OPTIONS,
        allowOtherInput: true,
      });
    }, 500);
  }, [onboarded]);

  const pushMessage = (msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: uid() }]);
  };

  const fetchAIReply = async (
    userAnswer: string,
    nextQuestion: string,
    ctx: {
      name?: string;
      currentRole?: string;
      coffeeLabel?: string;
      coffeeDesc?: string;
      years?: string;
      skills?: string;
    }
  ): Promise<string> => {
    const parts: string[] = [];
    if (ctx.name) parts.push(`名字是${ctx.name}`);
    if (ctx.currentRole) parts.push(`现在做${ctx.currentRole}`);
    if (ctx.coffeeLabel) parts.push(`选了${ctx.coffeeLabel}（${ctx.coffeeDesc}）`);
    if (ctx.years) parts.push(`工作${ctx.years}`);
    if (ctx.skills) parts.push(`技能有${ctx.skills}`);
    const contextStr = parts.join("，");

    const prompt = `背景：用户${contextStr}。
用户刚回答："${userAnswer}"。
要求：先回应用户的回答，然后自然地问这句话："${nextQuestion}"。30字以内。`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          systemPrompt: COACH_SYS,
          maxTokens: 100,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      let content = (data.content || "").trim();
      content = content
        .replace(/[#*`>_~\-]/g, "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (content.length > 40) content = content.slice(0, 40);
      return content;
    } catch {
      return "";
    }
  };

  const aiSay = async (
    content: string,
    opts?: {
      options?: string[];
      allowInput?: boolean;
      multiSelect?: boolean;
      cardOptions?: { emoji: string; label: string; desc: string }[];
      fileUpload?: boolean;
      allowOtherInput?: boolean;
    }
  ) => {
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    setIsTyping(false);
    pushMessage({
      role: "ai",
      content,
      options: opts?.options,
      allowInput: opts?.allowInput,
      multiSelect: opts?.multiSelect,
      cardOptions: opts?.cardOptions,
      fileUpload: opts?.fileUpload,
      allowOtherInput: opts?.allowOtherInput,
    });
  };

  const startFlow = (type: "A" | "B") => {
    setProfile((p) => ({ ...p, type }));
    pushMessage({
      role: "user",
      content:
        type === "A"
          ? "我还在探索，没有明确转型方向"
          : "我已经有想要转的目标方向",
    });

    setTimeout(() => {
      aiSay(
        type === "A"
          ? "好的，探索模式！你叫什么名字？"
          : "定向模式走起！你叫什么名字？",
        { allowInput: true }
      );
      setStage("name");
    }, 400);
  };

  const handleUserInput = async () => {
    if (isAdvancing) return;
    const text = input.trim();
    if (!text) return;
    pushMessage({ role: "user", content: text });
    setInput("");
    await advanceStage(text);
  };

  const selectOption = async (option: string) => {
    if (isAdvancing) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.multiSelect) {
      const newSelected = selectedOptions.includes(option)
        ? selectedOptions.filter((o) => o !== option)
        : [...selectedOptions, option];
      setSelectedOptions(newSelected);
      return;
    }

    if (lastMsg?.allowOtherInput && option === "其他") {
      setShowCustomInput(true);
      return;
    }

    pushMessage({ role: "user", content: option });
    setSelectedOptions([]);
    await advanceStage(option);
  };

  const submitCustomInput = async () => {
    if (isAdvancing) return;
    const text = customInput.trim();
    if (!text) return;
    setShowCustomInput(false);
    setCustomInput("");
    pushMessage({ role: "user", content: `其他：${text}` });
    await advanceStage(text);
  };

  const submitMultiSelect = async () => {
    if (isAdvancing || selectedOptions.length === 0) return;
    pushMessage({ role: "user", content: `选中：${selectedOptions.join("、")}` });
    const text = selectedOptions.join("、");
    setSelectedOptions([]);
    await advanceStage(text);
  };

  const selectCard = async (cardIndex: number) => {
    if (isAdvancing) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg?.cardOptions) return;
    const card = lastMsg.cardOptions[cardIndex];
    if (!card) return;
    pushMessage({ role: "user", content: `${card.emoji} ${card.label}` });
    await advanceStage(`${card.emoji} ${card.label}`);
  };

  const handleFileUpload = async (file: File) => {
    if (isAdvancing || !file) return;
    pushMessage({ role: "user", content: `📎 已上传：${file.name}` });
    setProfile((p) => ({ ...p, resumeFileName: file.name, hasResume: true }));
    await advanceStage(file.name);
  };

  const advanceStage = async (text: string) => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      switch (stage) {
        case "name": {
          setProfile((p) => ({ ...p, name: text }));
          aiSay(`你好${text}！你现在在做什么工作呢？`, {
            options: ROLE_OPTIONS,
            allowOtherInput: true,
          });
          setStage("current_role");
          break;
        }

        case "current_role": {
          setProfile((p) => ({ ...p, currentRole: text }));
          const coffeeFlavor = await fetchAIReply(
            text,
            "如果用一杯饮品形容你的工作，你觉得是哪款？",
            { name: profile.name, currentRole: text }
          );
          aiSay(
            coffeeFlavor || `${text}，来选一杯饮品形容你的工作吧~`,
            { cardOptions: COFFEE_CARDS }
          );
          setStage("coffee");
          break;
        }

        case "coffee": {
          setProfile((p) => ({ ...p, coffee: text }));
          const coffeeLabel = text.replace(/^[^\s]+\s/, "");
          const coffeeDesc =
            COFFEE_CARDS.find((c) => c.label === coffeeLabel)?.desc || "";
          const roleHint = profile.currentRole ? `作为${profile.currentRole}，` : "";
          aiSay(
            `${roleHint}${coffeeLabel}～${coffeeDesc}！你工作多久了？`,
            {
              options: ["0-1 年", "2-4 年", "5-8 年", "8 年以上"],
            }
          );
          setStage("years");
          break;
        }

        case "years": {
          setProfile((p) => ({ ...p, years: text }));
          const coffeeLabel = profile.coffee?.replace(/^[^\s]+\s/, "") || "";
          const coffeeDesc =
            COFFEE_CARDS.find((c) => c.label === coffeeLabel)?.desc || "";
          const skillsFlavor = await fetchAIReply(
            text,
            "聊聊你的核心技能吧，可以多选~",
            {
              name: profile.name,
              currentRole: profile.currentRole,
              coffeeLabel,
              coffeeDesc,
              years: text,
            }
          );
          aiSay(
            skillsFlavor || `${text}，来聊聊你的核心技能吧~`,
            {
              multiSelect: true,
              options: SKILL_OPTIONS,
            }
          );
          setStage("skills");
          break;
        }

        case "skills": {
          setProfile((p) => ({ ...p, skills: text }));
          const skillList = text.split("、").slice(0, 2).join("和");
          aiSay(
            `${skillList ? skillList + "这些技能" : "这些技能"}不错！来抽一张塔罗牌，看看你的内在风格~`,
            { cardOptions: TAROT_CARDS }
          );
          setStage("tarot");
          break;
        }

        case "tarot": {
          setProfile((p) => ({ ...p, tarot: text }));
          const tarotLabel = text.replace(/^[^\s]+\s/, "");
          const tarotDesc =
            TAROT_CARDS.find((c) => c.label === tarotLabel)?.desc || "";
          aiSay(
            `${tarotLabel}！${tarotDesc}～工作之外你对什么感兴趣？可以多选~`,
            { multiSelect: true, options: INTEREST_OPTIONS }
          );
          setStage("interests");
          break;
        }

        case "interests": {
          setProfile((p) => ({ ...p, interests: text }));
          const interestList = text.split("、").slice(0, 2).join("和");
          if (profile.type === "B") {
            aiSay(
              `${interestList ? interestList + "这些方向" : "这些方向"}很有意思！具体想转什么岗位？`,
              {
                options: TARGET_ROLE_OPTIONS,
                allowOtherInput: true,
              }
            );
            setStage("target");
          } else {
            aiSay(
              `${interestList ? interestList + "这些方向" : "这些方向"}挺有意思的！你有简历可以上传吗？`,
              { fileUpload: true }
            );
            setStage("resume");
          }
          break;
        }

        case "target": {
          setProfile((p) => ({ ...p, target: text }));
          aiSay(`想做${text}，很清晰的方向！你有简历可以上传吗？`, { fileUpload: true });
          setStage("resume");
          break;
        }

        case "resume": {
          setProfile((p) => ({
            ...p,
            hasResume: text !== "__skip_resume__",
          }));
          aiSay(
            text === "__skip_resume__"
              ? "好的，跳过简历。最后，还有什么想告诉我的吗？"
              : "收到！最后，还有什么想告诉我的吗？",
            { allowInput: true }
          );
          setStage("final");
          break;
        }

        case "final": {
          setProfile((p) => ({ ...p, coachNote: text }));
          beginGenerate();
          break;
        }
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const beginGenerate = () => {
    setStage("generating");
    setGenerating(true);
    pushMessage({
      role: "system",
      content: "正在生成你的个性化转型报告…",
    });

    setTimeout(async () => {
      const personality = `${profile.coffee} / ${profile.tarot}`;
      const userData = {
        name: profile.name,
        currentRole: profile.currentRole,
        years: profile.years,
        skills: profile.skills,
        interests: profile.interests,
        target: profile.target,
        type: profile.type,
        personality,
        coachNote: profile.coachNote,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      storeUser(userData);
      syncUserToSupabase(userData).then((id) => {
        if (id) console.info("[Pathway] User synced:", id);
      });

      const params = new URLSearchParams({
        type: profile.type || "A",
        name: profile.name,
        role: profile.currentRole,
        years: profile.years,
        skills: profile.skills,
        interests: profile.interests,
        personality: userData.personality,
      });
      if (profile.target) params.set("target", profile.target);
      if (profile.coachNote) params.set("note", profile.coachNote);
      router.push(`/report?${params.toString()}`);
    }, 1800);
  };

  if (stage === "intro" && !onboarded) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#fafaf9] px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
              <span className="text-base">🧭</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">
              AI 转型探索
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              用几个有趣的问题，帮你找到下一段旅程
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => startFlow("A")}
              className="group w-full rounded-xl border border-border bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="rounded-full bg-brand-light px-2 py-0.5">
                  探索模式
                </span>
              </div>
              <div className="text-base font-medium text-brand">
                还没想好方向
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                AI 帮你推荐潜力方向
              </p>
            </button>

            <button
              onClick={() => startFlow("B")}
              className="group w-full rounded-xl border border-border bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="rounded-full bg-brand-light px-2 py-0.5">
                  定向模式
                </span>
              </div>
              <div className="text-base font-medium text-brand">
                有明确的转型目标
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                AI 帮你制定转型路线图
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const awaitingInput =
    !generating &&
    !isAdvancing &&
    lastMsg?.role === "ai" &&
    (lastMsg.allowInput ||
      lastMsg.options !== undefined ||
      lastMsg.cardOptions !== undefined ||
      lastMsg.fileUpload);

  const showMultiSelectSubmit =
    lastMsg?.multiSelect && selectedOptions.length > 0;

  return (
    <div className="flex h-screen flex-col bg-[#fafaf9]">
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🧭</span>
            <span className="font-semibold text-brand text-sm">
              Pathway AI
            </span>
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] text-muted-foreground">
              {profile.type === "A"
                ? "探索"
                : profile.type === "B"
                  ? "定向"
                  : ""}
            </span>
          </div>
          <button
            onClick={() => {
              setMessages([]);
              setStage("intro");
              setSelectedOptions([]);
              setProfile({
                type: null,
                name: "",
                currentRole: "",
                years: "",
                skills: "",
                interests: "",
                target: "",
                personality: "",
                coffee: "",
                tarot: "",
                resumeFileName: "",
                hasResume: false,
                coachNote: "",
              });
              setGenerating(false);
              setShowCustomInput(false);
              router.push("/onboarding");
            }}
            className="text-xs text-muted-foreground hover:text-brand"
          >
            重新开始
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 sm:px-4"
      >
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
              <div className="text-sm font-medium text-brand">
                正在生成你的转型报告…
              </div>
            </div>
          )}
        </div>
      </div>

      {awaitingInput && lastMsg && (
        <div className="border-t border-border bg-white">
          <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4">
            {lastMsg.cardOptions && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {lastMsg.cardOptions.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectCard(idx)}
                    className="group flex flex-col items-center gap-1 rounded-xl border-2 border-border bg-white p-2 transition hover:border-brand hover:bg-brand-light"
                  >
                    <span className="text-2xl">{card.emoji}</span>
                    <span className="text-xs font-medium text-brand">
                      {card.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {card.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {lastMsg.options && lastMsg.options.length > 0 && !showCustomInput && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {lastMsg.options.map((opt) => {
                  const isSelected = selectedOptions.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => selectOption(opt)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        isSelected
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-white text-foreground hover:border-brand hover:bg-brand-light"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                {showMultiSelectSubmit && (
                  <button
                    onClick={submitMultiSelect}
                    className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    确认
                  </button>
                )}
              </div>
            )}

            {showCustomInput && (
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCustomInput();
                  }}
                  placeholder="请输入具体内容…"
                  className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                  autoFocus
                />
                <button
                  onClick={submitCustomInput}
                  disabled={!customInput.trim()}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition disabled:opacity-40"
                >
                  确定
                </button>
              </div>
            )}

            {lastMsg.fileUpload && (
              <div className="mb-2 flex flex-wrap gap-2">
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
                  className="rounded-full border border-brand bg-brand-light px-4 py-1.5 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
                >
                  📎 上传简历
                </button>
                <button
                  onClick={() => {
                    if (isAdvancing) return;
                    pushMessage({ role: "user", content: "稍后再上传" });
                    advanceStage("__skip_resume__");
                  }}
                  className="rounded-full border border-border bg-white px-4 py-1.5 text-xs text-foreground transition hover:border-brand"
                >
                  跳过
                </button>
                {profile.resumeFileName && (
                  <span className="self-center text-xs text-muted-foreground">
                    已选：{profile.resumeFileName}
                  </span>
                )}
              </div>
            )}

            {lastMsg.allowInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUserInput();
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
                      handleUserInput();
                    }
                  }}
                  placeholder={
                    listening ? "正在聆听…" : "输入或按麦克风说话…"
                  }
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-brand outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isAdvancing}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
                >
                  发送
                </button>
              </form>
            )}
          </div>
        </div>
      )}
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
