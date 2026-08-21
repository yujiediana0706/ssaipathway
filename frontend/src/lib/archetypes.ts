export interface PersonalityArchetype {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  funTitle: string;
  funTagline: string;
  role: string;
  traits: string[];
  strengths: string[];
  description: string;
  color: string;
  bgGradient: string;
  famousExample: string;
  cartoonPrompt: string;
}

const ARCHETYPES: Record<string, PersonalityArchetype> = {
  commander: {
    id: "commander",
    emoji: "⚡",
    name: "指挥官",
    tagline: "果断决策，冲锋在前",
    funTitle: "天选卷王",
    funTagline: "加班使我快乐，KPI就是我的多巴胺",
    role: "决策领导者 / 产品操盘手",
    traits: ["目标导向", "果断行动", "抗压能力强"],
    strengths: ["快速决策", "资源整合", "团队推动"],
    description:
      "你是天生的指挥官——目标明确，行动迅速。在混乱中你能看清方向，在压力下你能做出决断。适合负责战略规划、团队管理和关键项目的推进。",
    color: "text-rose-700",
    bgGradient: "from-rose-50 to-orange-50",
    famousExample: "史蒂夫·乔布斯",
    cartoonPrompt: "Cartoon style portrait of a confident young Chinese leader character, determined expression, standing in leadership pose, lightning bolt motif, warm rose and orange color scheme, soft rounded chibi style, professional friendly office background, white outline strokes, cute korean illustration style",
  },
  strategist: {
    id: "strategist",
    emoji: "🧠",
    name: "策略师",
    tagline: "洞察全局，跨界连接",
    funTitle: "脑力永动机",
    funTagline: "洗澡时都在想战略，连做梦都在做SWOT分析",
    role: "AI 产品策略师 / 增长策划",
    traits: ["系统思维", "跨界洞察", "创新驱动"],
    strengths: ["战略规划", "商业分析", "模式识别"],
    description:
      "你是一位出色的策略师——擅长从复杂信息中提炼结构，在不同领域间发现连接。你善于思考'为什么'和'还能怎样'，是产品创新和战略规划的核心人才。",
    color: "text-violet-700",
    bgGradient: "from-violet-50 to-indigo-50",
    famousExample: "彼得·蒂尔",
    cartoonPrompt: "Cartoon style portrait of a thoughtful young Chinese strategist character, hand on chin thinking, surrounded by floating ideas and lightbulbs, purple and indigo color palette, glasses, cozy study background, soft rounded chibi style, cute korean illustration style, white outline strokes",
  },
  mediator: {
    id: "mediator",
    emoji: "🌙",
    name: "调解者",
    tagline: "外柔内刚，洞察人心",
    funTitle: "团队端水大师",
    funTagline: "吵架？不存在的，这碗水我端得稳稳的",
    role: "用户体验专家 / 团队协调者",
    traits: ["共情能力强", "平衡各方", "细腻敏感"],
    strengths: ["用户洞察", "沟通协调", "关系建设"],
    description:
      "你是天生的调解者——能够看见每个人的需求，在冲突中找到平衡点。你的细腻让你擅长用户研究和团队协作，在外柔内刚的外表下有坚定的信念。",
    color: "text-teal-700",
    bgGradient: "from-teal-50 to-cyan-50",
    famousExample: "米歇尔·奥巴马",
    cartoonPrompt: "Cartoon style portrait of a gentle and caring young Chinese mediator character, soft smile, moon crescent motif, teal and cyan color scheme, plants and cozy tea room background, soft rounded chibi style, cute korean illustration style, white outline strokes, warm serene atmosphere",
  },
  architect: {
    id: "architect",
    emoji: "🏛️",
    name: "建筑师",
    tagline: "独立思考，长期主义",
    funTitle: "摸鱼哲学家",
    funTagline: "人生理想：朝九晚五，绝不加班，躺平就好",
    role: "技术架构师 / 系统设计师",
    traits: ["深度思考", "独立判断", "长期主义"],
    strengths: ["技术深度", "系统设计", "质量把控"],
    description:
      "你像一位建筑师——追求结构的稳固与设计的优雅。你不追逐潮流，而是相信长期积累的力量。适合负责技术架构、系统设计和复杂问题的深度解决。",
    color: "text-slate-700",
    bgGradient: "from-slate-50 to-gray-50",
    famousExample: "Linus Torvalds",
    cartoonPrompt: "Cartoon style portrait of a focused young Chinese architect character, holding blueprint paper, building structure motif in background, slate and gray with subtle blue tones, minimalist bookshelf behind, soft rounded chibi style, cute korean illustration style, white outline strokes, calm focused atmosphere",
  },
  adventurer: {
    id: "adventurer",
    emoji: "🚀",
    name: "冒险家",
    tagline: "拥抱变化，越挫越勇",
    funTitle: "折腾小能手",
    funTagline: "稳定是留给死人的，活着就要折腾！",
    role: "创业合伙人 / 创新先锋",
    traits: ["拥抱风险", "精力充沛", "快速迭代"],
    strengths: ["创业精神", "适应能力", "执行力"],
    description:
      "你是一位无畏的冒险家——在不确定性中看到机会，在压力下反而更有活力。适合创业、新产品孵化和需要快速试错的创新场景。",
    color: "text-amber-700",
    bgGradient: "from-amber-50 to-yellow-50",
    famousExample: "埃隆·马斯克",
    cartoonPrompt: "Cartoon style portrait of an energetic young Chinese adventurer character, thumbs up dynamic pose, rocket or compass motif, amber and yellow bright colors, mountain and sky in background, soft rounded chibi style, cute korean illustration style, white outline strokes, optimistic energetic vibe",
  },
  mentor: {
    id: "mentor",
    emoji: "🌱",
    name: "导师",
    tagline: "润物无声，远见卓识",
    funTitle: "职场老妈子",
    funTagline: "来，让妈给你讲讲人生道理，顺便帮你规划下职业",
    role: "团队教练 / 产品导师",
    traits: ["耐心引导", "全局视野", "善于赋能"],
    strengths: ["人才培养", "知识沉淀", "文化建设"],
    description:
      "你是天生的导师——相信每个人都有潜力，善于创造让他人成长的环境。你看重过程胜过结果，擅长团队建设和组织知识管理。",
    color: "text-emerald-700",
    bgGradient: "from-emerald-50 to-green-50",
    famousExample: "比尔·坎贝尔",
    cartoonPrompt: "Cartoon style portrait of a warm wise young Chinese mentor character, watering a little growing plant, teaching pose with open hands, emerald and green color palette, garden or classroom background, soft rounded chibi style, cute korean illustration style, white outline strokes, kind nurturing feeling",
  },
};

