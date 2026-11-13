/**
 * 简历 JD 定向优化 — AI 调用层
 * - generateJDAnalysis: 生成 7 维度岗位匹配分析报告
 * - rewriteResume: 全量改写简历（保留排版结构）
 * - rewriteSingleBlock: 单段重生成
 */
import { generateChat } from "./ai";
import type {
  ResumeBlock,
  JDAnalysisReport,
  RewriteStrategy,
} from "./resumeOptimizeTypes";

const DISCLAIMER =
  "AI 仅做话术优化和岗位匹配分析，不代表保证面试通过；所有内容基于候选人真实经历改写，禁止虚构项目、数据与任职经历。";

/** 从 AI 响应里提取 JSON（容错 markdown 代码块、前后多余文字） */
function extractJson(raw: string): string {
  // 优先匹配 ```json ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // 否则取第一个 { 到最后一个 }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw.trim();
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    return fallback;
  }
}

const STRATEGY_PROMPT: Record<RewriteStrategy, string> = {
  conservative:
    "【保守微调】只做关键词对齐和话术润色，不新增不存在的经历、不夸大成果、不编造数据。把原有描述的动词和成果对齐 JD 关键词。",
  moderate:
    "【适度强化】在真实经历基础上强化与 JD 匹配的成果描述、量化已有产出，但不虚构不存在的项目或数据。",
  aggressive:
    "【大胆重构】允许对已有经历做较大幅度的话术重塑，突出 JD 看重的能力，可适当提炼可迁移能力，但仍禁止编造不存在的项目、任职经历和数据。",
};

// ─── 1. JD 定向分析报告 ──────────────────────────────────────────

export async function generateJDAnalysis(
  resumeBlocks: ResumeBlock[],
  jdText: string
): Promise<JDAnalysisReport> {
  const resumeText = resumeBlocks.map((b) => b.text).join("\n");

  const systemPrompt = `你是资深招聘官与简历优化专家。请基于候选人简历与目标 JD，输出一份结构化的岗位定向匹配分析报告。
核心原则：
- 只基于简历中真实存在的内容分析，不臆造候选人经历
- 客观评估匹配度，不美化
- 明确区分"已有"与"缺失"
- 风险提示要具体，指出哪些内容不能编造
- 严格返回 JSON，不要 markdown 代码块外的文字`;

  const userMessage = `【候选人简历】
${resumeText.slice(0, 6000)}

【目标岗位 JD】
${jdText.slice(0, 4000)}

请输出以下 JSON（不要输出 JSON 以外的任何文字）：
{
  "matchScore": 0-100的匹配度数字,
  "matchedKeywords": ["JD关键词1", "JD关键词2"],
  "missingKeywords": ["缺失的关键词"],
  "coreCompetencies": ["候选人核心能力1"],
  "projectHighlights": ["项目经历亮点"],
  "certifications": ["证书清单，没有则空数组"],
  "softSkills": ["软技能"],
  "coreResponsibilities": ["JD核心职责"],
  "hardRequirements": ["JD硬性门槛"],
  "preferredQualifications": ["优先加分项"],
  "implicitRequirements": ["隐性要求"],
  "teamPreferences": ["团队偏好"],
  "feasibility": "high或medium或low",
  "feasibilityReason": "可行性理由，150-200字",
  "gapList": {
    "hardGap": ["硬门槛差距"],
    "experienceGap": ["经验短板"],
    "skillGap": ["技能缺口"]
  },
  "shortTermActions": ["短期可做的简历包装优化项"],
  "longTermActions": ["中长期需补充的项目/证书/经历"],
  "fabricationRisks": ["绝对不能编造的经历项"],
  "backgroundCheckRisks": ["背调可能踩坑的描述"],
  "wordingBoundaries": ["简历话术边界提醒"],
  "optimizationStrategy": "AI接下来修改简历的整体思路，120-180字",
  "modulesToStrengthen": ["需要重点强化的模块"],
  "modulesToWeaken": ["需要弱化的无关内容"],
  "disclaimer": "${DISCLAIMER}"
}`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 4096, temperature: 0.3 }
  );

  const fallback: JDAnalysisReport = {
    matchScore: 0,
    matchedKeywords: [],
    missingKeywords: [],
    coreCompetencies: [],
    projectHighlights: [],
    certifications: [],
    softSkills: [],
    coreResponsibilities: [],
    hardRequirements: [],
    preferredQualifications: [],
    implicitRequirements: [],
    teamPreferences: [],
    feasibility: "low",
    feasibilityReason: "分析失败，请重试",
    gapList: { hardGap: [], experienceGap: [], skillGap: [] },
    shortTermActions: [],
    longTermActions: [],
    fabricationRisks: [],
    backgroundCheckRisks: [],
    wordingBoundaries: [],
    optimizationStrategy: "",
    modulesToStrengthen: [],
    modulesToWeaken: [],
    disclaimer: DISCLAIMER,
  };

  return safeParse(result.content, fallback);
}

