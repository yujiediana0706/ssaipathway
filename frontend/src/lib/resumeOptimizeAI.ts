/**
 * 简历 JD 定向优化 — AI 调用层
 * - generateJDAnalysis: 生成 7 维度岗位匹配分析报告
 * - rewriteResume: 全量改写简历（保留排版结构）
 * - rewriteSingleBlock: 单段重生成
 */
import { generateChat } from "./ai";
import { sanitizeForWord } from "./docxExport";
import type {
  ResumeBlock,
  JDAnalysisReport,
  RewriteStrategy,
} from "./resumeOptimizeTypes";

const DISCLAIMER =
  "AI 仅做话术优化和岗位匹配分析，不代表保证面试通过；所有内容基于候选人真实经历改写，禁止虚构项目、数据与任职经历。";

/** 简历优化是质量敏感任务，默认用更强的模型（可用环境变量覆盖） */
const MODEL = process.env.RESUME_OPTIMIZE_MODEL || "glm-4.6";

/** 从 AI 响应里提取 JSON（容错 markdown 代码块、前后多余文字） */
function extractJson(raw: string): string {
  // 优先匹配 ```json ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // 否则优先按数组截取（批量改写返回的是数组），再退回对象
  const firstArr = raw.indexOf("[");
  const lastArr = raw.lastIndexOf("]");
  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (
    firstArr !== -1 &&
    lastArr > firstArr &&
    (firstObj === -1 || firstArr < firstObj)
  ) {
    return raw.slice(firstArr, lastArr + 1);
  }
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    return raw.slice(firstObj, lastObj + 1);
  }
  return raw.trim();
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(extractJson(raw));
    // deep merge：AI 返回的字段覆盖 fallback，缺失字段保留 fallback 的默认值
    return deepMerge(fallback as Record<string, unknown>, parsed) as T;
  } catch {
    return fallback;
  }
}

/** 深度合并：source 覆盖 target 同名字段，source 缺失的字段保留 target 的值 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: unknown): T {
  if (source == null || typeof source !== "object") return target;
  const src = source as Record<string, unknown>;
  const out: Record<string, unknown> = { ...target };
  for (const key of Object.keys(src)) {
    const sv = src[key];
    const tv = target[key];
    if (
      sv != null &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv != null &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      out[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>
      );
    } else if (Array.isArray(sv)) {
      out[key] = sv;
    } else if (sv != null) {
      out[key] = sv;
    }
    // sv 为 null/undefined 时保留 tv（fallback 默认值）
  }
  return out as T;
}

/** 解析数组结果：模型输出被截断时，尽量抢救其中完整的对象 */
function safeParseArray<T>(raw: string): T[] {
  const json = extractJson(raw);
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as T[];
  } catch {
    /* 继续尝试逐段抢救 */
  }
  const out: T[] = [];
  for (const m of json.match(/\{(?:[^{}]|\\.)*\}/g) ?? []) {
    try {
      out.push(JSON.parse(m) as T);
    } catch {
      /* 跳过损坏片段 */
    }
  }
  return out;
}

