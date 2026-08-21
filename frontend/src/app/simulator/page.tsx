"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";

type Stage = "select" | "mode" | "play" | "result";
type Mode = "day-in-life" | "interview";

interface RoleOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const roleOptions: RoleOption[] = [
  { id: "pm", name: "产品经理", emoji: "🎯", description: "负责产品规划、需求定义与落地" },
  { id: "ds", name: "数据科学家", emoji: "📊", description: "数据建模、分析与业务洞察" },
  { id: "ux", name: "UX 设计师", emoji: "🎨", description: "用户体验设计与交互" },
  { id: "brand", name: "品牌/市场", emoji: "📣", description: "品牌策略与市场推广" },
  { id: "fe", name: "前端工程师", emoji: "💻", description: "构建用户界面与交互体验" },
  { id: "ai", name: "AI 工程师", emoji: "🤖", description: "AI 模型开发与应用落地" },
];

interface Scenario {
  id: number;
  title: string;
  time: string;
  channel: string;
  channelDescription: string;
  participants: { name: string; avatar: string; status: string }[];
  messages: {
    id: string;
    sender: string;
    avatar: string;
    role: string;
    content: string;
  }[];
  context: string;
  prompt: string;
  choices: { id: string; label: string; scores: Partial<Record<Dimension, number>> }[];
}

type Dimension = "execution" | "strategy" | "collaboration" | "userFocus";

