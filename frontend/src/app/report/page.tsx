import Link from "next/link";

type Priority = "high" | "medium" | "low";
type Feasibility = "high" | "medium" | "low";

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
}

const mockReport = {
  userName: "林晓",
  reportDate: "2026年8月18日",
  matchScore: 72,
  matchLabel: "匹配度良好",
  currentStatus:
    "你目前是一位拥有 5 年经验的产品经理,在互联网行业积累了扎实的需求分析与跨部门协作能力。沟通表达、逻辑思维与业务理解均表现突出,但在数据建模、代码实现和 AI 工具链使用方面仍有明显提升空间。整体状态处于「转型准备期」,具备向 AI 产品/解决方案方向跃迁的基础。",
  feasibility: "medium" as Feasibility,
  feasibilityExplanation:
    "你的软技能与目标岗位高度契合,且具备产品思维与业务落地经验。主要障碍在于技术深度不足与 AI 领域知识的系统性积累。预计通过 4-6 个月的集中学习与项目实践,可成功完成转型。",
  skills: [
    {
      name: "Prompt Engineering",
      description: "掌握 LLM 对话设计与输出控制技巧",
      priority: "high",
    },
    {
      name: "Python 数据分析",
      description: "使用 Pandas / NumPy 进行数据清洗与分析",
      priority: "high",
    },
    {
      name: "AI 产品架构",
      description: "理解 RAG、Agent、MCP 等核心范式",
      priority: "high",
    },
    {
      name: "SQL 与数据查询",
      description: "编写复杂查询支持业务决策",
      priority: "medium",
    },
    {
      name: "向量数据库基础",
      description: "了解 embedding 与检索增强生成机制",
      priority: "medium",
    },
    {
      name: "前端原型设计",
      description: "使用 React / Next.js 快速搭建 Demo",
      priority: "low",
    },
  ] as SkillItem[],
  plan: [
    {
      phase: "第一阶段",
      duration: "第 1-6 周",
      title: "AI 基础与 Prompt 入门",
      details: [
        "完成《DeepLearning.AI: ChatGPT Prompt Engineering》课程",
        "每周完成 2 个 Prompt 设计实战案例",
        "搭建个人 Notion AI 知识卡片库",
      ],
    },
    {
      phase: "第二阶段",
      duration: "第 7-14 周",
      title: "Python 与数据能力构建",
      details: [
        "系统学习 Python 基础与 Pandas",
        "完成 3 个数据分析项目(如用户分层、转化漏斗)",
        "每周固定 10 小时编码练习",
      ],
    },
    {
      phase: "第三阶段",
      duration: "第 15-22 周",
      title: "AI 产品实践与作品集",
      details: [
        "独立完成 1 个 AI Agent / RAG 项目",
        "输出 2 篇 AI 产品方向的深度文章",
        "参与 1 次 Hackathon 或开源贡献",
      ],
    },
    {
      phase: "第四阶段",
      duration: "第 23-26 周",
      title: "求职冲刺与面试准备",
      details: [
        "打磨简历与作品集,突出转型亮点",
        "进行 5 次以上模拟面试",
        "定向投递 AI 产品经理 / AI 解决方案岗位",
      ],
    },
  ] as PlanStep[],
  pathways: [
    {
      title: "AI 产品经理",
      description:
        "聚焦 AI 产品规划、需求定义与落地,结合你的产品经验最易切入,市场需求旺盛。",
      tags: ["产品思维", "AI 素养", "用户洞察"],
    },
    {
      title: "AI 解决方案顾问",
      description:
        "面向企业客户,负责 AI 场景设计与方案交付,适合沟通能力强、希望与业务深度结合的你。",
      tags: ["方案设计", "客户沟通", "行业理解"],
    },
    {
      title: "AI 创业 / 独立开发者",
      description:
        "基于 AI 技术打造独立产品,自由度高,但对技术深度与商业敏感度要求更高。",
      tags: ["全栈能力", "商业嗅觉", "风险承受"],
    },
  ] as Pathway[],
};