export function determineArchetype(input: string): PersonalityArchetype {
  const p = String(input || "").toLowerCase();

  // 新格式：archetype:xxx
  const tagMatch = p.match(/archetype:([a-z]+)/);
  if (tagMatch) {
    const key = tagMatch[1];
    if (ARCHETYPES[key]) return ARCHETYPES[key];
  }

  // 兼容旧格式：咖啡/塔罗
  if (p.includes("浓缩") || p.includes("☕")) {
    if (p.includes("闪电") || p.includes("⚡")) return ARCHETYPES.commander;
    if (p.includes("水晶") || p.includes("🔮")) return ARCHETYPES.strategist;
    if (p.includes("月亮") || p.includes("🌙")) return ARCHETYPES.mediator;
  }
  if (p.includes("珍珠") || p.includes("🧋")) {
    if (p.includes("水晶") || p.includes("🔮")) return ARCHETYPES.strategist;
    if (p.includes("闪电") || p.includes("⚡")) return ARCHETYPES.adventurer;
    if (p.includes("太阳") || p.includes("🌅")) return ARCHETYPES.mentor;
  }
  if (p.includes("抹茶") || p.includes("🍵")) {
    if (p.includes("月亮") || p.includes("🌙")) return ARCHETYPES.mediator;
    if (p.includes("星星") || p.includes("🌲")) return ARCHETYPES.architect;
    if (p.includes("愚人") || p.includes("🎭")) return ARCHETYPES.adventurer;
  }
  if (p.includes("手工") || p.includes("🍺")) {
    if (p.includes("星星") || p.includes("🌲")) return ARCHETYPES.architect;
    if (p.includes("闪电") || p.includes("⚡")) return ARCHETYPES.commander;
    if (p.includes("太阳") || p.includes("🌅")) return ARCHETYPES.mentor;
  }
  if (p.includes("能量") || p.includes("🥤")) {
    if (p.includes("愚人") || p.includes("🎭")) return ARCHETYPES.adventurer;
    if (p.includes("闪电") || p.includes("⚡")) return ARCHETYPES.commander;
    if (p.includes("水晶") || p.includes("🔮")) return ARCHETYPES.strategist;
  }
  if (p.includes("手冲") || p.includes("🏠")) {
    if (p.includes("太阳") || p.includes("🌅")) return ARCHETYPES.mentor;
    if (p.includes("星星") || p.includes("🌲")) return ARCHETYPES.architect;
    if (p.includes("月亮") || p.includes("🌙")) return ARCHETYPES.mediator;
  }

  // 根据 archetype id 全词匹配
  for (const key of Object.keys(ARCHETYPES)) {
    if (p.includes(key)) return ARCHETYPES[key];
  }

  // 兜底：hash 决定
  const hash = Array.from(p).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const keys = Object.keys(ARCHETYPES);
  return ARCHETYPES[keys[Math.max(0, hash) % keys.length]];
}

export const ALL_ARCHETYPES = Object.values(ARCHETYPES);

/* 卡通人物形象 URL：基于 text_to_image 生成的 prompt URL */
export function getArchetypeCartoonUrl(a: PersonalityArchetype, size = "portrait_4_3"): string {
  const base = "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image";
  const prompt = encodeURIComponent(a.cartoonPrompt);
  return `${base}?prompt=${prompt}&image_size=${size}`;
}