function buildScenarios(roleName: string): Scenario[] {
  return [
    {
      id: 1,
      title: "晨会与任务排期",
      time: "09:30",
      channel: "本周冲刺",
      channelDescription: "6 位成员 · 产品、设计与研发同步",
      participants: [
        { name: "周航", avatar: "周", status: "产品负责人" },
        { name: "Mia", avatar: "M", status: "体验设计" },
        { name: "阿哲", avatar: "哲", status: "研发负责人" },
      ],
      messages: [
        {
          id: "1-1",
          sender: "Mia",
          avatar: "M",
          role: "体验设计",
          content: "新用户流程的可用性问题已经积了两周，我昨晚又收到 7 条用户反馈。再不处理，大家真的会用脚投票 😵‍💫",
        },
        {
          id: "1-2",
          sender: "阿哲",
          avatar: "哲",
          role: "研发负责人",
          content: "先预警一下：技术债这周再不处理，下个版本的开发速度还会继续掉。它现在已经开始收利息了。",
        },
        {
          id: "1-3",
          sender: "周航",
          avatar: "周",
          role: "产品负责人",
          content: `资源只够押一个方向。${roleName}，你刚加入讨论，帮我们拍个方向？`,
        },
      ],
      context: `周一早晨，你是${roleName}，团队正在讨论本周优先级。资源有限，无法同时完成用户体验优化、业务方强推的变现功能和技术债务清理。`,
      prompt: `各位早上好。本周我们的资源只够做一个方向，我需要${roleName}给出建议。你怎么看？`,
      choices: [
        { id: "a", label: "我建议先修新用户流程。用户已经明显感知到问题，这周先把核心体验补上。", scores: { userFocus: 3, execution: 1 } },
        { id: "b", label: "先上变现功能，但把验证指标和止损线一起定下来，我们对营收结果负责。", scores: { execution: 3, strategy: 1 } },
        { id: "c", label: "这周还技术债，否则以后每次迭代都会更慢。我来把长期收益讲清楚。", scores: { strategy: 3, collaboration: 1 } },
      ],
    },
    {
      id: 2,
      title: "突发状况应对",
      time: "15:20",
      channel: "线上事故应急",
      channelDescription: "8 位成员 · P1 事件处理中",
      participants: [
        { name: "小满", avatar: "满", status: "客户成功" },
        { name: "阿哲", avatar: "哲", status: "研发负责人" },
        { name: "岚姐", avatar: "岚", status: "品牌公关" },
      ],
      messages: [
        {
          id: "2-1",
          sender: "小满",
          avatar: "满",
          role: "客户成功",
          content: "客户群开始有人反馈支付卡住了，工单还在增加。现在已经影响到大约 8% 的用户。",
        },
        {
          id: "2-2",
          sender: "阿哲",
          avatar: "哲",
          role: "研发负责人",
          content: "定位到了一个依赖服务，预计 30 分钟恢复。需要有人帮我挡一下外部沟通。",
        },
        {
          id: "2-3",
          sender: "岚姐",
          avatar: "岚",
          role: "品牌公关",
          content: `${roleName} 在吗？公告、客服口径和修复节奏得有人统一，你来定一下怎么推进。`,
        },
      ],
      context: "线上出现紧急问题，影响部分用户。客服已收到投诉，工程团队定位需要 30 分钟。",
      prompt: "刚才监控告警了，你作为负责人怎么协调？",
      choices: [
        { id: "a", label: "先同步影响范围和预计恢复时间，客服与公告统一口径，我每 15 分钟更新一次。", scores: { userFocus: 3, collaboration: 2 } },
        { id: "b", label: "研发先全力修复，其他人暂时不要扩散消息。恢复后我统一做复盘和说明。", scores: { execution: 3, strategy: 1 } },
        { id: "c", label: "马上开一个 15 分钟战情会：研发修复、客服安抚、公关准备公告，我来控节奏。", scores: { collaboration: 3, strategy: 2 } },
      ],
    },
    {
      id: 3,
      title: "跨团队冲突",
      time: "10:00",
      channel: "新版体验评审",
      channelDescription: "5 位成员 · 方案待确认",
      participants: [
        { name: "Mia", avatar: "M", status: "体验设计" },
        { name: "阿哲", avatar: "哲", status: "研发负责人" },
        { name: "乔乔", avatar: "乔", status: "用户研究" },
      ],
      messages: [
        {
          id: "3-1",
          sender: "Mia",
          avatar: "M",
          role: "体验设计",
          content: "这个引导动画不是装饰，它能让第一次使用的人理解空间关系。砍掉以后，体验会非常突兀。",
        },
        {
          id: "3-2",
          sender: "阿哲",
          avatar: "哲",
          role: "研发负责人",
          content: "完整实现至少多两周，而且低端机性能没有把握。按现在的排期一定会延期。",
        },
        {
          id: "3-3",
          sender: "乔乔",
          avatar: "乔",
          role: "用户研究",
          content: `我们好像卡住了。${roleName}，你能不能给一个大家都能继续往下走的方案？`,
        },
      ],
      context: "设计与工程就交互方案分歧，双方僵持，需要你来决策。",
      prompt: "设计要复杂交互，工程说实现成本高。你作为" + roleName + "怎么平衡？",
      choices: [
        { id: "a", label: "先保留完整体验。它解决的是新用户理解问题，我们重新谈排期，不牺牲关键价值。", scores: { userFocus: 3, strategy: 1 } },
        { id: "b", label: "首版先做轻量方案按时上线，用真实数据验证后再决定是否投入完整交互。", scores: { execution: 3, userFocus: 1 } },
        { id: "c", label: "保留最关键的引导节点，其他动画简化；今天一起做个原型，明天拿用户测。", scores: { collaboration: 3, userFocus: 1, execution: 1 } },
      ],
    },
    {
      id: 4,
      title: "季度汇报",
      time: "16:00",
      channel: "Q4 方向会",
      channelDescription: "4 位成员 · CEO 已加入",
      participants: [
        { name: "陈总", avatar: "陈", status: "CEO" },
        { name: "周航", avatar: "周", status: "产品负责人" },
        { name: "Nancy", avatar: "N", status: "财务伙伴" },
      ],
      messages: [
        {
          id: "4-1",
          sender: "周航",
          avatar: "周",
          role: "产品负责人",
          content: "提醒一下，陈总下一场会议提前了，我们的汇报时间从 30 分钟压缩到 15 分钟。",
        },
        {
          id: "4-2",
          sender: "Nancy",
          avatar: "N",
          role: "财务伙伴",
          content: "预算数字我已经更新在文档里。建议别逐页讲，时间真的不够。",
        },
        {
          id: "4-3",
          sender: "陈总",
          avatar: "陈",
          role: "CEO",
          content: `${roleName}，我还有 15 分钟。直接告诉我：下季度最值得押注的是什么，为什么？`,
        },
      ],
      context: "向 CEO 汇报下季度规划，只有 15 分钟。",
      prompt: "时间紧，你只有 15 分钟。你打算怎么用？",
      choices: [
        { id: "a", label: "我用 3 分钟讲结论，7 分钟讲数据与成果，最后 5 分钟只讨论需要您拍板的资源。", scores: { execution: 2, strategy: 2 } },
        { id: "b", label: "我从一个关键用户故事切入，再用数据证明它代表的机会，最后给出下季度行动。", scores: { userFocus: 3, collaboration: 1 } },
        { id: "c", label: "我只讲一个长期判断：市场会往哪里走、我们凭什么赢，以及现在必须做的三件事。", scores: { strategy: 3, collaboration: 1 } },
      ],
    },
  ];
}