const feasibilityConfig: Record<
  Feasibility,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "高可行性",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  medium: {
    label: "中等可行性",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  low: {
    label: "低可行性",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
};

const priorityConfig: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "高优先级",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  medium: {
    label: "中优先级",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  low: {
    label: "低优先级",
    color: "text-zinc-600",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
  },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#f4f4f5"
          strokeWidth="12"
        />
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
        <span className="text-4xl font-semibold tracking-tight text-zinc-900">
          {score}
          <span className="text-xl font-normal text-zinc-400">/100</span>
        </span>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const feasibility = feasibilityConfig[mockReport.feasibility];

  return (
    <div className="min-h-screen bg-[#fafaf9] pb-24">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
        {/* 1. Header */}
        <header className="mb-8 flex flex-col gap-2">
          <p className="text-sm text-zinc-500">诊断报告</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            你好,{mockReport.userName}
          </h1>
          <p className="text-sm text-zinc-500">
            报告生成时间:{mockReport.reportDate}
          </p>
        </header>

        {/* 2. Match Score Card */}
        <section className="card mb-6 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <ScoreRing score={mockReport.matchScore} />
          <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <span className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
              {mockReport.matchLabel}
            </span>
            <h2 className="text-xl font-semibold text-zinc-900">
              与 AI 产品方向的综合匹配度
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-zinc-600">
              基于你的背景、技能画像与目标岗位需求综合计算,该分数反映了你目前向 AI 相关岗位转型的基础扎实程度。
            </p>
          </div>
        </section>

        {/* 3. Current Status */}
        <section className="card mb-6">
          <h2 className="mb-3 text-base font-semibold text-zinc-900">
            当前状态评估
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            {mockReport.currentStatus}
          </p>
        </section>

        {/* 4. Transformation Feasibility */}
        <section className="card mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              转型可行性分析
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${feasibility.bg} ${feasibility.color} ${feasibility.border}`}
            >
              {feasibility.label}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-600">
            {mockReport.feasibilityExplanation}
          </p>
        </section>

        {/* 5. Skills to Acquire */}
        <section className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            需要补充的核心技能
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-100">
            {mockReport.skills.map((skill) => {
              const cfg = priorityConfig[skill.priority];
              return (
                <li
                  key={skill.name}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {skill.name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {skill.description}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 self-center inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}
                  >
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 6. Action Plan */}
        <section className="card mb-6">
          <h2 className="mb-6 text-base font-semibold text-zinc-900">
            分阶段行动计划
          </h2>
          <ol className="relative ml-2 flex flex-col gap-6 border-l-2 border-dashed border-zinc-200 pl-6">
            {mockReport.plan.map((step, idx) => (
              <li key={step.phase} className="relative">
                <span className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white ring-4 ring-white">
                  {idx + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="text-sm font-medium text-zinc-900">
                    {step.phase} · {step.title}
                  </p>
                  <span className="text-xs text-zinc-500">{step.duration}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {step.details.map((detail) => (
                    <li
                      key={detail}
                      className="text-sm leading-relaxed text-zinc-600"
                    >
                      · {detail}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {/* 7. Possible Pathways */}
        <section className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            适合你的转型路径
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {mockReport.pathways.map((pathway) => (
              <div
                key={pathway.title}
                className="card flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              >
                <h3 className="text-base font-semibold text-zinc-900">
                  {pathway.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-600">
                  {pathway.description}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  {pathway.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <section className="sticky bottom-0 -mx-6 mt-4 border-t border-zinc-200 bg-[#fafaf9]/90 px-6 py-5 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/coach" className="btn-secondary">
              预约 Coach 咨询
            </Link>
            <Link href="/simulator" className="btn-primary">
              进入 Simulator 模拟
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
