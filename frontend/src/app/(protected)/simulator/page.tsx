"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import VoiceButton from "@/components/VoiceButton";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { getStoredUser, loadUserFromSupabase } from "@/lib/userStore";

type Stage = "select" | "mode" | "map" | "play" | "result";
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

type PropKind = "standup" | "incident" | "conflict" | "review";

interface Scenario {
  id: number;
  title: string;
  time: string;
  channel: string;
  channelDescription: string;
  prop: PropKind;
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
  choices: { id: string; icon: string; label: string; scores: Partial<Record<Dimension, number>> }[];
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
      prop: "standup",
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
        { id: "a", icon: "🎯", label: "我建议先修新用户流程。用户已经明显感知到问题，这周先把核心体验补上。", scores: { userFocus: 3, execution: 1 } },
        { id: "b", icon: "🚀", label: "先上变现功能，但把验证指标和止损线一起定下来，我们对营收结果负责。", scores: { execution: 3, strategy: 1 } },
        { id: "c", icon: "🧭", label: "这周还技术债，否则以后每次迭代都会更慢。我来把长期收益讲清楚。", scores: { strategy: 3, collaboration: 1 } },
      ],
    },
    {
      id: 2,
      title: "突发状况应对",
      time: "15:20",
      channel: "线上事故应急",
      channelDescription: "8 位成员 · P1 事件处理中",
      prop: "incident",
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
        { id: "a", icon: "📣", label: "先同步影响范围和预计恢复时间，客服与公告统一口径，我每 15 分钟更新一次。", scores: { userFocus: 3, collaboration: 2 } },
        { id: "b", icon: "🛠️", label: "研发先全力修复，其他人暂时不要扩散消息。恢复后我统一做复盘和说明。", scores: { execution: 3, strategy: 1 } },
        { id: "c", icon: "⏱️", label: "马上开一个 15 分钟战情会：研发修复、客服安抚、公关准备公告，我来控节奏。", scores: { collaboration: 3, strategy: 2 } },
      ],
    },
    {
      id: 3,
      title: "跨团队冲突",
      time: "10:00",
      channel: "新版体验评审",
      channelDescription: "5 位成员 · 方案待确认",
      prop: "conflict",
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
        { id: "a", icon: "🎯", label: "先保留完整体验。它解决的是新用户理解问题，我们重新谈排期，不牺牲关键价值。", scores: { userFocus: 3, strategy: 1 } },
        { id: "b", icon: "🚀", label: "首版先做轻量方案按时上线，用真实数据验证后再决定是否投入完整交互。", scores: { execution: 3, userFocus: 1 } },
        { id: "c", icon: "🤝", label: "保留最关键的引导节点，其他动画简化；今天一起做个原型，明天拿用户测。", scores: { collaboration: 3, userFocus: 1, execution: 1 } },
      ],
    },
    {
      id: 4,
      title: "季度汇报",
      time: "16:00",
      channel: "Q4 方向会",
      channelDescription: "4 位成员 · CEO 已加入",
      prop: "review",
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
        { id: "a", icon: "⏱️", label: "我用 3 分钟讲结论，7 分钟讲数据与成果，最后 5 分钟只讨论需要您拍板的资源。", scores: { execution: 2, strategy: 2 } },
        { id: "b", icon: "🎯", label: "我从一个关键用户故事切入，再用数据证明它代表的机会，最后给出下季度行动。", scores: { userFocus: 3, collaboration: 1 } },
        { id: "c", icon: "🧭", label: "我只讲一个长期判断：市场会往哪里走、我们凭什么赢，以及现在必须做的三件事。", scores: { strategy: 3, collaboration: 1 } },
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

function computeResultFeedback(scores: Record<Dimension, number>): string {
  const sorted = (Object.keys(scores) as Dimension[]).sort((a, b) => scores[b] - scores[a]);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const strengthLines: Record<Dimension, string> = {
    execution: "你在几个场景里都选择了先把事情落地，遇到分歧不纠结、先推进再迭代",
    strategy: "你更倾向从长期视角权衡取舍，不只看眼前的紧急程度",
    collaboration: "你习惯先拉齐团队共识，而不是一个人扛下所有决定",
    userFocus: "你几次关键选择都优先考虑了用户的真实感受，而不是短期指标",
  };
  const growLines: Record<Dimension, string> = {
    execution: "但可以再快一点把想法变成具体行动，减少反复权衡的时间",
    strategy: "但可以多留一步想清楚这个决定三个月后会带来什么影响",
    collaboration: "但可以多主动拉相关的人一起确认，而不是自己先定下来",
    userFocus: "但也别忘了偶尔跳出用户视角，看看这个决定对团队和业务是否可持续",
  };
  if (top === bottom) {
    return "你在四个维度上的表现都比较均衡，这次的场景还看不出明显的偏好，建议体验更多场景来看看自己的决策风格。";
  }
  return `${strengthLines[top]}。${growLines[bottom]}。`;
}

// 从 Supabase 提取的真实用户档案，会注入到 AI 的 systemPrompt 中，
// 让 AI 反馈/面试问题能结合用户的真实背景给出个性化分析。
interface UserContext {
  name: string;
  currentRole: string;
  experience: string;
  skills: string[];
  interests: string;
  targetRole: string;
}

function buildUserContextPrompt(ctx: UserContext | null): string {
  if (!ctx) return "";
  const skillsStr = ctx.skills.length > 0 ? ctx.skills.join("、") : "暂无明确技能";
  const targetStr = ctx.targetRole || "尚未确定";
  return `\n\n你正在指导的真实用户背景：${ctx.name}，目前是${ctx.currentRole}（${ctx.experience}经验），技能包括${skillsStr}，兴趣方向${ctx.interests || "未明确"}，目标转型方向${targetStr}。请结合ta的真实背景给出有针对性的建议，而不是泛泛而谈。`;
}

async function fetchAIFeedback(roleName: string, scenario: Scenario, choiceLabel: string, userCtx: UserContext | null = null): Promise<string> {
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
        systemPrompt: `你是一位资深${roleName}，正在带新人体验岗位日常。你的语气亲切、专业、带点幽默。回答控制在 60 字以内。${buildUserContextPrompt(userCtx)}`,
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

async function fetchInterviewQuestion(roleName: string, round: number, history: string, userCtx: UserContext | null = null): Promise<string> {
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
        systemPrompt: `你是面试官，正在面试${roleName}岗位的候选人。每轮只问一个问题，问题要有挑战性但贴合实际工作。控制在 50 字以内。${buildUserContextPrompt(userCtx)}`,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.content || `请谈谈你对${roleName}这个岗位的理解？`;
  } catch {
    return `请谈谈你对${roleName}这个岗位的理解？`;
  }
}

const emptyScores: Record<Dimension, number> = {
  execution: 0,
  strategy: 0,
  collaboration: 0,
  userFocus: 0,
};

export default function SimulatorPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("select");
  const [roleName, setRoleName] = useState("");
  const [mode, setMode] = useState<Mode>("day-in-life");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [activeScenario, setActiveScenario] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number>>(emptyScores);
  const [userCtx, setUserCtx] = useState<UserContext | null>(null);

  // 进入模拟器时，从 localStorage 读取用户 id，再从 Supabase 拉取完整档案。
  // 失败则退回 localStorage 中的基础信息，确保 AI 仍有上下文可用。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getStoredUser();
      if (!stored?.name) return;

      const toUserContext = (s: {
        name: string;
        currentRole: string;
        years: string;
        skills: string;
        interests: string;
        target: string;
      }): UserContext => ({
        name: s.name,
        currentRole: s.currentRole,
        experience: s.years,
        skills: s.skills ? s.skills.split(/[、,，\s]+/).filter(Boolean) : [],
        interests: s.interests || "",
        targetRole: s.target || "",
      });

      // 优先从 Supabase 拉取最新档案
      const supaUser = await loadUserFromSupabase(stored.name).catch(() => null);
      if (cancelled) return;
      if (supaUser) {
        setUserCtx(toUserContext(supaUser));
      } else {
        setUserCtx(toUserContext(stored));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectRole = (name: string) => {
    setRoleName(name);
    setScenarios(buildScenarios(name));
    setStage("mode");
  };

  const handleSelectMode = (m: Mode) => {
    setMode(m);
    if (m === "day-in-life") {
      setStage("map");
    } else {
      setStage("play");
    }
  };

  const handleReset = () => {
    setRoleName("");
    setMode("day-in-life");
    setCompleted([]);
    setScores(emptyScores);
    setStage("select");
  };

  const handleEnterLevel = (index: number) => {
    setActiveScenario(index);
    setStage("play");
  };

  const handleLevelComplete = (index: number, levelScores: Partial<Record<Dimension, number>>) => {
    setScores((prev) => {
      const next = { ...prev };
      for (const [dim, val] of Object.entries(levelScores)) {
        next[dim as Dimension] += val || 0;
      }
      return next;
    });
    setCompleted((prev) => (prev.includes(index) ? prev : [...prev, index]));
    if (index === scenarios.length - 1) {
      setStage("result");
    } else {
      setStage("map");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <NavBar />
      {stage === "select" && <RoleSelectStage onSelect={handleSelectRole} />}
      {stage === "mode" && (
        <ModeSelectStage roleName={roleName} onSelect={handleSelectMode} onBack={() => setStage("select")} />
      )}
      {stage === "map" && (
        <MapStage
          roleName={roleName}
          scenarios={scenarios}
          completed={completed}
          scores={scores}
          onEnterLevel={handleEnterLevel}
          onBack={() => setStage("mode")}
        />
      )}
      {stage === "play" && mode === "day-in-life" && (
        <DayInLifeLevel
          roleName={roleName}
          scenario={scenarios[activeScenario]}
          levelIndex={activeScenario}
          totalLevels={scenarios.length}
          userCtx={userCtx}
          onComplete={(levelScores) => handleLevelComplete(activeScenario, levelScores)}
          onBack={() => setStage("map")}
        />
      )}
      {stage === "play" && mode === "interview" && (
        <InterviewStage
          roleName={roleName}
          userCtx={userCtx}
          onFinish={() => setStage("result")}
          onBack={handleReset}
        />
      )}
      {stage === "result" && (
        <ResultStage
          roleName={roleName}
          mode={mode}
          scores={scores}
          scenarios={scenarios}
          onReset={handleReset}
          onCoach={() => router.push("/coach")}
        />
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

const dimensionMeta: Record<Dimension, { label: string; color: string }> = {
  execution: { label: "执行力", color: "#22d3ee" },
  strategy: { label: "策略", color: "#a78bfa" },
  collaboration: { label: "协作", color: "#34d399" },
  userFocus: { label: "用户洞察", color: "#fb923c" },
};

function PropIcon({ kind, size = 48 }: { kind: PropKind; size?: number }) {
  const s = size;
  if (kind === "standup") {
    return (
      <div style={{ width: s, height: s, position: "relative" }}>
        <div style={{ position: "absolute", left: "6%", bottom: "8%", width: "44%", height: "58%", background: "#f6f1e2", border: "3px solid #d9cba0", borderRadius: 3 }}>
          <span style={{ position: "absolute", left: 5, right: 5, top: 8, height: 3, background: "#a9c6e8", borderRadius: 2 }} />
          <span style={{ position: "absolute", left: 5, width: "60%", top: 16, height: 3, background: "#f0b48f", borderRadius: 2 }} />
        </div>
        <div style={{ position: "absolute", right: "10%", bottom: "6%", width: "32%", height: "34%", background: "linear-gradient(180deg,#fff,#e7e0cf)", border: "2px solid #c9bb96", borderRadius: "3px 3px 6px 6px" }} />
      </div>
    );
  }
  if (kind === "incident") {
    return (
      <div style={{ width: s, height: s, position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "18%", height: "18%", borderRadius: "50%", background: "#ff5b5b", boxShadow: "0 0 8px 2px rgba(255,91,91,0.7)" }} />
        <div style={{ position: "absolute", left: "10%", bottom: "14%", width: "80%", height: "56%", background: "#26344a", borderRadius: 4, borderBottom: "5px solid #17202e" }}>
          <div style={{ position: "absolute", inset: 3, background: "linear-gradient(160deg,#ff9a6b,#ff5b5b)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff6e2", fontWeight: 800, fontSize: s * 0.28 }}>
            !
          </div>
        </div>
      </div>
    );
  }
  if (kind === "conflict") {
    return (
      <div style={{ width: s, height: s, position: "relative" }}>
        <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", fontSize: s * 0.4 }}>⚡</span>
        <div style={{ position: "absolute", left: "10%", bottom: "38%", width: "22%", height: "22%", borderRadius: "50%", background: "#7fc8ff", border: "2px solid #3d8fd6" }} />
        <div style={{ position: "absolute", right: "10%", bottom: "38%", width: "22%", height: "22%", borderRadius: "50%", background: "#ffb27a", border: "2px solid #d6803d" }} />
        <div style={{ position: "absolute", left: "6%", bottom: "12%", width: "88%", height: "20%", background: "linear-gradient(180deg,#d8a86b,#b98a52)", borderRadius: 10 }} />
      </div>
    );
  }
  return (
    <div style={{ width: s, height: s, position: "relative" }}>
      <div style={{ position: "absolute", left: "10%", bottom: "16%", width: "80%", height: "58%", background: "#f6f1e2", border: "3px solid #33465e", borderRadius: 3 }}>
        <span style={{ position: "absolute", left: "12%", bottom: 4, width: "16%", height: "34%", background: "linear-gradient(180deg,#9b6bff,#7047d6)", borderRadius: "2px 2px 0 0" }} />
        <span style={{ position: "absolute", left: "40%", bottom: 4, width: "16%", height: "58%", background: "linear-gradient(180deg,#ffcd3c,#d9a015)", borderRadius: "2px 2px 0 0" }} />
        <span style={{ position: "absolute", left: "68%", bottom: 4, width: "16%", height: "80%", background: "linear-gradient(180deg,#2fe6a0,#1a9d68)", borderRadius: "2px 2px 0 0" }} />
      </div>
      <div style={{ position: "absolute", left: "38%", bottom: "2%", width: "24%", height: "12%", background: "#33465e", borderRadius: "0 0 4px 4px" }} />
    </div>
  );
}

function RealisticWindow({ className }: { className: string }) {
  return (
    <div className={`absolute top-[24px] h-[122px] w-[92px] rounded-sm border-6 border-[#efe4c8] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.4),0_3px_6px_rgba(0,0,0,0.12)] ${className}`} style={{ background: "linear-gradient(160deg, #cdeafd 0%, #a9d8f5 55%, #8fc4ea 100%)" }}>
      <span className="absolute left-1/2 -top-1.5 -bottom-1.5 w-1.5 -translate-x-1/2 bg-[#efe4c8]" />
      <span className="absolute top-1/2 -left-1.5 -right-1.5 h-1.5 -translate-y-1/2 bg-[#efe4c8]" />
      <span className="absolute left-2 top-1.5 h-[46px] w-[22px] rounded-sm bg-white/55" style={{ transform: "skewY(-8deg)" }} />
      <span className="absolute -bottom-2.5 -left-1 -right-1 h-1.5 rounded-sm bg-[#d9cba0] shadow-[0_2px_3px_rgba(0,0,0,0.12)]" />
    </div>
  );
}

function OfficeBackdrop() {
  return (
    <>
      <RealisticWindow className="left-[4%]" />
      <RealisticWindow className="left-[27%]" />
      <RealisticWindow className="right-[22%]" />
      <RealisticWindow className="right-[4%]" />
      <div className="absolute left-1/2 top-[16px] h-[70px] w-[110px] -translate-x-1/2 rounded-sm border-8 border-[#d9cba0] bg-[#fbfbf6]">
        <span className="absolute left-2.5 top-3 h-1 w-[70%] rounded bg-[#a9c6e8]" />
        <span className="absolute left-2.5 top-6 h-1 w-[55%] rounded bg-[#f5b8a0]" />
      </div>
    </>
  );
}

function MapStage({
  roleName,
  scenarios,
  completed,
  scores,
  onEnterLevel,
  onBack,
}: {
  roleName: string;
  scenarios: Scenario[];
  completed: number[];
  scores: Record<Dimension, number>;
  onEnterLevel: (index: number) => void;
  onBack: () => void;
}) {
  const nextPlayable = completed.length;
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  const nodePositions = [
    { x: 11, y: 76 },
    { x: 36, y: 48 },
    { x: 63, y: 76 },
    { x: 89, y: 48 },
  ];
  const pathD = [
    "M 110 380",
    "Q 260 300, 360 240",
    "Q 480 330, 630 380",
    "Q 760 300, 890 240",
  ].join(" ");
  const pathDone = ["M 110 380", "Q 260 300, 360 240", "Q 480 330, 630 380"].join(" ");

  return (
    <main className="relative flex min-h-0 flex-1 overflow-hidden bg-[#e9dcc4] px-3 py-3 sm:px-6 sm:py-6">
      <div className="relative mx-auto flex h-[calc(100dvh-6.5rem)] min-h-[640px] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-black/10 shadow-2xl shadow-black/30" style={{ background: "linear-gradient(180deg, #e9dcc4 0%, #e9dcc4 40%, #b98a5b 40%, #a97a4d 100%)" }}>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            top: "40%",
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 2px, transparent 2px, transparent 96px), " +
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 34px)",
          }}
        />
        <header className="relative z-10 mx-4 mt-4 flex shrink-0 items-center justify-between gap-4 rounded-2xl border-4 border-[#0e2140] px-4 py-3 shadow-[0_6px_0_rgba(0,0,0,0.25)] sm:mx-6 sm:px-6" style={{ background: "linear-gradient(180deg,#2450a8,#1b3a63)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border-3 border-[#b8811a] text-xl shadow-[0_3px_0_rgba(0,0,0,0.25)]" style={{ background: "linear-gradient(180deg,#ffe08a,#ffcd3c)" }}>
              🧑‍💼
            </div>
            <div>
              <h1 className="font-bold text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" style={{ fontSize: 18 }}>{roleName} 的一天</h1>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#bcd6ff]">关卡 {Math.min(nextPlayable + 1, scenarios.length)} / {scenarios.length} · 办公室地图</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden gap-1.5 sm:flex">
              {(Object.keys(dimensionMeta) as Dimension[]).map((dim) => (
                <span key={dim} className="flex items-center gap-1.5 rounded-full border border-white/12 bg-[#142c4d] py-1.5 pl-2 pr-2.5 font-mono text-xs font-bold text-[#dceaff]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dimensionMeta[dim].color, boxShadow: `0 0 6px ${dimensionMeta[dim].color}` }} />
                  <span className="font-sans text-[11px] font-bold text-[#a8bfe0]">{dimensionMeta[dim].label}</span>
                  <span className="text-white">{scores[dim]}</span>
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1.5 rounded-full border-2 border-[#b8811a] py-1.5 pl-2.5 pr-2.5 font-mono text-xs font-bold text-[#6b4a05] shadow-[0_3px_0_#b8811a]" style={{ background: "linear-gradient(180deg,#ffdb70,#ffcd3c)" }}>
              <span className="font-sans text-[11px] font-bold text-[#8a6206]">★ 总分</span>
              <span>{totalScore}</span>
            </span>
            <button onClick={onBack} className="rounded-lg border-2 border-white/18 bg-white/8 px-2.5 py-1.5 text-xs font-bold text-[#dceaff] transition-colors hover:bg-white/15">
              退出
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-auto p-4 sm:p-8">
          <OfficeBackdrop />

          <svg viewBox="0 0 1000 500" className="pointer-events-none absolute inset-0 mx-auto h-full w-full" preserveAspectRatio="xMidYMid meet">
            <path d={pathD} fill="none" stroke="#c99a3f" strokeWidth={34} strokeLinecap="round" opacity={0.9} />
            <path d={pathD} fill="none" stroke="#f4d78a" strokeWidth={26} strokeLinecap="round" />
            {completed.length > 0 && (
              <path d={pathDone} fill="none" stroke="#ffe9b0" strokeWidth={10} strokeLinecap="round" strokeDasharray="2 18" opacity={0.9} />
            )}
          </svg>

          {nodePositions.map((pos, index) => {
            const scenario = scenarios[index];
            const isDone = completed.includes(index);
            const isPlayable = index === nextPlayable || isDone;
            const isCurrent = index === nextPlayable && !isDone;
            return (
              <button
                key={scenario.id}
                onClick={() => isPlayable && onEnterLevel(index)}
                disabled={!isPlayable}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, cursor: isPlayable ? "pointer" : "not-allowed" }}
              >
                <div className="relative flex h-32 w-32 items-end justify-center">
                  {isCurrent && (
                    <div className="absolute inset-[-14px] animate-spin-slow rounded-full border-4 border-dashed border-[#ffcd3ccc]" />
                  )}
                  <div className={`absolute bottom-1 h-8 w-[90%] rounded-full bg-black/15 blur-[1px] ${!isPlayable ? "opacity-60" : ""}`} />
                  <div className={isPlayable ? "" : "opacity-60"} style={{ filter: !isPlayable ? "grayscale(0.55) brightness(0.85)" : isCurrent ? "drop-shadow(0 0 10px rgba(255,205,60,0.55))" : "none" }}>
                    <PropIcon kind={scenario.prop} size={96} />
                  </div>
                  <div
                    className={`absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full border-3 text-base ${isCurrent ? "animate-bounce-slow" : ""}`}
                    style={{
                      background: isDone ? "#2fe6a0" : isCurrent ? "#ffcd3c" : "#8a99b3",
                      borderColor: isDone ? "#1a9d68" : isCurrent ? "#b8811a" : "#4a5771",
                      color: isDone ? "#0d3d29" : isCurrent ? "#6b4a05" : "#2c3648",
                    }}
                  >
                    {isDone ? "✓" : isCurrent ? "!" : "🔒"}
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1 text-base" style={{ color: isPlayable ? "#ffcd3c" : "rgba(255,255,255,0.3)", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }}>
                  {isDone ? "★★★" : "☆☆☆"}
                </div>
                <div className="mt-1 whitespace-nowrap font-bold text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]" style={{ fontSize: 19 }}>
                  {scenario.title}
                </div>
                <div className="font-mono text-sm text-[#eaf2ff]/85 drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">{scenario.time}</div>
              </button>
            );
          })}
        </div>

        <div className="relative z-10 mx-auto mb-4 flex shrink-0 items-center gap-2 rounded-full border-2 border-[#b8811a] px-5 py-2.5 text-center text-sm font-bold text-[#6b4a05] shadow-[0_4px_0_#b8811a]" style={{ background: "linear-gradient(180deg,#ffe27a,#ffcd3c)" }}>
          {completed.length === scenarios.length
            ? "👉 所有关卡已完成，前往查看今日回顾"
            : `👉 点击金色关卡「${scenarios[nextPlayable]?.title}」，继续冒险`}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 6s linear infinite; }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-slow { animation: bounce-slow 1.3s ease-in-out infinite; }
      `}</style>
    </main>
  );
}

function SceneCharacter({
  emoji,
  name,
  role,
  colorFrom,
  colorTo,
  borderColor,
  bubble,
  align,
}: {
  emoji: string;
  name: string;
  role: string;
  colorFrom: string;
  colorTo: string;
  borderColor: string;
  bubble?: { text: string; typing?: boolean };
  align: "left" | "right" | "center";
}) {
  const posClass = align === "left" ? "left-[6%]" : align === "right" ? "right-[6%]" : "left-1/2 -translate-x-1/2";
  return (
    <div className={`absolute bottom-[18%] flex w-[150px] flex-col items-center ${posClass}`}>
      {bubble && (
        <div
          className={`absolute bottom-[calc(100%+16px)] w-[240px] rounded-2xl border-3 border-[#b8811a] bg-[#fff6e2] px-4 py-3 text-[15px] font-semibold leading-relaxed text-[#4a2f00] shadow-[0_5px_0_rgba(0,0,0,0.12)] animate-[popBubble_0.35s_ease-out_both] ${
            align === "left" ? "left-1/2 -translate-x-[28%]" : align === "right" ? "right-1/2 translate-x-[28%]" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {bubble.text}
          {bubble.typing && (
            <span className="ml-1 inline-flex gap-0.5 align-middle">
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8925a] [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8925a] [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#b8925a]" />
            </span>
          )}
        </div>
      )}
      <div
        className="relative z-[2] flex h-20 w-20 items-center justify-center rounded-full border-4 text-4xl shadow-[0_5px_0_rgba(0,0,0,0.18)]"
        style={{ background: `linear-gradient(180deg, ${colorFrom}, ${colorTo})`, borderColor }}
      >
        {emoji}
      </div>
      <div className="mt-2 whitespace-nowrap rounded-full bg-white/75 px-3 py-1 text-base font-bold text-[#0e2140]">{name}</div>
      <div className="mt-1 whitespace-nowrap font-mono text-[13px] font-semibold text-[#fff6e2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{role}</div>
    </div>
  );
}

function emojiForRole(role: string): string {
  if (role.includes("设计") || role.includes("研究")) return "🎨";
  if (role.includes("研发") || role.includes("工程")) return "⚙️";
  if (role.includes("客户") || role.includes("公关") || role.includes("市场")) return "📣";
  if (role.includes("财务")) return "💰";
  if (role.includes("CEO")) return "👔";
  return "🙂";
}

const propSceneMeta: Record<PropKind, { icon: string; label: string }> = {
  standup: { icon: "☕", label: "站会角落" },
  incident: { icon: "🚨", label: "应急指挥台" },
  conflict: { icon: "🗂️", label: "会议桌" },
  review: { icon: "📽️", label: "汇报投影厅" },
};

function WallWhiteboard() {
  return (
    <div className="relative w-[110px]">
      <div className="relative mx-auto h-14 w-[76px] rounded border-4 border-[#d9cba0] bg-[#f6f1e2] shadow-[0_4px_0_rgba(0,0,0,0.08)]">
        <span className="absolute left-2 right-2 top-2.5 h-1 rounded bg-[#a9c6e8]" />
        <span className="absolute left-2 top-5 h-1 w-[65%] rounded bg-[#f0b48f]" />
        <span className="absolute left-2 right-2 top-[30px] h-1 rounded bg-[#a9c6e8]" />
        <span className="absolute left-2 top-[38px] h-1 w-[80%] rounded bg-[#b7e0c4]" />
      </div>
    </div>
  );
}

function WallAlertPanel() {
  return (
    <div className="relative w-[92px]">
      <span className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 animate-pulse rounded-full bg-[#ff5b5b]" style={{ boxShadow: "0 0 10px 3px rgba(255,91,91,0.7)" }} />
      <div className="relative mx-auto h-14 w-20 rounded border-4 border-[#17202e] bg-[#26344a] shadow-[0_4px_0_rgba(0,0,0,0.12)]">
        <div className="absolute inset-1.5 flex items-center justify-center rounded text-xl font-extrabold text-[#fff6e2]" style={{ background: "linear-gradient(160deg,#ff9a6b,#ff5b5b)" }}>
          !
        </div>
      </div>
    </div>
  );
}

function WallBookshelf() {
  return (
    <div className="relative flex w-[100px] flex-col gap-1.5 rounded border-3 border-[#8a6238] bg-[#c9946040] p-2 shadow-[0_4px_0_rgba(0,0,0,0.08)]">
      <div className="flex h-8 items-end gap-1">
        <span className="h-full w-3 rounded-t-sm bg-[#3d8fd6]" />
        <span className="h-6 w-3 rounded-t-sm bg-[#d6803d]" />
        <span className="h-full w-3 rounded-t-sm bg-[#5a3ab8]" />
        <span className="h-5 w-3 rounded-t-sm bg-[#1a9d68]" />
        <span className="h-7 w-3 rounded-t-sm bg-[#d63d7a]" />
      </div>
      <div className="h-1 rounded bg-[#8a6238]" />
    </div>
  );
}

function WallChartPoster() {
  return (
    <div className="relative h-[86px] w-[100px] rounded border-4 border-[#33465e] bg-[#f6f1e2] p-2.5 shadow-[0_4px_0_rgba(0,0,0,0.1)]">
      <div className="flex h-full items-end gap-1.5">
        <span className="h-[35%] w-3 rounded-t-sm" style={{ background: "linear-gradient(180deg,#9b6bff,#7047d6)" }} />
        <span className="h-[60%] w-3 rounded-t-sm" style={{ background: "linear-gradient(180deg,#ffcd3c,#d9a015)" }} />
        <span className="h-[85%] w-3 rounded-t-sm" style={{ background: "linear-gradient(180deg,#2fe6a0,#1a9d68)" }} />
      </div>
    </div>
  );
}

const wallDecoByProp: Record<PropKind, () => React.ReactElement> = {
  standup: WallWhiteboard,
  incident: WallAlertPanel,
  conflict: WallBookshelf,
  review: WallChartPoster,
};

function WallDigitalClock({ time }: { time: string }) {
  const [hh, mm] = time.split(":");
  return (
    <div className="flex h-[90px] w-[110px] items-center justify-center rounded-[10px] border-4 border-[#8a6238] shadow-[0_5px_0_rgba(0,0,0,0.18)]" style={{ background: "linear-gradient(180deg,#d8a86b,#b98a52)" }}>
      <div className="flex flex-col items-center gap-0.5 rounded-[5px] bg-[#2a1f14] px-3.5 py-2.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
        <span className="font-mono text-2xl font-bold tracking-wider text-[#ffcd3c]" style={{ textShadow: "0 0 8px rgba(255,205,60,0.6)" }}>
          {hh}:{mm}
        </span>
      </div>
    </div>
  );
}

function WallDecoRow({ prop, time }: { prop: PropKind; time: string }) {
  const Deco = wallDecoByProp[prop];
  return (
    <div className="pointer-events-none flex h-[110px] items-end justify-center gap-6">
      <Deco />
      <WallDigitalClock time={time} />
    </div>
  );
}

function DayInLifeLevel({
  roleName,
  scenario,
  levelIndex,
  totalLevels,
  userCtx,
  onComplete,
  onBack,
}: {
  roleName: string;
  scenario: Scenario;
  levelIndex: number;
  totalLevels: number;
  userCtx?: UserContext | null;
  onComplete: (scores: Partial<Record<Dimension, number>>) => void;
  onBack: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [gained, setGained] = useState<Partial<Record<Dimension, number>> | null>(null);

  const allRevealed = revealedCount >= scenario.messages.length;
  const speakers = scenario.messages.slice(0, revealedCount);
  const latestBySender = new Map<string, (typeof scenario.messages)[number]>();
  for (const m of speakers) latestBySender.set(m.sender, m);
  const activeSpeakers = [...latestBySender.values()].slice(-2);
  const leftSpeaker = activeSpeakers[0];
  const rightSpeaker = activeSpeakers[1];
  const tensionPct = allRevealed ? (selected ? 100 : 70) : 20 + revealedCount * 15;

  const handleReveal = () => {
    if (revealedCount < scenario.messages.length) {
      setRevealedCount((c) => c + 1);
    }
  };

  const handleSelect = async (choiceId: string) => {
    if (selected) return;
    setSelected(choiceId);
    const choice = scenario.choices.find((c) => c.id === choiceId)!;
    setGained(choice.scores);

    setLoadingFeedback(true);
    const fb = await fetchAIFeedback(roleName, scenario, choice.label, userCtx);
    setFeedback(fb);
    setLoadingFeedback(false);
  };

  const meta = propSceneMeta[scenario.prop];

  return (
    <main className="relative flex min-h-0 flex-1 overflow-hidden bg-[#e9dcc4] px-3 py-3 sm:px-6 sm:py-6">
      <div className="relative mx-auto flex h-[calc(100dvh-6.5rem)] min-h-[640px] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-black/10 shadow-2xl shadow-black/30" style={{ background: "linear-gradient(180deg, #e9dcc4 0%, #e9dcc4 40%, #b98a5b 40%, #a97a4d 100%)" }}>
        <header className="relative z-10 mx-4 mt-4 flex shrink-0 items-center justify-between gap-4 rounded-2xl border-4 border-[#0e2140] px-4 py-3 shadow-[0_6px_0_rgba(0,0,0,0.25)] sm:mx-6 sm:px-6" style={{ background: "linear-gradient(180deg,#2450a8,#1b3a63)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-full border-2 border-[#b8811a] px-2.5 py-1 font-mono text-[11px] font-bold text-[#6b4a05]" style={{ background: "linear-gradient(180deg,#ffdb70,#ffcd3c)" }}>
              关卡 {levelIndex + 1} / {totalLevels}
            </span>
            <h1 className="truncate font-bold text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" style={{ fontSize: 16 }}>
              {scenario.title} · {meta.icon} {meta.label}
            </h1>
          </div>
          <button onClick={onBack} className="shrink-0 rounded-lg border-2 border-white/18 bg-white/8 px-2.5 py-1.5 text-xs font-bold text-[#dceaff] transition-colors hover:bg-white/15">
            退出关卡
          </button>
        </header>

        <div className="mx-4 mt-3 flex items-center gap-2.5 sm:mx-6">
          <span className="whitespace-nowrap font-mono text-[11px] font-bold text-[#7a4a00]">⏱ 决策张力</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-black/10 bg-black/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${tensionPct}%`, background: "linear-gradient(90deg, #34d399, #ffcd3c, #ff6b4a)" }}
            />
          </div>
        </div>

        <WallDecoRow prop={scenario.prop} time={scenario.time} />

        <div className="relative min-h-0 flex-1 px-4 pt-6 sm:px-8">
          {leftSpeaker && (
            <SceneCharacter
              emoji={emojiForRole(leftSpeaker.role)}
              name={leftSpeaker.sender}
              role={leftSpeaker.role}
              colorFrom="#a9d6ff"
              colorTo="#4fa8e8"
              borderColor="#2c78b8"
              bubble={{ text: leftSpeaker.content, typing: !allRevealed && leftSpeaker === speakers[speakers.length - 1] }}
              align="left"
            />
          )}
          {rightSpeaker && (
            <SceneCharacter
              emoji={emojiForRole(rightSpeaker.role)}
              name={rightSpeaker.sender}
              role={rightSpeaker.role}
              colorFrom="#ffcda0"
              colorTo="#ffab5e"
              borderColor="#cc7a2a"
              bubble={{ text: rightSpeaker.content, typing: !allRevealed && rightSpeaker === speakers[speakers.length - 1] }}
              align="right"
            />
          )}
          <SceneCharacter
            emoji="🧑‍💼"
            name="你"
            role={roleName}
            colorFrom="#ffe27a"
            colorTo="#ffcd3c"
            borderColor="#b8811a"
            align="center"
          />
        </div>

        <div className="shrink-0 border-t-4 border-black/10 bg-[#fff6e2] px-4 py-4 sm:px-8 sm:py-5">
          <div className="mx-auto max-w-2xl">
            {!allRevealed ? (
              <button
                onClick={handleReveal}
                className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-[#d9c295] bg-white px-4 py-3 text-left text-xs font-semibold text-[#4a3a1f] transition-all hover:border-[#b8811a] hover:bg-[#fffaf0] sm:text-sm"
              >
                <span>点击继续，查看下一条消息</span>
                <span className="text-[#9c8a63]">
                  {revealedCount} / {scenario.messages.length}
                </span>
              </button>
            ) : !selected ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                {scenario.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => handleSelect(choice.id)}
                    className="group flex-1 rounded-2xl border-3 border-[#d9c295] bg-gradient-to-b from-[#fffaf0] to-[#fff6e2] px-4 py-3.5 text-left shadow-[0_5px_0_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-1.5 hover:-rotate-1 hover:border-[#b8811a] hover:shadow-[0_10px_0_rgba(0,0,0,0.12),0_16px_18px_rgba(0,0,0,0.18)]"
                  >
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#d9c295] bg-white text-lg">
                      {choice.icon}
                    </div>
                    <p className="text-[13px] font-semibold leading-relaxed text-[#4a3a1f]">{choice.label}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(loadingFeedback || feedback) && (
                  <div className="flex gap-3 rounded-2xl border-3 border-[#34d399] px-4 py-3.5 shadow-[0_5px_0_rgba(0,0,0,0.08)] animate-[popBubble_0.4s_ease-out_both]" style={{ background: "linear-gradient(180deg,#eafff2,#d8f7e6)" }}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-3 border-[#1a9d68] text-xl" style={{ background: "linear-gradient(180deg,#4fe3a3,#2fe6a0)" }}>
                      🧑‍🏫
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-bold text-[#0d5c3d]">小北· 你的coach</p>
                      {loadingFeedback ? (
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d5c3d]/50 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d5c3d]/50 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d5c3d]/50" />
                        </span>
                      ) : (
                        <>
                          <p className="text-[13.5px] font-medium leading-relaxed text-[#0d3d29]">{feedback}</p>
                          {gained && (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {Object.entries(gained).map(([dim, val]) => (
                                <span
                                  key={dim}
                                  className="animate-[popIn_0.3s_ease-out_both] rounded-full px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-sm"
                                  style={{ backgroundColor: dimensionMeta[dim as Dimension].color }}
                                >
                                  {dimensionMeta[dim as Dimension].label} +{val}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => onComplete(gained || {})}
                  disabled={loadingFeedback}
                  className="w-full rounded-xl border-2 border-[#b8811a] px-4 py-2.5 text-sm font-bold text-[#6b4a05] shadow-[0_5px_0_#b8811a] transition-all hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-40"
                  style={{ background: "linear-gradient(180deg,#ffe27a,#ffcd3c)" }}
                >
                  {levelIndex === totalLevels - 1 ? "查看今日回顾 →" : "返回地图 →"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes popBubble {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}

function InterviewStage({
  roleName,
  userCtx,
  onFinish,
  onBack,
}: {
  roleName: string;
  userCtx?: UserContext | null;
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
    const q = await fetchInterviewQuestion(roleName, round + 1, history, userCtx);
    setMessages((prev) => [...prev, { role: "ai", content: q }]);
    setLoading(false);
  }, [roleName, round, userCtx]);

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

function RadarChart({ scores }: { scores: Record<Dimension, number> }) {
  const dims = Object.keys(dimensionMeta) as Dimension[];
  const max = Math.max(5, ...dims.map((d) => scores[d]));
  const center = 100;
  const radius = 62;
  const angleFor = (i: number) => (Math.PI * 2 * i) / dims.length - Math.PI / 2;

  const pointFor = (i: number, value: number) => {
    const r = (value / max) * radius;
    const angle = angleFor(i);
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const polygon = dims.map((d, i) => pointFor(i, scores[d]).join(",")).join(" ");
  const axisPoints = dims.map((_, i) => pointFor(i, max));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <svg viewBox="-20 0 240 200" className="h-52 w-52 shrink-0">
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={dims.map((_, i) => pointFor(i, max * frac).join(",")).join(" ")}
            fill="none"
            stroke="rgba(184,129,26,0.25)"
            strokeWidth={1}
          />
        ))}
        {axisPoints.map(([x, y], i) => (
          <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(184,129,26,0.25)" strokeWidth={1} />
        ))}
        <polygon points={polygon} fill="rgba(255,205,60,0.25)" stroke="#b8811a" strokeWidth={2.5} className="transition-all duration-700 ease-out" />
        {dims.map((d, i) => {
          const [px, py] = pointFor(i, scores[d]);
          return <circle key={`pt-${d}`} cx={px} cy={py} r={4} fill={dimensionMeta[d].color} stroke="#fff6e2" strokeWidth={1.5} />;
        })}
        {dims.map((d, i) => {
          const angle = angleFor(i);
          const lx = center + (radius + 30) * Math.cos(angle);
          const ly = center + (radius + 30) * Math.sin(angle);
          return (
            <text key={d} x={lx} y={ly} textAnchor="middle" dy="4" fontSize="14" fill="#6b4a05" fontWeight={700}>
              {dimensionMeta[d].label}
            </text>
          );
        })}
      </svg>
      <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto">
        {dims.map((d) => (
          <div key={d} className="flex items-center gap-2 rounded-xl border-2 border-[#e2d3ab] bg-[#fff6e2] px-3 py-2 shadow-[0_2px_0_rgba(0,0,0,0.06)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dimensionMeta[d].color, boxShadow: `0 0 5px ${dimensionMeta[d].color}` }} />
            <span className="whitespace-nowrap text-xs font-bold text-[#6b4a05]">{dimensionMeta[d].label}</span>
            <span className="ml-auto font-mono text-sm font-extrabold text-[#4a2f00]">{scores[d]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultStage({
  roleName,
  mode,
  scores,
  scenarios,
  onReset,
  onCoach,
}: {
  roleName: string;
  mode: Mode;
  scores: Record<Dimension, number>;
  scenarios: Scenario[];
  onReset: () => void;
  onCoach: () => void;
}) {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const totalPossible = scenarios.reduce((sum, scenario) => {
      const bestChoice = Math.max(
        ...scenario.choices.map((choice) => Object.values(choice.scores).reduce((a, b) => a + (b || 0), 0))
      );
      return sum + bestChoice;
    }, 0);
    const totalGained = Object.values(scores).reduce((a, b) => a + b, 0);
    const s = mode === "day-in-life" && totalPossible > 0
      ? Math.min(100, Math.round((totalGained / totalPossible) * 100))
      : 65 + Math.floor(Math.random() * 30);
    const t = mode === "day-in-life" ? computePersonalityTag(roleName, scores) : `${roleName}面试表现优异`;
    const fb = mode === "day-in-life"
      ? computeResultFeedback(scores)
      : "基于你的整体表现，你展现了良好的岗位潜质与学习能力。建议继续深入体验其他场景或预约 Coach 进行针对性辅导。";

    (async () => {
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      setScore(s);
      setTag(t);
      setFeedback(fb);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [roleName, mode, scores, scenarios]);

  if (loading) {
    return (
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#e9dcc4] px-3 py-3 sm:px-6 sm:py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#b8811a] [animation-delay:-0.3s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#b8811a] [animation-delay:-0.15s]"></span>
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#b8811a]"></span>
          </div>
          <div className="text-base font-bold text-[#6b4a05]">正在生成你的模拟画像…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#e9dcc4] px-3 py-6 sm:px-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] shadow-2xl shadow-black/30" style={{ background: "linear-gradient(180deg, #e9dcc4 0%, #e9dcc4 21%, #b98a5b 21%, #a97a4d 100%)" }}>
        <div className="px-6 pb-8 pt-7 sm:px-10">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border-2 border-[#1a9d68] px-4 py-1.5 text-sm font-bold text-[#0d3d29]" style={{ background: "linear-gradient(180deg,#eafff2,#d8f7e6)" }}>
              <span className="h-2 w-2 rounded-full bg-[#2fe6a0]" />
              模拟完成
            </div>
            <h1 className="flex items-center justify-center gap-2.5 text-3xl font-bold tracking-tight text-[#0e2140] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-3 border-[#b8811a] text-xl shadow-[0_3px_0_rgba(0,0,0,0.25)]" style={{ background: "linear-gradient(180deg,#ffe08a,#ffcd3c)" }}>
                🧑‍💼
              </span>
              {roleName} 模拟结果
            </h1>
          </div>

          {mode === "day-in-life" ? (
            <div className="mb-6 flex justify-center rounded-2xl border-2 border-[#e2d3ab] bg-[#fffaf0]/70 px-4 py-6 shadow-[0_2px_0_rgba(0,0,0,0.05)]">
              <RadarChart scores={scores} />
            </div>
          ) : (
            <div className="mb-6 flex justify-center">
              <div className="rounded-2xl border-2 border-[#b8811a] px-8 py-4 text-center shadow-[0_4px_0_#b8811a]" style={{ background: "linear-gradient(180deg,#ffe27a,#ffcd3c)" }}>
                <span className="font-mono text-4xl font-extrabold text-[#6b4a05]">{score}</span>
                <span className="ml-1 text-sm font-bold text-[#8a6206]">/ 100</span>
              </div>
            </div>
          )}

          <div className="mb-7 rounded-2xl border-2 border-[#e2d3ab] bg-[#fffaf0]/70 p-6 text-center">
            <h2 className="mb-2 text-lg font-bold text-[#6b4a05]">{tag}</h2>
            <p className="text-sm leading-relaxed text-[#5a4a33]">{feedback}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onCoach}
              className="flex-1 rounded-full border-2 border-[#b8811a] px-6 py-3 text-sm font-bold text-[#6b4a05] shadow-[0_4px_0_#b8811a] transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(180deg,#ffe27a,#ffcd3c)" }}
            >
              前往 Coach 获取建议 →
            </button>
            <button
              onClick={onReset}
              className="flex-1 rounded-full border-2 border-[#d9c295] bg-white/70 px-6 py-3 text-sm font-bold text-[#6b4a05] transition-colors hover:bg-white"
            >
              重新选择岗位
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