function computePersonalityTag(roleName: string, scores: Record<Dimension, number>): string {
  const sorted = (Object.keys(scores) as Dimension[]).sort((a, b) => scores[b] - scores[a]);
  const top = sorted[0];
  const map: Record<Dimension, string> = {
    execution: `你是偏向落地执行型${roleName}`,
    strategy: `你是偏向策略规划型${roleName}`,
    collaboration: `你是偏向协作沟通型${roleName}`,
    userFocus: `你是偏向用户洞察型${roleName}`,
  };
  return map[top];
}

async function fetchAIFeedback(roleName: string, scenario: Scenario, choiceLabel: string): Promise<string> {
  const localFeedback: Record<number, string> = {
    1: "这个回应把取舍和理由都讲清楚了，团队会更容易行动。再补一句成功标准，你的决策就更稳了。",
    2: "你先把人和节奏组织起来了，这在事故里比亲自冲去修代码更重要。记得持续同步，沉默会放大焦虑。",
    3: "你没有急着站队，而是把争论拉回用户和验证，这很成熟。好的协作不是各退一步，而是一起找证据。",
    4: "十五分钟里敢于只讲最重要的事，是一种高级能力。把结论、证据和需要拍板的事项摆在前面，会更有力量。",
  };
  const fallback = localFeedback[scenario.id] || "你把自己的判断讲得很清楚。继续观察团队反应，好的决定也需要被大家接住。";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `场景：${scenario.context}\n用户选择了：${choiceLabel}\n请以${roleName}前辈的口吻，对用户的决策给出简短反馈（1-2句话，亲切口语化，带点幽默感）。`,
          },
        ],
        systemPrompt: `你是一位资深${roleName}，正在带新人体验岗位日常。你的语气亲切、专业、带点幽默。回答控制在 60 字以内。`,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const content = typeof data.content === "string" ? data.content.trim() : "";
    if (!content || content.includes("当前为演示模式") || content.includes("在正式API接入后")) {
      return fallback;
    }
    return content;
  } catch {
    return fallback;
  }
}

async function fetchInterviewQuestion(roleName: string, round: number, history: string): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `这是第 ${round}/5 轮。${history ? `之前的对话：${history}` : ""}请提出一个针对${roleName}岗位的面试问题。`,
          },
        ],
        systemPrompt: `你是面试官，正在面试${roleName}岗位的候选人。每轮只问一个问题，问题要有挑战性但贴合实际工作。控制在 50 字以内。`,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.content || `请谈谈你对${roleName}这个岗位的理解？`;
  } catch {
    return `请谈谈你对${roleName}这个岗位的理解？`;
  }
}

