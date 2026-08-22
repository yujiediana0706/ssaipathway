import type { UserProfile, DiagnosticReport } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GLMChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface GLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GLMChoice[];
  usage: GLMUsage;
}

export interface GLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

export type DiagnosticReportInput = UserProfile;

export interface CoachContext {
  userProfile?: UserProfile;
  conversationHistory?: ChatMessage[];
  currentTopic?: string;
}

const DEFAULT_ENDPOINT =
  "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4-flash";

function getGLMConfig() {
  const apiKey = process.env.GLM_API_KEY ?? "";
  // 允许 endpoint 被错误地包上反引号时容错
  const rawEndpoint = process.env.GLM_API_ENDPOINT ?? DEFAULT_ENDPOINT;
  const endpoint = rawEndpoint.replace(/^[`"'\s]+|[`"'\s]+$/g, "");
  const model = process.env.GLM_MODEL ?? DEFAULT_MODEL;
  return { apiKey, endpoint, model };
}

function isMockMode(): boolean {
  return !process.env.GLM_API_KEY;
}

// ================ 动态推荐池：完全去 AI 中心主义 ================
// 用户意图优先级：coachNote（小北对话里用户说"想做艺术家/不想做AI"等）> interests > skills > currentRole
// 若用户明确说了不想干的方向（黑名单关键词），一律不能出现在 possiblePaths / skillsToAcquire / actionPlan / recommendedCompanies 里

type PathCandidate = {
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  excludeKeywords?: string[];
  baseScore: number;
};

type SkillCandidate = {
  name: string;
  description: string;
  keywords: string[];
  excludeKeywords?: string[];
  priority: "high" | "medium" | "low";
};

type CompanyCandidate = {
  name: string;
  position: string;
  reason: string;
  keywords: string[];
  excludeKeywords?: string[];
};

type ActionPhase = {
  phase: string;
  duration: string;
  titleTpl: (role: string) => string;
  detailsTpl: (role: string, current: string) => string[];
};

// —— 方向池（约 22 条，覆盖教育/艺术/设计/内容/产品/运营/教练/咨询/技术辅助等，不默认偏向 AI）
const PATH_POOL: PathCandidate[] = [
  // ——— 艺术类
  {
    title: "儿童美育老师 / 艺术启蒙课导师",
    description: "结合教学经历，把艺术表达融入 K12 素质教育，机构、工作室或线上课均可。",
    tags: ["教学能力", "艺术表达", "儿童心理学"],
    keywords: ["艺术家", "艺术", "美术", "画画", "绘画", "插画", "审美", "创作", "设计"],
    baseScore: 82,
  },
  {
    title: "独立插画师 / 绘本创作者",
    description: "与出版社、儿童内容平台或自媒体合作，产出插画、绘本或视觉内容，接单制起步。",
    tags: ["插画", "叙事", "视觉表达", "作品集"],
    keywords: ["艺术家", "插画", "美术", "画画", "绘本", "创作", "儿童", "教育"],
    baseScore: 74,
  },
  {
    title: "艺术疗愈师 / 表达性艺术教练",
    description: "面向儿童或成年人，用绘画/手工/音乐等艺术活动做情绪引导与陪伴，适合有教学+共情基础的人。",
    tags: ["共情", "艺术表达", "情绪引导", "教练能力"],
    keywords: ["艺术家", "艺术", "疗愈", "心理", "陪伴", "教育", "沟通"],
    baseScore: 66,
  },
  {
    title: "UI/UX 设计师（非 AI 向）",
    description: "偏内容型/教育型产品的界面与体验设计，把教学场景理解转化为产品体验。",
    tags: ["用户洞察", "场景理解", "原型设计", "Figma"],
    keywords: ["设计", "审美", "产品", "用户体验", "交互"],
    baseScore: 68,
    excludeKeywords: ["人工智能", "ai ", "大模型", "算法"],
  },
  {
    title: "独立艺术博主 / 美育自媒体",
    description: "小红书/B站/视频号做艺术启蒙、创意手工、家庭美育内容，积累流量后接广告或做课。",
    tags: ["内容创作", "美育", "流量运营", "个人品牌"],
    keywords: ["艺术家", "艺术", "自媒体", "写作", "内容", "小红书", "创作"],
    baseScore: 62,
  },
  {
    title: "艺术策展人 / 展览项目助理",
    description: "美术馆、画廊、文化机构或商业空间，负责公教活动、青少年展览项目策划执行。",
    tags: ["策展", "活动策划", "项目管理", "公教"],
    keywords: ["艺术", "展览", "文化", "活动", "项目", "教育"],
    baseScore: 58,
  },

  // ——— 教育/内容类
  {
    title: "教育内容主编 / 课程产品经理（K12/素质教育）",
    description: "把一线教学经验转化成课程大纲、教案、学习路径，偏内容设计而非纯技术落地。",
    tags: ["课程设计", "教学经验", "用户洞察", "内容产品"],
    keywords: ["教师", "教学", "教育", "课程", "培训", "英语", "语文", "内容", "产品"],
    baseScore: 80,
  },
  {
    title: "学科英语/双语老师 → 留学语培 / 国际课程方向",
    description: "在现有教学基础上迁移到托福/雅思/IB/AP 等语培或国际学校，薪资与职业天花板更高。",
    tags: ["英语能力", "教学法", "国际教育", "教研"],
    keywords: ["英语", "教师", "教学", "留学", "国际", "双语"],
    baseScore: 78,
  },
  {
    title: "教育公司教研/课程设计师",
    description: "进入教育公司做教研岗位：搭建知识体系、写教案、磨课、打磨教师 SOP，不用直接做销售。",
    tags: ["教研", "课程体系", "教案", "SOP"],
    keywords: ["教师", "教学", "教研", "课程", "教育"],
    baseScore: 75,
  },
  {
    title: "教育出版 / 童书编辑",
    description: "出版社或童书公司做内容策划、组稿、编辑，把教学理解转化为出版物。",
    tags: ["内容策划", "编辑能力", "出版", "童书"],
    keywords: ["教师", "教育", "写作", "内容", "儿童", "英语", "语文"],
    baseScore: 66,
  },
  {
    title: "独立教育博主 / 知识付费内容创作者",
    description: "在小红书/B站输出学科/育儿/家庭启蒙内容，积累粉丝后做课或接推广。",
    tags: ["内容创作", "知识付费", "个人品牌", "教学"],
    keywords: ["教师", "教育", "自媒体", "写作", "内容", "小红书"],
    baseScore: 60,
  },

  // ——— 产品/运营/教练/咨询通用类（不默认带 AI 前缀）
  {
    title: "教育产品经理 / 课程产品经理",
    description: "负责素质教育或 K12 产品的需求、内容结构、体验闭环，对有一线教学经验的人非常友好。",
    tags: ["教学洞察", "需求分析", "项目推进", "用户体验"],
    keywords: ["产品", "教育", "教学", "内容", "课程", "用户"],
    baseScore: 72,
  },
  {
    title: "用户运营 / 社群运营（教育/文化向）",
    description: "在教育、文化或艺术相关公司做用户增长、留存、社群运营，门槛低、可内部转岗。",
    tags: ["用户洞察", "活动策划", "沟通", "数据复盘"],
    keywords: ["运营", "用户", "社群", "教育", "内容", "沟通"],
    baseScore: 70,
  },
  {
    title: "内容运营 / 公众号&小红书主笔",
    description: "写品牌文案、教育类干货、用户故事，适合文字表达力强的老师。",
    tags: ["写作", "内容策划", "品牌传播", "选题能力"],
    keywords: ["内容", "写作", "自媒体", "小红书", "运营", "公众号"],
    baseScore: 68,
  },
  {
    title: "职业教练 / 1v1 陪伴教练",
    description: "结合沟通、共情和反馈能力，做求职、学习或青少年成长的 1v1 付费教练。",
    tags: ["教练能力", "共情", "结构化反馈", "用户陪伴"],
    keywords: ["教练", "咨询", "心理", "沟通", "陪伴", "职业"],
    baseScore: 64,
  },
  {
    title: "用户研究员 / 教育 UXR",
    description: "在教育/文化类公司做用户访谈、学习路径观察，产出洞察报告给产品和设计。",
    tags: ["用户访谈", "洞察分析", "研究方法", "教育场景"],
    keywords: ["用户", "研究", "产品", "教育", "分析", "洞察"],
    baseScore: 62,
  },
  {
    title: "人力资源 / 企业培训师（L&D）",
    description: "企业内部做新员工培训、课程开发、讲师管理，教学能力可迁移。",
    tags: ["培训", "课程开发", "项目管理", "人际沟通"],
    keywords: ["培训", "hr", "人力资源", "企业", "教学", "课程"],
    baseScore: 60,
  },
  {
    title: "活动策划 / 项目经理（文化/教育机构）",
    description: "博物馆、美术馆、图书馆、教育公司等策划青少年活动、公教项目、研学营。",
    tags: ["项目管理", "活动策划", "跨部门协作", "公教"],
    keywords: ["活动", "项目", "文化", "艺术", "教育", "策划"],
    baseScore: 58,
  },

  // ——— 只在用户明确提 AI/数据/技术时才启用
  {
    title: "AI 产品经理",
    description: "偏 AI 场景落地的产品岗，只有当你明确表达对 AI 产品有强烈兴趣时再考虑。",
    tags: ["产品思维", "AI 场景", "用户洞察"],
    keywords: ["人工智能", "ai", "大模型", "算法", "机器学习", "智能产品"],
    baseScore: 70,
    excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"],
  },
  {
    title: "数据分析师",
    description: "只有当你简历或兴趣里有数据分析/BI/SQL/业务数据等关键词时，才作为推荐方向。",
    tags: ["数据敏感", "SQL", "业务理解"],
    keywords: ["数据", "sql", "分析", "bi", "excel", "指标"],
    baseScore: 66,
  },
  {
    title: "AI 解决方案顾问",
    description: "仅当用户明确对企业 AI 场景感兴趣时才推荐，否则不默认进入池。",
    tags: ["方案设计", "客户沟通", "行业理解"],
    keywords: ["人工智能", "ai", "解决方案", "企业服务", "大模型"],
    baseScore: 62,
    excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"],
  },
];

// —— 技能池
const SKILL_POOL: SkillCandidate[] = [
  // 艺术 / 设计类
  { name: "Procreate / 数字绘画基础", description: "制作儿童插画、美育课件视觉素材或自媒体封面。", priority: "high", keywords: ["艺术", "美术", "插画", "绘画", "设计", "创作", "美育"] },
  { name: "Figma 基础与原型设计", description: "快速画出课程页面、产品原型或作品集封面，用于教育/产品/设计方向。", priority: "high", keywords: ["设计", "产品", "用户体验", "交互", "ui", "ux"] },
  { name: "艺术史 / 美育理论基础", description: "做儿童美育或艺术公教内容时，能搭建系统知识体系并讲解。", priority: "medium", keywords: ["艺术", "美育", "教育", "公教", "策展"] },
  { name: "绘本叙事与版式设计", description: "独立创作儿童绘本或做内容排版，对接出版社或做自出版。", priority: "medium", keywords: ["插画", "绘本", "出版", "设计", "儿童", "教育"] },
  { name: "短视频 / 自媒体封面视觉", description: "掌握 Canva / 剪映做美育类内容封面与剪辑，提升点击率。", priority: "low", keywords: ["自媒体", "内容", "艺术", "美育", "小红书", "b站"] },

  // 教育 / 内容类
  { name: "课程设计与教案撰写（Bloom 目标）", description: "能基于学习目标设计完整课程单元、评估方式与课堂活动。", priority: "high", keywords: ["教育", "教学", "教研", "课程", "培训"] },
  { name: "教研体系搭建与 SOP 编写", description: "把零散教学经验沉淀成可复制的教案、磨课流程与教师手册。", priority: "high", keywords: ["教研", "课程", "教育", "sop", "培训", "企业"] },
  { name: "教育类长文写作与选题策划", description: "给公众号、小红书或机构写学科干货、家长指南。", priority: "medium", keywords: ["写作", "内容", "教育", "公众号", "小红书", "运营"] },
  { name: "童书内容策划 / 编辑校对", description: "组稿、审稿、编校，对接出版社做少儿图书或练习册。", priority: "medium", keywords: ["出版", "童书", "编辑", "儿童", "教育", "写作"] },
  { name: "双语教学 / 学术英语", description: "向国际课程或留学语培方向迁移。", priority: "high", keywords: ["英语", "双语", "留学", "国际", "雅思", "托福"] },

  // 产品 / 运营 / 教练 通用
  { name: "用户访谈与洞察提炼", description: "做教育产品、用户研究或教练时，能从真实用户故事里抽可行动的结论。", priority: "high", keywords: ["产品", "用户", "研究", "教练", "运营", "ux"] },
  { name: "需求文档 PRD 与项目推进", description: "用标准化文档把想法拆解成任务，和设计/研发/运营协作落地。", priority: "high", keywords: ["产品", "项目", "运营", "管理"] },
  { name: "社群运营 / 用户生命周期管理", description: "拉新、留存、分层、促活一整套方法，适合教育/文化向公司。", priority: "medium", keywords: ["运营", "社群", "用户", "增长", "教育"] },
  { name: "数据指标拆解与 Excel 分析", description: "能看运营/教学数据，找问题点并做改进计划。", priority: "medium", keywords: ["运营", "数据", "产品", "分析", "excel", "指标"] },
  { name: "1v1 教练对话与结构化反馈", description: "用 GROW 或类似模型做有效陪伴与反馈，不只是聊天。", priority: "high", keywords: ["教练", "咨询", "心理", "陪伴", "反馈", "职业"] },

  // 只在用户明确提 AI / 数据时才启用
  { name: "Prompt Engineering（提示词设计）", description: "只有用户真的走 AI 方向时才学，不做默认推荐。", priority: "high", keywords: ["人工智能", "ai", "大模型", "智能产品", "机器学习"], excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"] },
  { name: "Python / Pandas 数据分析（AI/数据向）", description: "只有走数据或 AI 方向时才推荐学习 Python。", priority: "medium", keywords: ["数据", "sql", "分析", "人工智能", "ai", "bi"], excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"] },
];

// —— 公司池
const COMPANY_POOL: CompanyCandidate[] = [
  // 教育/内容/童书/国际
  { name: "新东方 / 学而思素养", position: "素质课教研 / 素养课老师", reason: "K12 素养方向扩张，对有一线教学+美育基础的老师非常友好，可内部转教研。", keywords: ["教育", "教学", "教师", "素质", "美育", "英语", "教研"] },
  { name: "斑马 / 瓜瓜龙 / 小狸AI课（内容岗）", position: "课程产品 / 教研 / 内容编辑", reason: "少儿启蒙内容公司，课程设计与儿童表达力是硬需求。", keywords: ["教育", "课程", "教研", "儿童", "内容", "英语"] },
  { name: "中信出版 / 接力出版社 / 蒲公英童书馆", position: "童书编辑 / 内容策划", reason: "少儿出版与美育内容赛道，适合有写作、美术或绘本创作意愿的老师。", keywords: ["出版", "童书", "编辑", "儿童", "艺术", "绘本", "写作", "教育"] },
  { name: "EF / 华尔街 / 国际学校（语培/国际部）", position: "学术英语老师 / IB/AP 助教", reason: "向国际教育或留学语培迁移时，薪资与天花板比公立机构更高。", keywords: ["英语", "国际", "留学", "双语", "教学", "教育"] },

  // 艺术 / 美育 / 博物馆
  { name: "UCCA / 木木美术馆 / 西岸美术馆", position: "公教项目助理 / 儿童公教专员", reason: "艺术机构的儿童公教、导览、活动策划需要有教学能力+艺术理解的人。", keywords: ["艺术", "美育", "公教", "儿童", "展览", "策展", "文化"] },
  { name: "杨梅红 / 斯玛特 / 蕃茄田艺术", position: "美育课老师 / 教研专员", reason: "头部少儿美育机构，可沉淀体系化课程经验，也可走教研线。", keywords: ["艺术", "美育", "儿童", "教学", "教师", "美术", "创作"] },
  { name: "小红书 / B站（艺术/教育垂类）", position: "独立创作者 / 内容主笔（可兼职起步）", reason: "先做个人号验证内容，有粉丝后再切全职，适合想做艺术/教育自媒体的人。", keywords: ["自媒体", "小红书", "b站", "内容", "写作", "艺术", "教育"] },

  // 产品 / 运营 / 教练
  { name: "小步在家 / 年糕妈妈 / 凯叔讲故事", position: "内容运营 / 课程产品助理", reason: "母婴、亲子、儿童内容平台，内容与课程设计是核心岗。", keywords: ["教育", "儿童", "内容", "课程", "运营", "产品"] },
  { name: "得到 / 三节课 / 混沌学园", position: "课程产品 / 教研 / 内容运营", reason: "成人教育与知识付费赛道，教研、选题与项目推进能力可迁移。", keywords: ["教育", "内容", "教研", "课程", "运营", "产品"] },
  { name: "北辰青年 / 暂停实验室 / 各类教练平台", position: "内容策划 / 1v1 陪伴教练", reason: "共情、结构化反馈、陪伴能力强的老师适合切入教练或内容策划岗。", keywords: ["教练", "咨询", "心理", "陪伴", "内容", "青年", "职业"] },

  // AI/数据公司：只在明确命中 AI/数据关键词时才进推荐
  { name: "字节跳动（教育/内容线）", position: "内容运营 / 产品助理", reason: "只在用户明确对互联网产品/运营方向感兴趣时推荐。", keywords: ["产品", "运营", "内容", "互联网", "教育"], excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai"] },
  { name: "智谱AI", position: "产品运营（非纯技术岗）", reason: "仅当用户明确希望做 AI 方向，且有 AI 兴趣关键词时才推荐。", keywords: ["人工智能", "ai", "大模型", "智能产品", "机器学习"], excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"] },
];

// —— 行动阶段模板：分 4 套
const ACTION_TEMPLATES: { matchKeywords: string[]; excludeKeywords?: string[]; phases: ActionPhase[] }[] = [
  // 艺术/美育/绘本/设计方向
  {
    matchKeywords: ["艺术", "美术", "美育", "插画", "绘画", "绘本", "设计", "策展", "创作"],
    phases: [
      {
        phase: "第一阶段", duration: "第 1-8 周",
        titleTpl: (r) => `作品积累 + ${r}方向最小验证（接单/内容/试课）`,
        detailsTpl: (r, cur) => [
          `每天固定 2 小时产出与「${r}」直接相关的作品：如美育课件 1 节、插画 1 张、儿童故事 1 段`,
          `做 1 次最小验证：在朋友圈/小红书发 3 套「${cur}+${r}」内容，观察真实反馈`,
          `用 1 个平台（Canva / Procreate / Figma）形成固定产出流，沉淀 10+ 作品形成作品集`,
        ],
      },
      {
        phase: "第二阶段", duration: "第 9-16 周",
        titleTpl: (r) => `副业 / 兼职切入${r}赛道（机构助教/自由接单/社群）`,
        detailsTpl: () => [
          `投递 3-6 个月目标方向的兼职 / 助教 / 志愿者岗位，优先选择有项目产出的机会`,
          `在小红书/B站做 20+ 条垂直内容，积累首批关注与真实咨询`,
          `同时主动联系 10 家工作室/机构，用作品集换一次面试或合作机会`,
        ],
      },
      {
        phase: "第三阶段", duration: "第 17-24 周",
        titleTpl: (r) => `从兼职 / 合作岗切入，再考虑转全职`,
        detailsTpl: (r) => [
          `优先投递「${r}助理 / 兼职 / 合作岗位」，不要一步冲正式岗`,
          `在岗期间把每一次项目产出整理成「案例故事 + 作品截图 + 数据反馈」三件套`,
          `6-12 个月内用 5-8 个完整案例冲击正式岗或独立工作室模式`,
        ],
      },
      {
        phase: "第四阶段", duration: "第 25 周后",
        titleTpl: (r) => `正式转型 + 建立个人${r}风格与品牌`,
        detailsTpl: (r) => [
          `确定自己的 1 个差异化标签，如「儿童美育+双语」「插画+绘本叙事」`,
          `继续做个人号，把内容和案例沉淀成可复用的产品（课件/模板/课程）`,
          `每 3 个月复盘一次「收入结构 + 作品质量 + 时间分配」`,
        ],
      },
    ],
  },

  // 教育/教研/出版方向
  {
    matchKeywords: ["教育", "教学", "教师", "教研", "课程", "培训", "出版", "童书", "英语", "国际", "双语", "留学"],
    phases: [
      {
        phase: "第一阶段", duration: "第 1-8 周",
        titleTpl: (r) => `在现有工作里主动承担「${r}」相关任务 + 产出案例`,
        detailsTpl: (r, cur) => [
          `把当前「${cur}」工作里最能迁移到「${r}」的 3 个能力点写下来，每点配 1 个真实案例`,
          `主动在本机构内申请 1 次教研任务 / 示范课 / 内容撰写，拿到可展示的产出`,
          `每周复盘：这一周哪些动作让你更接近「${r}」方向，记录结果与数据`,
        ],
      },
      {
        phase: "第二阶段", duration: "第 9-16 周",
        titleTpl: (r) => `目标行业兼职 / 项目合作切入（教研项目 / 内容撰稿 / 课程策划）`,
        detailsTpl: (r) => [
          `投递 10+ 份与「${r}」相关的兼职/项目制岗位（教研、内容、编辑），重点投有具体产出的项目`,
          `把每一份工作产出做成「任务描述-我做了什么-结果数据」三件套存档`,
          `每月 1 次信息访谈：找目标行业 1-2 位从业者聊，了解真实工作内容与薪资范围`,
        ],
      },
      {
        phase: "第三阶段", duration: "第 17-24 周",
        titleTpl: (r) => `投递目标${r}正式岗位（优先大平台的助理/专员岗）`,
        detailsTpl: (r) => [
          `只投递「${r}」方向岗位 + 有明确培养体系的公司，避免去只看销售指标的岗位`,
          `面试准备 3 个可讲的项目故事（来自上阶段的兼职/合作产出）`,
          `每次面试后写复盘，把不会的问题整理成技能补齐清单，2 周内学会`,
        ],
      },
      {
        phase: "第四阶段", duration: "第 25 周后",
        titleTpl: (r) => `在${r}岗位上形成可复制的方法论 + 考虑内容/个人品牌`,
        detailsTpl: (r) => [
          `入职后 3 个月内建立自己的「工作 SOP + 案例库」`,
          `把工作里可公开的方法论写成内容，发布在专业平台（如小红书/即刻）`,
          `每 6 个月评估一次：当前岗位是否仍让你接近 3 年目标，否则启动下一次迁移`,
        ],
      },
    ],
  },

  // 产品/运营/研究/教练通用
  {
    matchKeywords: ["产品", "运营", "用户", "研究", "内容", "社群", "活动", "项目", "教练", "咨询", "心理", "职业", "人力", "hr", "培训"],
    phases: [
      {
        phase: "第一阶段", duration: "第 1-8 周",
        titleTpl: (r) => `基础学习 + 围绕「${r}」做 1 个可展示的副业项目`,
        detailsTpl: (r, cur) => [
          `系统学习「${r}」核心方法论（运营/产品/教练/研究任选一套主流框架）`,
          `做 1 个最小可展示的副业项目：比如面向「${cur}」同行的社群 / 内容栏目 / 1v1 公益教练 5 次`,
          `每周固定 8-10 小时投入项目，用数据记录结果（新增用户 / 转化率 / NPS 等）`,
        ],
      },
      {
        phase: "第二阶段", duration: "第 9-16 周",
        titleTpl: (r) => `3-6 个月${r}方向实习 / 副业 / 项目合作`,
        detailsTpl: (r) => [
          `投递 15+ 份与「${r}」相关的助理 / 运营 / 实习岗，优先选择能独立负责小项目的岗位`,
          `在真实业务里做 2 个以上完整项目，并拿到可量化数据（用户、收入、留存等）`,
          `每周 1 次项目复盘，打磨讲故事和结构化表达的能力`,
        ],
      },
      {
        phase: "第三阶段", duration: "第 17-24 周",
        titleTpl: (r) => `从助理/运营/兼职切入${r}正式岗`,
        detailsTpl: (r) => [
          `投递正式岗位时，用 2 个项目故事 + 数据证明能力，不只靠学历`,
          `优先选择「导师机制健全 + 能独立负责项目」的团队，而不是只看薪资`,
          `前 6 个月把每一项工作产出整理成案例，准备内部转岗或外部跳槽素材`,
        ],
      },
      {
        phase: "第四阶段", duration: "第 25 周后",
        titleTpl: (r) => `正式站稳${r}岗位 + 建立专业影响力`,
        detailsTpl: (r) => [
          `在本岗位形成 1 套可复用的方法论（SOP / 模板 / 复盘框架）`,
          `对外做 3 次内容输出（小红书/即刻/内部分享），开始积累专业标签`,
          `每 12 个月一次职业复盘：技能栈、收入、长期目标是否仍一致`,
        ],
      },
    ],
  },

  // AI/数据方向兜底（仅当用户明确命中 AI 关键词时用）
  {
    matchKeywords: ["人工智能", "ai", "大模型", "算法", "机器学习", "智能产品", "解决方案", "数据", "sql", "bi"],
    excludeKeywords: ["不想做ai", "不要ai", "不做ai", "讨厌ai", "拒绝ai", "避开ai", "非ai"],
    phases: [
      {
        phase: "第一阶段", duration: "第 1-8 周",
        titleTpl: (r) => `基础学习 + ${r}方向 Demo 作品集搭建`,
        detailsTpl: (r, cur) => [
          `系统学习「${r}」核心基础（AI 产品/AI 方案/数据任选一套主流体系）`,
          `用 vibe coding 搭 2-3 个「${r}」方向 Demo，写清：问题定义 / 方案 / 你的工作 / 结果`,
          `每周 1 次复盘：当前作品离目标岗位 JD 还缺什么硬技能，2 周内补齐`,
        ],
      },
      {
        phase: "第二阶段", duration: "第 9-16 周",
        titleTpl: (r) => `${r}方向实习 / 副业项目切入`,
        detailsTpl: () => [
          `投递 10+ 份目标方向实习或助理岗，重点投有真实项目产出的岗位`,
          `在真实业务中完成至少 1 个项目，能完整讲清楚「业务-问题-方案-结果」`,
          `开始积累行业人脉：线下活动 / 行业群 / 同行 coffee chat`,
        ],
      },
      {
        phase: "第三阶段", duration: "第 17-24 周",
        titleTpl: (r) => `投递正式${r}岗位（从助理/运营岗切入更稳）`,
        detailsTpl: (r) => [
          `简历围绕项目故事 + 数据写，避免只罗列「学过 XX 课程」`,
          `面试时准备 3 个可讲的真实项目故事，其中至少 1 个带业务数据`,
          `先入职稳定 6 个月，再考虑内部转岗或跳槽到更好的团队`,
        ],
      },
      {
        phase: "第四阶段", duration: "第 25 周后",
        titleTpl: (r) => `在${r}方向建立专业壁垒 + 保持技术敏感度`,
        detailsTpl: (r) => [
          `确定 1 个细分领域（如教育 AI / B端方案 / 某类数据模型）做深度`,
          `对外写 3+ 篇专业文章沉淀方法论，建立专业标签`,
          `持续关注前沿，但不要追热点；每季度更新一次自己的能力补齐清单`,
        ],
      },
    ],
  },
];

// ================ 辅助函数 ================
function buildUserIntentText(p: DiagnosticReportInput): string {
  const parts: string[] = [];
  if (p.coachNote) parts.push(p.coachNote);
  if (p.interests) parts.push(p.interests);
  if (p.skills?.length) parts.push(p.skills.join(" "));
  if (p.currentRole) parts.push(p.currentRole);
  if (p.targetRole) parts.push(p.targetRole);
  if (p.experience) parts.push(p.experience);
  if (p.personality) parts.push(p.personality);
  if (p.archetype) parts.push(p.archetype);
  if (p.exploreAnswers) parts.push(Object.values(p.exploreAnswers).join(" "));
  return parts.join(" ").toLowerCase();
}

function buildBlacklist(p: DiagnosticReportInput): string[] {
  const txt = buildUserIntentText(p);
  const black: string[] = [];
  if (/不想做ai|不要ai|不做ai|讨厌ai|拒绝ai|避开ai|非ai|不做人工智能|讨厌人工智能/.test(txt)) {
    black.push("ai", "人工智能", "大模型", "算法", "机器学习");
  }
  if (/不做编程|不想写代码|不要技术|讨厌代码|避开编程|非技术/.test(txt)) {
    black.push("python", "sql", "编程", "代码", "前端", "后端", "算法");
  }
  if (/不想做产品|不做pm|避开产品经理/.test(txt)) {
    black.push("产品经理", "pm");
  }
  if (/不想做运营|讨厌运营|避开运营/.test(txt)) {
    black.push("运营");
  }
  if (/不想做销售|讨厌销售|避开销售/.test(txt)) {
    black.push("销售", "bd");
  }
  return black;
}

function hitScore(candidateKeywords: string[], excludeKeywords: string[] | undefined, intent: string, blacklist: string[]): number {
  for (const b of blacklist) if (intent.includes(b)) return -1;
  if (excludeKeywords) {
    for (const ek of excludeKeywords) if (intent.includes(ek.toLowerCase())) return -1;
  }
  let s = 0;
  for (const kw of candidateKeywords) if (intent.includes(kw.toLowerCase())) s += 1;
  return s;
}

function pickTopPaths(p: DiagnosticReportInput, topN: number): { title: string; description: string; tags: string[]; matchScore: number }[] {
  const intent = buildUserIntentText(p);
  const black = buildBlacklist(p);
  const scored = PATH_POOL.map((c) => {
    const hs = hitScore(c.keywords, c.excludeKeywords, intent, black);
    return { c, hs };
  }).filter((x) => x.hs >= 0);

  const sorted = scored
    .map((x) => ({ ...x, total: x.c.baseScore + x.hs * 4 + Math.floor(Math.random() * 5) }))
    .sort((a, b) => b.total - a.total);

  const out: ReturnType<typeof pickTopPaths> = [];
  for (const s of sorted) {
    if (out.length >= topN) break;
    out.push({
      title: s.c.title,
      description: s.c.description,
      tags: s.c.tags.slice(),
      matchScore: Math.min(100, Math.max(35, s.total)),
    });
  }
  return out;
}

function pickSkillsFor(p: DiagnosticReportInput, mainPathTitle: string, count: number): { name: string; description: string; priority: "high" | "medium" | "low" }[] {
  const intent = (buildUserIntentText(p) + " " + mainPathTitle).toLowerCase();
  const black = buildBlacklist(p);
  const scored = SKILL_POOL.map((c) => {
    const hs = hitScore(c.keywords, c.excludeKeywords, intent, black);
    return { c, hs };
  }).filter((x) => x.hs >= 0);
  const sorted = scored
    .map((x) => ({ ...x, total: x.hs * 5 + (x.c.priority === "high" ? 4 : x.c.priority === "medium" ? 2 : 0) + Math.random() }))
    .sort((a, b) => b.total - a.total);
  const out: ReturnType<typeof pickSkillsFor> = [];
  for (const s of sorted) {
    if (out.length >= count) break;
    out.push({ name: s.c.name, description: s.c.description, priority: s.c.priority });
  }
  return out;
}

function pickCompaniesFor(p: DiagnosticReportInput, mainPathTitle: string, count: number): { name: string; position: string; reason: string }[] {
  const intent = (buildUserIntentText(p) + " " + mainPathTitle).toLowerCase();
  const black = buildBlacklist(p);
  const scored = COMPANY_POOL.map((c) => {
    const hs = hitScore(c.keywords, c.excludeKeywords, intent, black);
    return { c, hs };
  }).filter((x) => x.hs >= 0);
  const sorted = scored
    .map((x) => ({ ...x, total: x.hs * 5 + Math.random() }))
    .sort((a, b) => b.total - a.total);
  const out: ReturnType<typeof pickCompaniesFor> = [];
  for (const s of sorted) {
    if (out.length >= count) break;
    out.push({ name: s.c.name, position: s.c.position, reason: s.c.reason });
  }
  return out;
}

function pickActionPlanFor(p: DiagnosticReportInput, mainPathTitle: string): { phase: string; duration: string; title: string; details: string[] }[] {
  const intent = (buildUserIntentText(p) + " " + mainPathTitle).toLowerCase();
  const black = buildBlacklist(p);
  let best: ActionPhase[] | null = null;
  let bestScore = -1;
  for (const tpl of ACTION_TEMPLATES) {
    const hs = hitScore(tpl.matchKeywords, tpl.excludeKeywords, intent, black);
    if (hs >= 0 && hs > bestScore) {
      bestScore = hs;
      best = tpl.phases;
    }
  }
  if (!best) best = ACTION_TEMPLATES[ACTION_TEMPLATES.length - 2].phases;
  const current = p.currentRole ?? "当前岗位";
  return best.map((a) => ({
    phase: a.phase,
    duration: a.duration,
    title: a.titleTpl(mainPathTitle),
    details: a.detailsTpl(mainPathTitle, current),
  }));
}

function safeFeasibility(mainMatchScore: number | undefined, p: DiagnosticReportInput): "high" | "medium" | "low" {
  if (p.targetRole) {
    return mainMatchScore === undefined ? "low" : mainMatchScore >= 85 ? "high" : mainMatchScore >= 65 ? "medium" : "low";
  }
  return mainMatchScore === undefined ? "low" : mainMatchScore >= 80 ? "medium" : "low";
}

function mockDiagnosticReport(profile: DiagnosticReportInput): DiagnosticReport {
  const now = new Date().toISOString();
  const id = `dr-${Date.now()}`;
  const isExploration = !profile.targetRole;
  const currentRole = profile.currentRole ?? "当前岗位";

  const paths = pickTopPaths(profile, 3);
  if (profile.targetRole) {
    const userTarget = profile.targetRole;
    const targetScore = Math.min(98, 68 + Math.floor(Math.random() * 15));
    paths.unshift({
      title: userTarget,
      description: `「${userTarget}」是你指定的目标方向，结合你当前${currentRole}背景，可迁移能力与硬技能缺口会在下文逐项展开。`,
      tags: ["用户指定目标", "可迁移能力", "硬技能补齐"],
      matchScore: targetScore,
    });
    while (paths.length > 3) paths.pop();
  }
  const mainPath = paths[0]?.title ?? "目标方向";
  const mainScore = paths[0]?.matchScore;
  const skills = pickSkillsFor(profile, mainPath, 5);
  const actionPlan = pickActionPlanFor(profile, mainPath);
  const companies = pickCompaniesFor(profile, mainPath, 5);
  const matchScore = isExploration ? undefined : paths[0]?.matchScore;
  const feasibility = safeFeasibility(mainScore, profile);

  return {
    id,
    userId: profile.id ?? "demo-user",
    createdAt: now,
    matchScore,
    aiReplaceRisk: Math.min(90, Math.max(20, 35 + Math.floor(Math.random() * 30))),
    aiReplaceAnalysis: `在AI时代，${currentRole}岗位的"重复性授课、机械批改、标准化答疑"部分正在被AI工具加速替代，但你身上有AI无法替代的核心：对学生情绪的共情、课堂现场的即兴反应、用学生能听懂的语言重新解释概念、以及真实人际连接带来的学习动力。建议你不要把AI当对手，而是当"备课+批改+素材搜集"的外挂工具，把自己的精力释放到「${mainPath}」这类更需要人味、创意和复杂判断的方向上。`,
    riskPoints: [
      `${currentRole}直接转向「${mainPath}」现实中通常要先做 3-6 个月助理/兼职/副业过渡，很少一步到位，请做好时间预期`,
      `转型初期 6-12 个月收入可能下降，平均下降 25%-50%，建议先保住现有工作做副业验证`,
      `新赛道人脉与作品集需要从零建立，至少要准备 3-5 个可对外展示的完整项目案例`,
    ],
    currentAssessment: `你目前从事${currentRole}${profile.experience ? `，拥有${profile.experience}经验` : ""}。核心技能包括：${profile.skills.join("、")}。结合你在性格测试中的选择和自述意愿，「${mainPath}」是最贴合的主推方向（不是因为热门，而是你的能力与兴趣命中度最高）。但硬性技能缺口仍然明显，建议先从助理岗/兼职/副业切入。`,
    feasibility,
    feasibilityExplanation:
      feasibility === "high"
        ? `你当前的经历、兴趣与「${mainPath}」之间存在较强的可迁移桥梁，但仍要通过 3-6 个月的副业/项目积累补齐作品集，不要直接裸辞投递正式岗位。`
        : feasibility === "medium"
        ? `从${currentRole}到「${mainPath}」有一定可迁移能力，但跨行业直接投递正式岗的成功率不高。更现实的路径是先在现有工作中主动承担相关任务 → 做 3-6 个月兼职/副业项目 → 再投递目标方向的助理或专员岗。`
        : `你当前能力与「${mainPath}」正式岗位的硬性要求差距较大，直接转型不现实。更建议先选择更贴近你现有能力的过渡方向，或用 6 个月以上的时间做系统性学习+项目积累，拿到可展示的作品后再尝试转型。`,
    resumeSummary: profile.resumeContent
      ? `从你的简历片段来看，${currentRole}背景提供了以下可迁移能力：沟通协调、需求理解、节奏控制、结构化表达；这些能力几乎能支撑你进入教育/内容/艺术/教练/运营等任一方向。关键缺口是「${mainPath}」方向的具体作品集与行业经历；建议先花 2-3 个月做 3 个与「${mainPath}」强相关的副业项目，每一个都写成「背景-动作-结果」三件套，用作品替代简历去投递。`
      : undefined,
    choiceAnalysis: profile.exploreAnswers
      ? `从你在性格诊断中的选择来看，你身上更突出的特质是"目标导向+执行力、结构化思考+条理清晰、创意表达+审美感知、共情+关系建立"中最贴近你选择的那一类；这些特质与「${mainPath}」方向非常匹配，但仍需要行业内的真实项目经历作为桥梁，才能让面试官或合作方感知到。`
      : undefined,
    skillsToAcquire: skills,
    actionPlan,
    possiblePaths: paths,
    recommendedCompanies: companies,
  };
}

function mockChatResponse(messages: ChatMessage[]): string {
  // 简单兜底：用最后一条用户消息做回复
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return `这是演示模式下的兜底回复。你刚才说："${lastUserMsg.slice(0, 60)}"。等 GLM_API_KEY 配置正确后，这里会返回智谱 glm-4-flash 针对你问题的真实中文回答。`;
}

function mockCoachReply(userMessage: string, context: CoachContext): string {
  const name = context.userProfile?.name ?? "朋友";
  const topic = context.currentTopic ?? "职业发展";
  return `${name},你好!关于"${topic}"这个话题,我来分享一些想法:\n\n你提到"${userMessage.slice(0, 80)}"——这是一个很关键的思考。在职业转型过程中,我们常常会面临不确定性,但正是这种不确定性带来了成长的可能。\n\n我的建议是:\n1. 先聚焦你当前最核心的困惑点,把大目标拆解成可执行的小步骤\n2. 每周留出时间做复盘,记录你的进展和感悟\n3. 找到同行者或导师,他们的经验会让你少走很多弯路\n\n你想先从哪个方面深入聊聊?`;
}

export async function generateChat(
  messages: ChatMessage[],
  systemPrompt?: string,
  maxTokens?: number
): Promise<{ content: string; usage?: GLMUsage }> {
  if (isMockMode()) {
    return { content: mockChatResponse(messages), usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }
  const { apiKey, endpoint, model } = getGLMConfig();
  const payload: Record<string, unknown> = { model, messages, stream: false, temperature: 0.7 };
  if (systemPrompt) payload.system = systemPrompt;
  if (maxTokens) payload.max_tokens = maxTokens;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${err}`);
    }
    const data = (await response.json()) as GLMResponse;
    return { content: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
  } catch (e) {
    console.error("[GLM] generateChat failed, falling back to mock:", e);
    return { content: mockChatResponse(messages), usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }
}

export async function generateChatStream(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  if (isMockMode()) {
    const fallback = mockChatResponse(messages);
    // 构造一个非常慢的流式假响应（按字节流下去）
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: {"choices":[{"delta":{"content":${JSON.stringify(fallback)}}}]}\n\n`));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }

  const { apiKey, endpoint, model } = getGLMConfig();
  const payload: Record<string, unknown> = { model, messages, stream: true };
  if (systemPrompt) payload.system = systemPrompt;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${err}`);
  }
  if (!response.body) throw new Error("GLM API response has no body");
  return response.body;
}

export async function parseStreamToText(
  response: Response
): Promise<{ content: string; usage?: GLMUsage }> {
  if (!response.body) return { content: "" };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let usage: GLMUsage | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const chunk = JSON.parse(dataStr) as GLMStreamChunk;
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) fullContent += delta;
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
  return { content: fullContent, usage };
}

export async function generateDiagnosticReport(
  userProfile: DiagnosticReportInput
): Promise<DiagnosticReport> {
  if (isMockMode()) return mockDiagnosticReport(userProfile);

  const { apiKey, endpoint, model } = getGLMConfig();
  const isExplorationMode = !userProfile.targetRole;
  const exploreAnswersStr = userProfile.exploreAnswers
    ? Object.entries(userProfile.exploreAnswers).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "未提供";
  const archetypeScoresStr = userProfile.archetypeScores
    ? Object.entries(userProfile.archetypeScores).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}分`).join("、")
    : "未提供";
  const resumeContentStr = userProfile.resumeContent?.slice(0, 3000) ?? "未上传简历";
  const focusDirectionStr = userProfile.focusDirection
    ? `\n【用户选择的专注方向】\n用户已选择"${userProfile.focusDirection}"作为主推方向。请将possiblePaths中该方向放在第一位（matchScore最高），行动项和技能都围绕此方向展开。`
    : "";

  const systemPrompt = `你是Pathway的职业诊断专家，擅长结合用户的性格画像、职业经历和简历内容，给出客观、中立、贴合用户真实意愿的转型建议。
重要原则：
- 用户意愿优先原则（最高优先级，即使与你的"热门岗位"直觉冲突也必须遵守）：如果用户自述或小北对话记录里明确写了"想做艺术家、不想做AI、不想写代码、不想做产品经理、不想做销售、不想做运营"等明确偏好/排斥，必须严格执行：
  1) possiblePaths / skillsToAcquire / actionPlan / recommendedCompanies 里绝对不能出现用户明确排斥的方向或词汇（如 AI、大模型、算法、Python、产品经理 等）
  2) 更推荐与用户明确提到的"想做XX"高度匹配的方向（如提到艺术家→儿童美育老师/插画师/艺术疗愈/美育自媒体等）
- 客观现实：不要美化转型难度。比如0-1年经验的英语老师想直接转艺术家全职，现实中极其困难，要直接说明"不建议立刻裸辞，建议先从兼职/副业/机构美育课切入"
- 中立语气：不要用"你一定可以"、"加油"、"相信你"等鼓励性话术，用客观分析代替
- 前置步骤：除了列出要补的技能，还要说明现实路径，比如"建议先做3-6个月助教/兼职/项目积累"、"先做10+作品形成作品集"、"先从内容/运营/助理岗切入再转正"
- 风险要具体：不要泛泛说"有风险"，要说"直接转型成功率不足5%"、"需要接受降薪30-50%+"等具体数字
报告要求：
1. 必须明确引用用户的性格选择和简历中的具体内容（如职位、公司、项目、技能）
2. 每个结论都要能追溯到用户的某个选择或简历中的某段经历
3. 不要空泛，要具体到"因为你简历中提到XX经历或你在对话中说过想做XX，说明你具备XX能力，但XX能力仍然缺失，需要先XX"
4. 简历分析要"少说事实、多说分析"——分析可迁移能力、硬缺口、可以带到什么岗位、为什么
5. 探索模式下possiblePaths第一个是主推方向（matchScore最高），行动项和技能都围绕这个主推方向展开
6. 推荐公司要真实存在（国内为主），必须与用户主推方向匹配：主推儿童美育→就推荐美育机构/童书出版社/美术馆公教，不要推荐字节/百度等AI大厂
7. 不要在报告中提到"第X题""q1""q2"等题号
8. 必须分析AI替代风险（0-100），以及如何在AI时代找到自己的位置，但不要因此强行把用户推荐去AI方向
9. 必须列出2-3个转型风险点（要具体，带数字）
${isExplorationMode ? "10. 用户在探索模式，没有明确目标岗位：不要给单一matchScore，推荐3个最贴合用户自述意愿+经历的转型方向，每个方向给出matchScore和具体理由。如果用户明确说过不想做AI/编程/运营/销售等，则这3个方向里绝对不能出现这些；如果用户明确说想做艺术家/美育类，则至少有1-2个方向是艺术类" : "10. 用户已有明确目标岗位，给出与该目标的综合matchScore"}
11. actionPlan必须包含现实前置步骤：不要只说"学技能"，要说"先做实习/项目/副业积累经验再投递正式岗"
12. 严格返回JSON，不要markdown。possiblePaths里的title不要默认加"AI"前缀，除非用户targetRole就是AI产品经理等带AI的岗位。`;

  const userMessage = `请根据以下信息生成一份完整的职业转型诊断报告：

【基本信息】
姓名: ${userProfile.name}
当前角色: ${userProfile.currentRole}
${userProfile.targetRole ? `目标角色: ${userProfile.targetRole}` : "目标角色: 未指定（探索模式）"}
经验: ${userProfile.experience}
技能: ${userProfile.skills.join("、")}
兴趣: ${userProfile.interests || "未提供"}
性格原型: ${userProfile.archetype || userProfile.personality || "未提供"}
用户自述/在小北对话里说过的话: ${userProfile.coachNote || "无"}（★ 必须把这段话视为最高优先级的意愿来源，如果这里写了想做艺术家/不想做AI等，严格执行）

【性格诊断选择】
${exploreAnswersStr}

【6型画像得分】
${archetypeScoresStr}

【简历内容】
${resumeContentStr}
${focusDirectionStr}

请严格按照以下JSON格式返回，不要添加其他文字：
{
  ${isExplorationMode ? "" : `"matchScore": 0-100的数字,
  `}"aiReplaceRisk": 0-100的数字,
  "aiReplaceAnalysis": "120-180字",
  "currentAssessment": "结合性格选择+简历+用户自述意愿，评估用户当前状态与核心优势，150-200字。必须引用简历或对话中具体经历/语句",
  "feasibility": "high或medium或low",
  "feasibilityExplanation": "180-250字，客观论证。如果经验不足要直接说明难度",
  "resumeSummary": "200-300字，分析可迁移能力+硬缺口+基于能力推荐2-3个贴合的方向",
  "choiceAnalysis": "120-180字，说明哪些选择反映了什么特质，如何与简历经历呼应，不要提题号",
  "riskPoints": ["风险点1（带数字）", "风险点2", "风险点3"],
  "skillsToAcquire": [{"name":"技能名","priority":"high|medium|low","description":"为什么需要，结合主推方向。★不要默认加Prompt/Python/AI架构，除非主推方向真的是AI/数据类"}],
  "actionPlan": [{"phase":"阶段名","duration":"时长","title":"阶段标题（必须含现实前置步骤如实习/项目/副业/作品积累，不要只说学技能）","details":["步骤1","步骤2"]}],
  "possiblePaths": [{"title":"路径标题（不要默认加AI前缀！除非用户明确选AI类）","description":"必须结合用户选择、简历和自述意愿，说明为什么适合他","tags":["标签1"],"matchScore":0-100}],
  "recommendedCompanies": [{"name":"真实公司名","position":"岗位","reason":"为什么适合，必须与主推方向一致（如主推美育不要推荐字节AI线）"}]
}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`GLM API error: ${response.status} ${response.statusText} - ${err}`);
    }
    const data = (await response.json()) as GLMResponse;
    const raw = data.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(raw) as Partial<DiagnosticReport>;
      // 字段兜底：如果 GLM 返回缺少字段，用 mock 的匹配结果补齐，确保前端不崩
      const fallback = mockDiagnosticReport(userProfile);
      return {
        ...fallback,
        id: fallback.id,
        userId: fallback.userId,
        createdAt: fallback.createdAt,
        ...parsed,
      } as DiagnosticReport;
    } catch (parseErr) {
      console.error("[GLM] diagnostic report JSON parse failed, falling back to mock:", parseErr, "raw=", raw.slice(0, 400));
      return mockDiagnosticReport(userProfile);
    }
  } catch (error) {
    console.error("[GLM] generateDiagnosticReport failed, falling back to mock:", error);
    return mockDiagnosticReport(userProfile);
  }
}

export async function generateCoachReply(
  userMessage: string,
  context: CoachContext
): Promise<string> {
  if (isMockMode()) return mockCoachReply(userMessage, context);

  const { apiKey, endpoint, model } = getGLMConfig();
  const profile = context.userProfile;
  const history = context.conversationHistory ?? [];
  const system = `你是用户的职业教练"小北"。说话像一个有 10 年经验、客观但温柔的职业教练，不要用鸡汤，不要喊口号，用简短中文回答（1-3 段）。记住以下原则：
- 用户自述意愿是最高优先级：如果用户在对话里说"想成为艺术家"、"不想做AI"、"讨厌编程"等，必须尊重，不要把话题往他排斥的方向上引
- 如果用户说的是"想做XX"，先肯定他的真实想法，再问 1-2 个具体问题（比如"你说想做艺术家，是更想做儿童美育/插画/艺术疗愈，还是纯艺术创作？这几条路径的准备方式差别很大"），帮用户把模糊的意愿变具体
- 不要默认推荐"产品经理"、"数据分析师"、"AI"这类热门岗位，除非用户明确提到了
- 每次回复最多抛 2 个问题或建议，不要一下子甩 5 条
- 语言口语化，不要用"首先、其次、再次"这种生硬结构`;

  const messages: ChatMessage[] = [
    ...history.slice(-20),
    {
      role: "user",
      content: `【用户画像背景】
姓名: ${profile?.name ?? "未知"}
当前角色: ${profile?.currentRole ?? "未知"}
经验: ${profile?.experience ?? "未知"}
技能: ${profile?.skills?.join("、") ?? "未知"}
兴趣: ${profile?.interests ?? "未知"}
之前在小北对话里说过的话（请严格尊重这里的意愿）: ${profile?.coachNote ?? "无"}

当前话题: ${context.currentTopic ?? "职业发展"}

用户刚说的话: ${userMessage}`,
    },
  ];
  try {
    const { content } = await generateChat(messages, system, 600);
    return content || mockCoachReply(userMessage, context);
  } catch (e) {
    console.error("[GLM] generateCoachReply failed, falling back to mock:", e);
    return mockCoachReply(userMessage, context);
  }
}