const STRATEGY_PROMPT: Record<RewriteStrategy, string> = {
  conservative:
    "【保守微调】只做关键词对齐和话术润色，不新增不存在的经历、不夸大成果、不编造数据。注意：即使保守，每段也仍要围绕目标岗位调整表述，不得输出“保持原文不变”。",
  moderate:
    "【适度强化】在真实经历基础上强化与 JD 匹配的成果描述、量化已有产出，个人简介等主观段落必须改写为面向目标岗位的版本，但不虚构项目或数据。",
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

请输出以下 JSON（严格只输出 JSON，不要 markdown 或额外文字）：
{
  "highlights": {
    "keyExperience": "简历中与本JD最匹配的1段经历（写明是哪段+为什么匹配，50字内）",
    "keyCompetency": "候选人应重点强调的1-2项核心能力（写明能力+依据，50字内）",
    "keyGap": "候选人当前与JD差距最大的部分（写明缺什么，50字内）"
  },
  "matchScore": 0-100,
  "matchedKeywords": ["JD关键词"],
  "missingKeywords": ["缺失关键词"],
  "coreCompetencies": ["候选人核心能力"],
  "projectHighlights": ["项目亮点"],
  "certifications": ["证书清单，没有则空数组"],
  "softSkills": ["软技能"],
  "coreResponsibilities": ["JD核心职责"],
  "hardRequirements": ["JD硬性门槛"],
  "preferredQualifications": ["优先加分项"],
  "implicitRequirements": ["隐性要求"],
  "teamPreferences": ["团队偏好"],
  "feasibility": "high" | "medium" | "low",
  "feasibilityReason": "120字以内",
  "gapList": {
    "hardGap": ["硬门槛差距"],
    "experienceGap": ["经验短板"],
    "skillGap": ["技能缺口"]
  },
  "shortTermActions": ["简历包装可做的事"],
  "longTermActions": ["中长期要补的事"],
  "fabricationRisks": ["绝对不能编造的内容"],
  "backgroundCheckRisks": ["背调踩坑"],
  "wordingBoundaries": ["话术边界"],
  "optimizationStrategy": "AI改写简历的整体思路，100字内",
  "modulesToStrengthen": ["需强化的模块"],
  "modulesToWeaken": ["需弱化的无关模块"],
  "disclaimer": "${DISCLAIMER}"
}`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 4096, temperature: 0.3, model: MODEL, thinking: false }
  );

  const fallback: JDAnalysisReport = {
    highlights: {
      keyExperience: "",
      keyCompetency: "",
      keyGap: "",
    },
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

/** 一页纸模式的篇幅预算（按 A4 + 小字号紧排版估算，取值偏保守） */
const ONE_PAGE_LINES = 60; // 可用行数（含标题与段落间距折算）
const ONE_PAGE_CHARS_PER_LINE = 52; // 每行中文字符数
const ONE_PAGE_HEADING_CHARS = 24; // 标题最多 1 行
const ONE_PAGE_MAX_LINES_PER_BLOCK = 5;

/** 计算每个段落在「一页纸」下的字数上限 */
function buildOnePageLimits(blocks: ResumeBlock[]): Map<string, number> {
  const limits = new Map<string, number>();
  const headings = blocks.filter((b) => b.type.startsWith("heading"));
  const contentBlocks = blocks.filter(
    (b) => !b.type.startsWith("heading") && b.type !== "divider"
  );

  headings.forEach((b) => limits.set(b.id, ONE_PAGE_HEADING_CHARS));
  if (contentBlocks.length === 0) return limits;

  // 预留 2 行给姓名 / 联系方式
  const availLines = Math.max(
    contentBlocks.length,
    ONE_PAGE_LINES - headings.length - 2
  );

  // 按原文长度加权分配行数，短段落只给 1 行，单段最多 5 行
  const weights = contentBlocks.map((b) => Math.max(16, b.text?.length || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const lines = contentBlocks.map((_, i) =>
    Math.min(
      ONE_PAGE_MAX_LINES_PER_BLOCK,
      Math.max(1, Math.round((availLines * weights[i]) / totalWeight))
    )
  );

  // 修正到正好用完可用行数
  let sum = lines.reduce((a, b) => a + b, 0);
  while (sum > availLines) {
    // 从行数最多的段落开始扣减（至少保留 1 行）
    const idx = lines.indexOf(Math.max(...lines));
    if (lines[idx] <= 1) break;
    lines[idx] -= 1;
    sum -= 1;
  }
  while (sum < availLines) {
    // 优先补给原文最长的段落
    let best = -1;
    let bestWeight = -1;
    lines.forEach((l, i) => {
      if (l < ONE_PAGE_MAX_LINES_PER_BLOCK && weights[i] > bestWeight) {
        bestWeight = weights[i];
        best = i;
      }
    });
    if (best < 0) break;
    lines[best] += 1;
    sum += 1;
  }

  contentBlocks.forEach((b, i) =>
    limits.set(b.id, lines[i] * ONE_PAGE_CHARS_PER_LINE)
  );
  return limits;
}

/** 按字数上限截断，尽量在标点处断开 */
function clampToLimit(text: string, limit: number): string {
  if (!text || text.length <= limit) return text;
  const head = text.slice(0, limit);
  const lastPunct = Math.max(
    head.lastIndexOf("；"),
    head.lastIndexOf("。"),
    head.lastIndexOf("，"),
    head.lastIndexOf("、"),
    head.lastIndexOf(" ")
  );
  // 断点太靠前就不要了，避免只剩半句
  const cut = lastPunct > limit * 0.6 ? lastPunct : limit;
  return head.slice(0, cut).replace(/[，、；\s]+$/, "");
}

export async function rewriteResume(
  blocks: ResumeBlock[],
  jdText: string,
  strategy: RewriteStrategy,
  report?: JDAnalysisReport | null,
  onePage = false
): Promise<ResumeBlock[]> {
  const reportContext = report
    ? `【上一轮岗位匹配分析结论（务必据此改写）】
最匹配的经历：${report.highlights?.keyExperience || "（无）"}
应重点强调的能力：${report.highlights?.keyCompetency || "（无）"}
最大差距：${report.highlights?.keyGap || "（无）"}
缺失关键词：${(report.missingKeywords || []).slice(0, 12).join("、") || "（无）"}
需要强化的模块：${(report.modulesToStrengthen || []).join("、") || "（无）"}
整体改写思路：${report.optimizationStrategy || "（无）"}
`
    : "";

  const onePageLimits = onePage ? buildOnePageLimits(blocks) : null;

  const onePagePrompt = onePage
    ? `
【篇幅硬约束（最高优先级，违反即失败）】
- 这份简历最终必须完整放进**一页 A4 纸**，总字数必须控制在 2000 字以内
- 每个段落都有明确的字数上限（见输入里的 limit），**不得超过 limit 字数**
- 超限的写法必须主动删减：去掉修饰性形容词、合并重复表述、省略次要细节
- 标题保持一行（不超过 24 字），列表项每条不超过 2 行
- 宁可信息密度高，也不要为了文采取牺牲篇幅
`
    : "";

  const systemPrompt = `你是资深简历顾问，正在把一份候选人的简历改造成**专门投递目标岗位**的版本。
${STRATEGY_PROMPT[strategy]}

${reportContext}
${onePagePrompt}
目标岗位导向原则（最高优先级）：
- 这份简历的唯一目标是让目标岗位的招聘方认为"这个人就是我们要找的"，所有段落都要为这个岗位服务
- 个人简介 / 自我评价 / 求职意向：必须重写为面向目标岗位的版本。原简历里与该岗位无关的地域倾向、临时活动、校园项目等表述必须改写或删除（例如原文强调"海南国际教育创新岛"，而目标是抖音内容运营时，就不能保留海南相关表述）
- 每段改写前先自问：这段内容对目标岗位的招聘方有说服力吗？不够就重新组织表达，突出与 JD 相关的可迁移能力
- 除姓名、联系方式、学校名称、公司名称、时间等客观事实外，**不允许输出"保持原文""无需改写""内容详实"这类偷懒结论**，每段都要给出针对该 JD 的改写版本
- 禁止编造不存在的项目、数据、任职经历；可以重新组织措辞、调整侧重、提炼可迁移能力

排版要求：
- 必须严格保留原始简历的排版结构：模块数量、模块顺序、分割线、列表层级
- 只修改文字内容，不新增/删减/合并原有区块，不改变段落类型
- 每个输入段落对应一个输出段落，id 必须原样返回
${onePage ? "- 每个段落严格不超过给定的 limit 字数，这是硬性要求" : "- 改写后长度尽量与原段落接近；标题保持一行，列表项不要膨胀成大段文字"}
- 返回 JSON 数组，每个元素 { "id": "原样复制的 id", "text": "改写后文字", "reason": "这次改写对齐了哪些 JD 要求，30字以内" }
- 只允许使用 text 字段承载改写结果，不要用 content 等其他字段名
- id 必须逐字复制输入里 id="..." 的内容（形如 b1abc2_3），不要用序号、不要自己编造
- 只返回 JSON，不要其他文字`;

  // 分批改写：单次输出过长会被截断，导致部分段落原文返回
  const BATCH_SIZE = 12;
  const CONCURRENCY = 3;

  const batches: ResumeBlock[][] = [];
  for (let start = 0; start < blocks.length; start += BATCH_SIZE) {
    batches.push(blocks.slice(start, start + BATCH_SIZE));
  }

  // 分批并发（限 3 路），避免整份简历串行等待过久
  const outputs: ResumeBlock[][] = new Array(batches.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < batches.length) {
      const batchIndex = cursor;
      cursor += 1;
      outputs[batchIndex] = await rewriteBatch(
        batches[batchIndex],
        jdText,
        systemPrompt,
        onePageLimits,
        onePage
      );
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker())
  );

  return outputs.flat();
}

async function rewriteBatch(
  batch: ResumeBlock[],
  jdText: string,
  systemPrompt: string,
  limits?: Map<string, number> | null,
  onePage = false
): Promise<ResumeBlock[]> {
  const resumeText = batch
    .map((b) => {
      const limit = limits?.get(b.id);
      const limitTag = limit ? ` limit=${limit}字` : "";
      return `id="${b.id}" type=${b.type}${limitTag}\n${b.text}`;
    })
    .join("\n\n");

  const userMessage = `【目标 JD】
${jdText.slice(0, 3000)}

【原始简历片段（带段落 id、类型${onePage ? "、字数上限 limit" : ""}）】
${resumeText.slice(0, 6000)}

请输出 JSON 数组，每个元素为 { "id": "段落id", "text": "改写后的文字", "reason": "为什么这么改，一句话" }。${onePage ? "改写后每段字数必须 ≤ 对应 limit。" : ""}只返回 JSON，不要其他文字。`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 4096, temperature: 0.5, model: MODEL, thinking: false }
  );

  const rewritten = safeParseArray<{
    id?: string;
    text?: string;
    content?: string;
    reason?: string;
  }>(result.content);

  // 模型偶尔把 text 写成 content，这里统一取值
  const pickText = (r?: { text?: string; content?: string }): string => {
    const raw = (r?.text ?? r?.content ?? "").trim();
    // AI 返回可能带零宽字符、Markdown 残留、emoji，统一清洗
    return sanitizeForWord(raw);
  };

  const map = new Map(rewritten.map((r) => [String(r.id ?? "").trim(), r]));
  const idMatched = batch.some((b) => map.has(b.id));

  if (rewritten.length === 0) {
    console.warn(
      "[resumeOptimizeAI] 改写结果解析为空，原始返回：",
      result.content.slice(0, 500)
    );
  } else if (!idMatched) {
    console.warn(
      "[resumeOptimizeAI] 改写结果 id 与原文不匹配，改用顺序对齐。样例：",
      rewritten[0]
    );
  }

  return batch.map((b, i) => {
    // 优先按 id 匹配；模型把 id 写成序号时，退化为按段落顺序对齐
    const r = map.get(b.id) ?? (idMatched ? undefined : rewritten[i]);
    let text = pickText(r) || sanitizeForWord(b.text);
    // 一页纸模式：最后一层硬兜底，AI 超限的直接按字数截断
    const limit = limits?.get(b.id);
    if (onePage && limit) text = clampToLimit(text, limit);
    return {
      ...b,
      text,
      reason: r?.reason,
    };
  });
}

// ─── 3. 单段重生成 ───────────────────────────────────────────────

export async function rewriteSingleBlock(
  block: ResumeBlock,
  allBlocks: ResumeBlock[],
  jdText: string,
  strategy: RewriteStrategy,
  onePage = false
): Promise<ResumeBlock> {
  // 取该段落前后各 2 段作为上下文
  const idx = allBlocks.findIndex((b) => b.id === block.id);
  const context = allBlocks
    .slice(Math.max(0, idx - 2), Math.min(allBlocks.length, idx + 3))
    .map((b) => `(${b.type}) ${b.text}`)
    .join("\n");

  // 一页纸模式：该段落的字数上限
  const blockLimit = onePage
    ? buildOnePageLimits(allBlocks).get(block.id) || block.text.length
    : undefined;

  const systemPrompt = `你是资深简历顾问。任务：仅针对选中的一个段落，把它改写成专门服务目标岗位的版本。
${STRATEGY_PROMPT[strategy]}

规则：
- 只改写这一个段落，不改动其他任何段落
- 保留段落类型（标题/正文/列表项等），只改文字
- ${blockLimit ? `改写后字数必须 ≤ ${blockLimit} 字（简历需放进一页纸），超限必须删减` : "改写后长度尽量接近原文，避免破坏排版"}
- 必须让这段话明显更贴合 JD：替换无关的行业/地域/活动表述，突出与 JD 相关的关键词和可迁移能力
- 若该段是个人简介/自我评价，必须面向目标岗位重写，不能保留与岗位无关的内容
- 禁止编造该段落中不存在的经历、数据
- 返回 JSON：{ "text": "改写后文字", "reason": "对齐了哪些 JD 要求，30字以内" }，不要 JSON 以外的文字`;

  const userMessage = `【目标 JD】
${jdText.slice(0, 3000)}

【上下文（前后段落）】
${context}

【当前选中段落（仅改写这一段）】
类型: ${block.type}
原文: ${block.text}${blockLimit ? `\n字数上限: ${blockLimit} 字` : ""}

请输出 JSON：{ "text": "改写后的文字", "reason": "为什么这么改" }`;

  const result = await generateChat(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    { maxTokens: 1024, temperature: 0.5, model: MODEL, thinking: false }
  );

  const parsed = safeParse<{ text?: string; content?: string; reason?: string }>(
    result.content,
    {}
  );
  let text = sanitizeForWord((parsed.text ?? parsed.content ?? "").trim());
  if (!text) {
    // 模型未按 JSON 返回时，退化为使用纯文本，避免整段内容不变
    const plain = result.content
      .replace(/^```[a-z]*\s*/i, "")
      .replace(/```\s*$/, "")
      .replace(/^["']|["']$/g, "")
      .trim();
    text = plain.startsWith("{") ? "" : sanitizeForWord(plain);
  }

  if (blockLimit) text = clampToLimit(text, blockLimit);

  return {
    ...block,
    text: text || sanitizeForWord(block.text),
    reason: parsed.reason,
  };
}

// ─── 4. One Page 内容压缩 ────────────────────────────────────────

/**
 * 用 AI 把简历内容压缩到一页纸能放下。
 * 策略：每个段落压缩到原文的 60-70%，优先删除冗余修饰语和重复表述，
 * 保留核心事实（公司名、职位、时间、关键数据）。
 */
export async function compressBlocksForOnePage(
  blocks: ResumeBlock[]
): Promise<ResumeBlock[]> {
  const systemPrompt = `你是简历精简专家。任务：把简历内容压缩到一页 A4 纸能放下。

压缩原则：
- 每个段落压缩到原文的 50-70%，标题保持不变
- 保留核心事实：公司名、职位、时间、关键数据、核心成果
- 删除冗余修饰语、重复表述、空洞的形容词
- 用更精炼的表达替代啰嗦的句子
- 每个 bullet 最多 2 行文字
- 禁止编造不存在的经历或数据

返回 JSON 数组，每个元素 { "id": "段落id", "text": "压缩后文字" }。只返回 JSON。`;

  const BATCH_SIZE = 12;
  const batches: ResumeBlock[][] = [];
  for (let start = 0; start < blocks.length; start += BATCH_SIZE) {
    batches.push(blocks.slice(start, start + BATCH_SIZE));
  }

  const outputs: ResumeBlock[][] = [];
  for (const batch of batches) {
    const resumeText = batch
      .map((b) => `id="${b.id}" type=${b.type}\n${b.text}`)
      .join("\n\n");

    const userMessage = `【原始简历片段】
${resumeText.slice(0, 6000)}

请输出 JSON 数组，每个元素 { "id": "段落id", "text": "压缩后文字" }。标题段落（heading）保持原文不变。`;

    const result = await generateChat(
      [{ role: "user", content: userMessage }],
      systemPrompt,
      { maxTokens: 4096, temperature: 0.3, model: MODEL, thinking: false }
    );

    const compressed = safeParseArray<{ id?: string; text?: string }>(result.content);
    const map = new Map(compressed.map((r) => [String(r.id ?? "").trim(), r]));

    outputs.push(
      batch.map((b, i) => {
        const r = map.get(b.id) ?? compressed[i];
        const text = sanitizeForWord((r?.text ?? "").trim());
        // 标题不压缩，正文如果 AI 返回空则保留原文
        const isHeading = b.type.startsWith("heading");
        return {
          ...b,
          text: isHeading ? b.text : (text || b.text),
        };
      })
    );
  }

  return outputs.flat();
}