export default function SimulatorPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("select");
  const [roleName, setRoleName] = useState("");
  const [mode, setMode] = useState<Mode>("day-in-life");

  const handleSelectRole = (name: string) => {
    setRoleName(name);
    setStage("mode");
  };

  const handleSelectMode = (m: Mode) => {
    setMode(m);
    setStage("play");
  };

  const handleReset = () => {
    setRoleName("");
    setMode("day-in-life");
    setStage("select");
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <NavBar />
      {stage === "select" && <RoleSelectStage onSelect={handleSelectRole} />}
      {stage === "mode" && (
        <ModeSelectStage roleName={roleName} onSelect={handleSelectMode} onBack={() => setStage("select")} />
      )}
      {stage === "play" && mode === "day-in-life" && (
        <DayInLifeStage roleName={roleName} onFinish={() => setStage("result")} onBack={handleReset} />
      )}
      {stage === "play" && mode === "interview" && (
        <InterviewStage roleName={roleName} onFinish={() => setStage("result")} onBack={handleReset} />
      )}
      {stage === "result" && (
        <ResultStage roleName={roleName} mode={mode} onReset={handleReset} onCoach={() => router.push("/coach")} />
      )}
    </div>
  );
}

function RoleSelectStage({ onSelect }: { onSelect: (name: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 animate-[fadeIn_0.4s_ease-out]">
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">
          🎮
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-brand">岗位模拟器</h1>
        <p className="mt-2 text-sm text-muted-foreground">选择你想要体验的岗位，沉浸式感受真实工作日常</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roleOptions.map((role, i) => (
          <button
            key={role.id}
            onClick={() => onSelect(role.name)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand hover:shadow-lg animate-[slideUp_0.4s_ease-out_both]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl transition-transform group-hover:scale-110">
              {role.emoji}
            </div>
            <div>
              <h3 className="text-base font-semibold text-brand">{role.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-brand">
              选择此岗位
              <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-6">
        <label className="mb-2 block text-sm font-medium text-foreground">没看到想要的？自定义岗位</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) onSelect(custom.trim());
            }}
            placeholder="输入任意岗位名称，例如：运营、产品运营、增长黑客..."
            className="input-primary flex-1"
          />
          <button
            onClick={() => custom.trim() && onSelect(custom.trim())}
            disabled={!custom.trim()}
            className="btn-primary disabled:opacity-40"
          >
            开始体验
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

function ModeSelectStage({
  roleName,
  onSelect,
  onBack,
}: {
  roleName: string;
  onSelect: (m: Mode) => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 animate-[fadeIn_0.4s_ease-out]">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        重新选择岗位
      </button>

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-brand">
          体验 {roleName} 的两种方式
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">选择你想要的模拟形式</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <button
          onClick={() => onSelect("day-in-life")}
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand hover:shadow-lg"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl transition-transform group-hover:scale-110">
            ☀️
          </div>
          <div>
            <h3 className="text-lg font-semibold text-brand">一日体验</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              沉浸式体验 {roleName} 一天的工作日常，4 个典型场景，AI 前辈带你做决策
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="chip">4 个场景</span>
            <span className="chip">AI 角色扮演</span>
            <span className="chip">支持语音</span>
          </div>
        </button>

        <button
          onClick={() => onSelect("interview")}
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand hover:shadow-lg"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl transition-transform group-hover:scale-110">
            💼
          </div>
          <div>
            <h3 className="text-lg font-semibold text-brand">面试模拟</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AI 面试官模拟真实 {roleName} 面试，5 轮问答，支持语音作答
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="chip">5 轮问答</span>
            <span className="chip">AI 面试官</span>
            <span className="chip">支持语音</span>
          </div>
        </button>
      </div>
    </main>
  );
}

function DayInLifeStage({
  roleName,
  onFinish,
  onBack,
}: {
  roleName: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [scenarios] = useState(() => buildScenarios(roleName));
  const [current, setCurrent] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>({
    execution: 0,
    strategy: 0,
    collaboration: 0,
    userFocus: 0,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [animating, setAnimating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios[current];
  const selectedChoice = scenario.choices.find((choice) => choice.id === selected);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [selected, feedback, loadingFeedback, current]);

  const handleSelect = async (choiceId: string) => {
    if (selected) return;
    setSelected(choiceId);
    const choice = scenario.choices.find((c) => c.id === choiceId)!;
    const newScores = { ...scores };
    for (const [dim, val] of Object.entries(choice.scores)) {
      newScores[dim as Dimension] += val || 0;
    }
    setScores(newScores);

    setLoadingFeedback(true);
    const fb = await fetchAIFeedback(roleName, scenario, choice.label);
    setFeedback(fb);
    setLoadingFeedback(false);
  };

  const handleNext = () => {
    if (current === scenarios.length - 1) {
      onFinish();
    } else {
      setAnimating(true);
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setSelected(null);
        setFeedback("");
        setAnimating(false);
      }, 280);
    }
  };

  return (
    <main className="relative flex min-h-0 flex-1 overflow-hidden bg-[#07111f] px-3 py-3 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex h-[calc(100dvh-6.5rem)] min-h-[640px] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl shadow-black/40">
        <aside className="hidden w-60 shrink-0 flex-col bg-[#0c1b2e] text-slate-300 lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-white/8 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-[#07111f]">
              P
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Pathway Office</p>
              <p className="text-[11px] text-slate-500">职业体验工作区</p>
            </div>
          </div>

          <div className="flex-1 px-3 py-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              今天的频道
            </p>
            <div className="space-y-1">
              {scenarios.map((item, index) => {
                const isCurrent = index === current;
                const isPast = index < current;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs transition-colors ${
                      isCurrent ? "bg-white/10 text-white" : "text-slate-500"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] ${
                      isCurrent
                        ? "bg-cyan-400 font-bold text-[#07111f]"
                        : isPast
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-white/5 text-slate-600"
                    }`}>
                      {isPast ? "✓" : "#"}
                    </span>
                    <span className="truncate">{item.channel}</span>
                    {isCurrent && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/8 p-4">
            <div className="mb-3 flex -space-x-2">
              {scenario.participants.map((person) => (
                <span
                  key={person.name}
                  title={`${person.name} · ${person.status}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c1b2e] bg-slate-600 text-[10px] font-semibold text-white"
                >
                  {person.avatar}
                </span>
              ))}
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c1b2e] bg-cyan-400 text-[10px] font-bold text-[#07111f]">
                我
              </span>
            </div>
            <p className="text-xs font-medium text-white">你正在体验 {roleName}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">观察信息，像真正的同事一样回应。</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#f5f7fb]">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">#</span>
                <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{scenario.channel}</h1>
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 sm:inline-flex">
                  LIVE
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{scenario.channelDescription}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1.5 sm:flex">
                {scenarios.map((item, index) => (
                  <span
                    key={item.id}
                    aria-label={`${item.time} ${item.title}`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === current
                        ? "w-6 bg-cyan-500"
                        : index < current
                          ? "w-1.5 bg-emerald-400"
                          : "w-1.5 bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={onBack}
                className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                退出体验
              </button>
            </div>
          </header>

          <div
            ref={scrollRef}
            className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 transition-all duration-300 sm:px-8 sm:py-7 ${
              animating ? "translate-x-5 opacity-0" : "translate-x-0 opacity-100"
            }`}
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center gap-3 text-[11px] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>{scenario.time} · {scenario.title}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mb-6 flex justify-center">
                <div className="max-w-xl rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-center text-xs leading-relaxed text-blue-700 shadow-sm">
                  <span className="mr-1.5">✦</span>
                  {scenario.context}
                </div>
              </div>

              <div className="space-y-5">
                {scenario.messages.map((message, index) => (
                  <article
                    key={message.id}
                    className="group flex items-start gap-3 animate-[chatEnter_0.45s_ease-out_both]"
                    style={{ animationDelay: `${index * 110}ms` }}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${
                      index % 3 === 0
                        ? "bg-violet-500"
                        : index % 3 === 1
                          ? "bg-amber-500"
                          : "bg-sky-600"
                    }`}>
                      {message.avatar}
                    </div>
                    <div className="min-w-0 max-w-[82%]">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-slate-800">{message.sender}</span>
                        <span className="text-[10px] text-slate-400">{message.role}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm shadow-slate-200/40">
                        {message.content}
                      </div>
                    </div>
                  </article>
                ))}

                {selectedChoice && (
                  <article className="flex items-start justify-end gap-3 animate-[chatEnter_0.35s_ease-out_both]">
                    <div className="max-w-[82%]">
                      <div className="mb-1 flex items-baseline justify-end gap-2">
                        <span className="text-[10px] text-slate-400">{scenario.time}</span>
                        <span className="text-xs font-semibold text-slate-800">你</span>
                      </div>
                      <div className="rounded-2xl rounded-tr-md bg-[#0f3460] px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-blue-950/15">
                        {selectedChoice.label}
                      </div>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-xs font-black text-[#07111f] shadow-sm">
                      我
                    </div>
                  </article>
                )}

                {selected && loadingFeedback && (
                  <article aria-live="polite" className="flex items-start gap-3 animate-[chatEnter_0.35s_ease-out_both]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm text-white shadow-sm">
                      师
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] text-slate-400">林奕 · 你的带教正在输入</div>
                      <div className="inline-flex gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      </div>
                    </div>
                  </article>
                )}

                {selected && !loadingFeedback && feedback && (
                  <article aria-live="polite" className="flex items-start gap-3 animate-[chatEnter_0.35s_ease-out_both]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm text-white shadow-sm">
                      师
                    </div>
                    <div className="max-w-[82%]">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-slate-800">林奕</span>
                        <span className="text-[10px] text-emerald-600">你的带教 · 私密旁白</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900 shadow-sm">
                        {feedback}
                      </div>
                    </div>
                  </article>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-8 sm:py-5">
            <div className="mx-auto max-w-3xl">
              {!selected ? (
                <div className="animate-[composerRise_0.4s_ease-out_both]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">同事们正在等你的回复</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">选择一句你最可能在工作中发出的消息</p>
                    </div>
                    <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 sm:inline-flex">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      等待回应
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {scenario.choices.map((choice) => (
                      <button
                        key={choice.id}
                        onClick={() => handleSelect(choice.id)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs leading-5 text-slate-700 transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 hover:shadow-md sm:text-sm"
                      >
                        <span className="min-w-0 flex-1">{choice.label}</span>
                        <svg className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L13.586 11H5a1 1 0 110-2h8.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 animate-[composerRise_0.35s_ease-out_both]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">
                      {loadingFeedback ? "你的回应已发出" : "这一刻已经过去"}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {loadingFeedback
                        ? "看看团队会如何接住你的决定…"
                        : current === scenarios.length - 1
                          ? "下班前，看看今天留下了怎样的职业画像"
                          : `时间将推进到 ${scenarios[current + 1].time}`}
                    </p>
                  </div>
                  <button
                    onClick={handleNext}
                    disabled={loadingFeedback}
                    className="shrink-0 rounded-xl bg-[#0f3460] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-950/15 transition-all hover:-translate-y-0.5 hover:bg-[#164e7e] disabled:cursor-wait disabled:opacity-40 sm:px-5 sm:text-sm"
                  >
                    {current === scenarios.length - 1 ? "查看今日回顾 →" : "让时间继续 →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes chatEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes composerRise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

function InterviewStage({
  roleName,
  onFinish,
  onBack,
}: {
  roleName: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { supported: voiceSupported, listening, interim, toggle: toggleVoice } = useVoiceInput({
    onFinal: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text));
    },
  });

  const totalRounds = 5;

  const askNext = useCallback(async (history: string) => {
    setLoading(true);
    const q = await fetchInterviewQuestion(roleName, round + 1, history);
    setMessages((prev) => [...prev, { role: "ai", content: q }]);
    setLoading(false);
  }, [roleName, round]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    askNext("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    const newRound = round + 1;
    setRound(newRound);

    if (newRound >= totalRounds) {
      const transcript = messages.map((m) => `${m.role === "ai" ? "面试官" : "候选人"}：${m.content}`).join("\n") + `\n候选人：${text}`;
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1500));
      setLoading(false);
      setFinished(true);
      onFinish();
      void transcript;
    } else {
      const history = messages.map((m) => `${m.role === "ai" ? "面试官" : "候选人"}：${m.content}`).join("\n") + `\n候选人：${text}`;
      askNext(history);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
            {roleName} · 面试模拟
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          第 <span className="font-semibold text-brand">{Math.min(round + 1, totalRounds)}</span> / {totalRounds} 轮
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-brand-border">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${(Math.min(round + (loading ? 0 : 1), totalRounds) / totalRounds) * 100}%` }}
        />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-[slideUp_0.3s_ease-out]`}
          >
            {m.role === "ai" && (
              <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm text-white">
                💼
              </div>
            )}
            <div
              className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-brand text-white" : "bg-brand-light text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm text-white">
              💼
            </div>
            <div className="rounded-2xl bg-brand-light px-4 py-3">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {!finished && (
        <div className="border-t border-border bg-white pt-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted p-2 focus-within:border-brand">
            {voiceSupported && (
              <VoiceButton listening={listening} supported={voiceSupported} onClick={toggleVoice} />
            )}
            <textarea
              rows={1}
              value={input + (interim ? " " + interim : "")}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={listening ? "正在聆听…" : "输入你的回答，或按麦克风说话…"}
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-brand outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              发送
            </button>
          </div>
          <div className="mt-3 flex justify-between">
            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-brand">
              退出
            </button>
            <span className="text-xs text-muted-foreground">支持语音输入</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStage({
  roleName,
  mode,
  onReset,
  onCoach,
}: {
  roleName: string;
  mode: Mode;
  onReset: () => void;
  onCoach: () => void;
}) {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const s = mode === "day-in-life" ? 75 + Math.floor(Math.random() * 20) : 65 + Math.floor(Math.random() * 30);
    const t = mode === "day-in-life"
      ? computePersonalityTag(roleName, {
          execution: Math.floor(Math.random() * 5),
          strategy: Math.floor(Math.random() * 5),
          collaboration: Math.floor(Math.random() * 5),
          userFocus: Math.floor(Math.random() * 5),
        })
      : `${roleName}面试表现优异`;

    (async () => {
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      setScore(s);
      setTag(t);
      setFeedback("基于你的整体表现，你展现了良好的岗位潜质与学习能力。建议继续深入体验其他场景或预约 Coach 进行针对性辅导。");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [roleName, mode]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"></span>
          </div>
          <div className="text-base font-medium text-brand">正在生成你的模拟画像…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 animate-[fadeIn_0.5s_ease-out]">
      <div className="w-full rounded-3xl border border-border bg-white p-10 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-light px-4 py-1.5 text-sm font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            模拟完成
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-brand">
            {roleName} 模拟结果
          </h1>
        </div>

        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-4 h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e4e4e7" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="#18181b" strokeWidth="10"
                strokeDasharray={`${(score / 100) * 326.7} 326.7`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-brand">{score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-muted p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-brand">{tag}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{feedback}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onCoach}
            className="flex-1 rounded-full bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            前往 Coach 获取建议 →
          </button>
          <button
            onClick={onReset}
            className="flex-1 rounded-full border border-border bg-white px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            重新选择岗位
          </button>
        </div>
      </div>
    </main>
  );
}
