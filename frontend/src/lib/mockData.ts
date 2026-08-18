import type { CoachProfile } from "./types";

// Mock data (used as fallback when Supabase is unavailable)
export const mockCoaches: CoachProfile[] = [
  {
    id: "1",
    name: "陈思远",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=chen",
    headline: "资深产品经理 | 前字节跳动",
    industry: "AI产品",
    yearsExperience: 6,
    ratePerHour: 299,
    availableSlots: [
      { day: "周一", time: "14:00" },
      { day: "周三", time: "10:00" },
      { day: "周五", time: "16:00" },
    ],
    rating: 4.9,
    sessionsCount: 128,
  },
  {
    id: "2",
    name: "林晓晴",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lin",
    headline: "数据科学家 | 前美团",
    industry: "数据科学",
    yearsExperience: 4,
    ratePerHour: 249,
    availableSlots: [
      { day: "周二", time: "10:00" },
      { day: "周四", time: "14:00" },
    ],
    rating: 4.8,
    sessionsCount: 86,
  },
  {
    id: "3",
    name: "王浩宇",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=wang",
    headline: "品牌总监 | 前宝洁",
    industry: "品牌/市场",
    yearsExperience: 8,
    ratePerHour: 399,
    availableSlots: [
      { day: "周一", time: "16:00" },
      { day: "周三", time: "14:00" },
      { day: "周六", time: "10:00" },
    ],
    rating: 5.0,
    sessionsCount: 215,
  },
  {
    id: "4",
    name: "赵雨萌",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhao",
    headline: "UX 设计师 | 前腾讯",
    industry: "设计/UX",
    yearsExperience: 5,
    ratePerHour: 279,
    availableSlots: [
      { day: "周二", time: "14:00" },
      { day: "周四", time: "10:00" },
    ],
    rating: 4.7,
    sessionsCount: 94,
  },
  {
    id: "5",
    name: "刘思成",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=liu",
    headline: "创业者 | 连续3次创业",
    industry: "创业",
    yearsExperience: 10,
    ratePerHour: 499,
    availableSlots: [
      { day: "周五", time: "14:00" },
      { day: "周日", time: "10:00" },
    ],
    rating: 4.9,
    sessionsCount: 67,
  },
  {
    id: "6",
    name: "张雅婷",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhang",
    headline: "金融分析师 | 前高盛",
    industry: "金融/投资",
    yearsExperience: 7,
    ratePerHour: 379,
    availableSlots: [
      { day: "周一", time: "10:00" },
      { day: "周三", time: "16:00" },
    ],
    rating: 4.8,
    sessionsCount: 112,
  },
];

// Async function to load coaches from Supabase (or fallback to mock)
export async function fetchCoaches(): Promise<CoachProfile[]> {
  try {
    const res = await fetch("/api/db/coach");
    if (!res.ok) return mockCoaches;
    const data = await res.json();
    if (!data?.coaches || data.coaches.length === 0) return mockCoaches;

    return data.coaches.map((c: {
      id: string; name: string; avatar_url: string | null;
      headline: string | null; industry: string | null;
      years_experience: number; rate_per_hour: number;
      rating: number; sessions_count: number;
      available_slots: unknown; coach_type: string;
    }) => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`,
      headline: c.headline || "",
      industry: c.industry || "",
      yearsExperience: c.years_experience,
      ratePerHour: c.rate_per_hour,
      rating: Number(c.rating) || 0,
      sessionsCount: c.sessions_count,
      availableSlots: Array.isArray(c.available_slots)
        ? c.available_slots as { day: string; time: string }[]
        : [],
      coachType: c.coach_type,
    }));
  } catch {
    return mockCoaches;
  }
}

export const mockCareerPaths = [
  { id: "ai-product", label: "AI 产品", color: "#1c1917" },
  { id: "management-consulting", label: "管理咨询", color: "#57534e" },
  { id: "data-science", label: "数据科学", color: "#292524" },
  { id: "design-ux", label: "设计/UX", color: "#44403c" },
  { id: "brand-marketing", label: "品牌/市场", color: "#78716c" },
  { id: "startup", label: "创业", color: "#a8a29e" },
  { id: "finance", label: "金融/投资", color: "#d6d3d1" },
  { id: "content", label: "内容/创作者", color: "#e7e5e4" },
];

export const mockSimulatorScenarios = {
  "day-in-life": [
    {
      id: "pm-day",
      role: "产品经理",
      title: "产品经理的一天",
      description: "体验一位AI产品经理从早会到上线复盘的完整工作流",
      tasks: [
        { title: "参加产品晨会", prompt: "团队正在讨论新功能的优先级，你需要给出判断" },
        { title: "撰写PRD文档", prompt: "为一个AI对话功能设计核心交互流程" },
        { title: "与设计师评审", prompt: "设计师提出了简化方案，你需要评估取舍" },
        { title: "数据复盘", prompt: "上周上线功能数据不达预期，分析原因" },
      ],
    },
    {
      id: "ds-day",
      role: "数据科学家",
      title: "数据科学家的一天",
      description: "从数据清洗到模型部署，体验真实的数据科学工作",
      tasks: [
        { title: "需求理解", prompt: "产品经理需要一个用户流失预测模型" },
        { title: "数据探索", prompt: "用户行为数据存在大量缺失值，你怎么处理" },
        { title: "特征工程", prompt: "选择哪些特征进入模型" },
        { title: "结果呈现", prompt: "向非技术背景的业务方汇报模型结果" },
      ],
    },
  ],
  interview: [
    {
      id: "pm-interview",
      role: "产品经理面试",
      title: "AI产品经理面试",
      description: "AI面试官将模拟真实面试场景",
    },
  ],
};
