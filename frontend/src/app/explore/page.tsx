"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceButton from "@/components/VoiceButton";

type MessageRole = "ai" | "user" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  options?: string[];
  allowInput?: boolean;
}

type FlowStage =
  | "intro"
  | "current_role"
  | "years"
  | "skills"
  | "interests"
  | "target"
  | "resume"
  | "generating";

interface UserProfile {
  type: "A" | "B" | null;
  currentRole: string;
  years: string;
  skills: string;
  interests: string;
  target: string;
  hasResume: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export default function ExplorePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState<FlowStage>("intro");
  const [profile, setProfile] = useState<UserProfile>({
    type: null,
    currentRole: "",
    years: "",
    skills: "",
    interests: "",
    target: "",
    hasResume: false,
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const pushMessage = (msg: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...msg, id: uid() }]);
  };

  const aiSay = (
    content: string,
    opts?: { options?: string[]; allowInput?: boolean }
  ) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      pushMessage({
        role: "ai",
        content,
        options: opts?.options,
        allowInput: opts?.allowInput,
      });
    }, 600 + Math.random() * 500);
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
          ? "好的，我们先一起探索你的潜力方向 ✨ 首先，能告诉我你目前的岗位是什么吗？（例如：产品经理、前端开发、教师等）"
          : "太棒了！我们将围绕你的目标方向进行深入评估 🎯 先从你的当前背景开始 —— 你现在从事的岗位是什么？",
        { allowInput: true }
      );
      setStage("current_role");
    }, 500);
  };

  const handleUserInput = () => {
    const text = input.trim();
    if (!text) return;
    pushMessage({ role: "user", content: text });
    setInput("");
    advanceStage(text);
  };

  const selectOption = (option: string) => {
    pushMessage({ role: "user", content: option });
    advanceStage(option);
  };

  const advanceStage = (text: string) => {
    switch (stage) {
      case "current_role":
        setProfile((p) => ({ ...p, currentRole: text }));
        setTimeout(() => {
          aiSay("了解 👌 那么你在当前领域工作多少年了？", {
            options: ["0-1 年", "2-4 年", "5-8 年", "8 年以上"],
          });
          setStage("years");
        }, 500);
        break;

      case "years":
        setProfile((p) => ({ ...p, years: text }));
        setTimeout(() => {
          aiSay(
            "不错。接下来谈谈你的技能 —— 你最擅长的 3-5 项核心技能是什么？（可以用自然语言描述，例如：用户调研、数据分析、Python、项目管理...）",
            { allowInput: true }
          );
          setStage("skills");
        }, 500);
        break;

      case "skills":
        setProfile((p) => ({ ...p, skills: text }));
        setTimeout(() => {
          aiSay(
            "收到 ✍️ 再问一个：工作之余，你最感兴趣、愿意持续投入时间的事情是什么？",
            { allowInput: true }
          );
          setStage("interests");
        }, 500);
        break;

      case "interests":
        setProfile((p) => ({ ...p, interests: text }));
        if (profile.type === "B") {
          setTimeout(() => {
            aiSay(
              "很好！你已经有目标方向了 —— 请具体告诉我，你想转向什么岗位 / 领域？",
              { allowInput: true }
            );
            setStage("target");
          }, 500);
        } else {
          setTimeout(() => askResume(), 500);
          setStage("resume");
        }
        break;

      case "target":
        setProfile((p) => ({ ...p, target: text }));
        setTimeout(() => askResume(), 500);
        setStage("resume");
        break;

      case "resume":
        const hasResume = text === "上传简历" || text === "稍后再上传";
        setProfile((p) => ({ ...p, hasResume: text === "上传简历" }));
        setTimeout(() => {
          if (!hasResume) return;
          aiSay("收到！简历已记录（模拟）📎。接下来我将整合你的信息。");
          setTimeout(() => beginGenerate(), 900);
        }, 600);
        if (!hasResume) {
          setTimeout(() => beginGenerate(), 500);
        }
        break;
    }
  };

  const askResume = () => {
    aiSay(
      "在生成报告前，你是否要上传简历以便我更精准地匹配？",
      { options: ["上传简历", "稍后再上传"] }
    );
  };

  const beginGenerate = () => {
    setStage("generating");
    setGenerating(true);
    pushMessage({
      role: "system",
      content: "正在整理你的信息，生成个性化转型路径报告...",
    });

    setTimeout(() => {
      const params = new URLSearchParams({
        type: profile.type || "A",
        role: profile.currentRole,
        years: profile.years,
        skills: profile.skills,
        interests: profile.interests,
      });
      if (profile.target) params.set("target", profile.target);
      router.push(`/report?${params.toString()}`);
    }, 2600);
  };

  if (stage === "intro") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#fafaf9] px-6 py-16">
        <div className="w-full max-w-xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white">
              <span className="text-lg">🧭</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              AI 转型探索
            </h1>
            <p className="mt-3 text-zinc-500">
              几个问题，帮你找到最适合的下一段职业旅程。
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => startFlow("A")}
              className="group w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:border-zinc-900 hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                  类型 A
                </span>
                <span>适合尚未确定方向</span>
              </div>
              <div className="text-lg font-medium text-zinc-900 group-hover:underline">
                我还在探索，没有明确转型方向
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                AI 将通过你的背景、技能与兴趣为你推荐 3-5 个潜力方向。
              </p>
            </button>

            <button
              onClick={() => startFlow("B")}
              className="group w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:border-zinc-900 hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                  类型 B
                </span>
                <span>目标明确者</span>
              </div>
              <div className="text-lg font-medium text-zinc-900 group-hover:underline">
                我已经有想要转的目标方向
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                AI 将围绕你的目标岗位制定能力缺口与转型路线图。
              </p>
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-zinc-400">
            所有信息仅用于本次探索会话，不会被用于其他用途。
          </p>
        </div>
      </div>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const awaitingInput =
    !generating &&
    lastMsg?.role === "ai" &&
    (lastMsg.allowInput || lastMsg.options !== undefined);

  return (
    <div className="flex h-screen flex-col bg-[#fafaf9]">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧭</span>
            <span className="font-semibold text-zinc-900">Pathway AI</span>
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {profile.type === "A" ? "探索模式" : "定向模式"}
            </span>
          </div>
          <button
            onClick={() => {
              setMessages([]);
              setStage("intro");
              setProfile({
                type: null,
                currentRole: "",
                years: "",
                skills: "",
                interests: "",
                target: "",
                hasResume: false,
              });
              setGenerating(false);
            }}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            重新开始
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-zinc-100 px-4 py-3 text-zinc-500">
              <TypingDots />
              <span className="text-sm">AI 正在思考…</span>
            </div>
          )}

          {generating && !isTyping && (
            <div className="mx-auto mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white px-10 py-10 text-center">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-900 [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-900 [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-900"></span>
              </div>
              <div className="text-base font-medium text-zinc-900">
                正在为你生成报告…
              </div>
              <div className="text-sm text-zinc-500">
                整合你的背景、技能与偏好，构造个性化转型路径
              </div>
            </div>
          )}

          {awaitingInput && lastMsg?.options && (
            <div className="flex flex-wrap gap-2 self-start pl-0 sm:pl-0">
              {/* no-op, handled below */}
            </div>
          )}
        </div>
      </div>

      {awaitingInput && lastMsg && (
        <div className="border-t border-zinc-200 bg-white">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
            {lastMsg.options && lastMsg.options.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lastMsg.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => selectOption(opt)}
                    className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {lastMsg.allowInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUserInput();
                }}
                className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-zinc-50 p-2 focus-within:border-zinc-900"
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
                  className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  发送
                </button>
              </form>
            )}

            {!lastMsg.allowInput && !lastMsg.options && (
              <div className="text-center text-sm text-zinc-400">
                等待 AI 回复…
              </div>
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
      <div className="mx-auto max-w-md text-center text-xs text-zinc-400">
        {message.content}
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-sm bg-zinc-900 text-white"
            : "rounded-bl-sm bg-zinc-100 text-zinc-800"
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
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></span>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></span>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"></span>
    </span>
  );
}