// ─── 2. 全量改写简历 ─────────────────────────────────────────────

export async function rewriteResume(
  blocks: ResumeBlock[],
  jdText: string,
  strategy: RewriteStrategy
): Promise<ResumeBlock[]> {
  const resumeText = blocks
    .map((b, i) => `[${i}](${b.type}) ${b.text}`)
    .join("\n");

  const systemPrompt = `你是简历优化专家。任务：基于 JD 定向改写候选人简历。
${STRATEGY_PROMPT[strategy]}

排版第一原则（最高优先级）：
- 必须严格保留原始简历的全部排版结构：模块数量、模块顺序、分割线、列表层级、分页位置
- 只修改文字内容，不新增/删减/合并原有区块，不改变段落类型
- 每个输入段落对应一个输出段落，id 必须原样返回
- 禁止编造不存在的项目、数据、任职经历
- 返回 JSON 数组，每个元素 { "id": "原id", "text": "改写后文字" }，不要返回 JSON 以外的文字`;

  const userMessage = `【目标 JD】
${jdText.slice(0, 4000)}

【原始简历（带段落编号与类型）】
${resumeText.slice(0, 8000)}

请输出 JSON 数组，每个元素为 { "id": "段落id", "text": "改写后的文字" }。只返回 JSON，不要其他文字。`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 8192, temperature: 0.4 }
  );

  const rewritten = safeParse<{ id: string; text: string }[]>(result.content, []);

  // 按 id 匹配回原 blocks，保留原始类型与样式
  const textMap = new Map(rewritten.map((r) => [r.id, r.text]));
  return blocks.map((b) => ({
    ...b,
    text: textMap.get(b.id) ?? b.text,
  }));
}

// ─── 3. 单段重生成 ───────────────────────────────────────────────

export async function rewriteSingleBlock(
  block: ResumeBlock,
  allBlocks: ResumeBlock[],
  jdText: string,
  strategy: RewriteStrategy
): Promise<ResumeBlock> {
  // 取该段落前后各 2 段作为上下文
  const idx = allBlocks.findIndex((b) => b.id === block.id);
  const context = allBlocks
    .slice(Math.max(0, idx - 2), Math.min(allBlocks.length, idx + 3))
    .map((b) => `(${b.type}) ${b.text}`)
    .join("\n");

  const systemPrompt = `你是简历优化专家。任务：仅针对选中的一个段落进行定向改写。
${STRATEGY_PROMPT[strategy]}

规则：
- 只改写这一个段落，不改动其他任何段落
- 保留段落类型（标题/正文/列表项等），只改文字
- 结合 JD 关键词和上下文，让这段话更匹配目标岗位
- 禁止编造该段落中不存在的经历、数据
- 只返回改写后的纯文字，不要 JSON、不要引号、不要解释`;

  const userMessage = `【目标 JD】
${jdText.slice(0, 3000)}

【上下文（前后段落）】
${context}

【当前选中段落（仅改写这一段）】
类型: ${block.type}
原文: ${block.text}

请直接输出改写后的文字：`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 1024, temperature: 0.4 }
  );

  return {
    ...block,
    text: result.content.trim().replace(/^["']|["']$/g, ""),
  };
}
