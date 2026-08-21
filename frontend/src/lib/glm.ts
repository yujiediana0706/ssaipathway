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
const DEFAULT_MODEL = "glm-4";

function getGLMConfig() {
  const apiKey = process.env.GLM_API_KEY ?? "";
  const endpoint = process.env.GLM_API_ENDPOINT ?? DEFAULT_ENDPOINT;
  const model = process.env.GLM_MODEL ?? DEFAULT_MODEL;
  return { apiKey, endpoint, model };
}

function isMockMode(): boolean {
  return !process.env.GLM_API_KEY;
}

export async function parseStreamToText(
  response: Response
): Promise<{ content: string; usage?: GLMUsage }> {
  if (!response.body) {
    return { content: "" };
  }

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

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") break;

        try {
          const chunk: GLMStreamChunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
          }
          if (chunk.choices?.[0]?.finish_reason) {
            const lastChunk = chunk as unknown as { usage?: GLMUsage };
            if (lastChunk.usage) {
              usage = lastChunk.usage;
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content: fullContent, usage };
}

function buildMockSystemPrompt(role: string): string {
  return `你是Pathway,一个AI职业转型平台的${role}。请用中文提供专业、实用、温暖的建议。回答要具有可操作性,避免空泛。`;
}

function mockChatResponse(messages: ChatMessage[]): string {
  const lastUserMsg =
    messages.filter((m) => m.role === "user").pop()?.content ?? "";

  if (lastUserMsg.includes("你好") || lastUserMsg.includes("hello")) {
    return "你好!我是Pathway的AI助手,很高兴见到你。我可以帮助你进行职业诊断、技能规划、模拟面试等。请告诉我你目前的职业情况,我来帮你分析。";
  }

  if (lastUserMsg.includes("转型") || lastUserMsg.includes("转行")) {
    return "职业转型是一个系统性工程,关键在于三步:1) 精准定位目标方向;2) 评估现有技能与目标的差距;3) 制定分阶段的行动计划。建议你先完成Pathway的职业诊断,它会基于你的背景给出具体的可行性分析和技能路线图。";
  }

  return `收到你的问题:"${lastUserMsg}"。在正式API接入后,你将获得由智谱AI大模型生成的专业回答。当前为演示模式。你可以通过设置 GLM_API_KEY 环境变量来启用真实AI能力。`;
}

function mockDiagnosticReport(profile: DiagnosticReportInput): DiagnosticReport {
  const now = new Date().toISOString();
  const id = `dr-${Date.now()}`;
  const targetRole = profile.targetRole ?? "AI产品经理";

  return {
    id,
    userId: profile.id ?? "demo-user",
    createdAt: now,
    matchScore: Math.floor(Math.random() * 30) + 55,
    currentAssessment: `你目前是${profile.currentRole},具备${profile.skills.join("、")}等技能。这些经验对转型到${targetRole}有一定的基础,特别是在逻辑思维和项目管理方面。`,
    feasibility:
      "中等偏高可行性。你的背景与目标岗位存在交集,通过系统性学习和实践积累,预计可以在6-12个月内完成转型。关键在于补充AI领域的专业知识和构建相关项目经验。",
    skillsToAcquire: [
      { name: "AI/LLM基础原理", priority: "high" },
      { name: "Prompt工程", priority: "high" },
      { name: "AI产品设计方法论", priority: "high" },
      { name: "数据思维与分析", priority: "medium" },
      { name: "机器学习基础", priority: "medium" },
      { name: "AI伦理与安全", priority: "low" },
    ],
    actionPlan: [
      {
        phase: "第1-2个月:基础构建",
        steps: [
          "系统学习AI/LLM核心概念",
          "完成2-3个Prompt工程实战项目",
          "阅读AI产品经理经典案例",
        ],
      },
      {
        phase: "第3-4个月:实践积累",
        steps: [
          "参与AI相关开源项目或副业项目",
          "学习数据分析工具(Python/SQL)",
          "撰写AI产品分析文章",
        ],
      },
      {
        phase: "第5-6个月:转型冲刺",
        steps: [
          "构建完整的AI产品作品集",
          "在Pathway进行模拟面试训练",
          "对接猎头和行业人脉,开始投递简历",
        ],
      },
    ],
    possiblePaths: [
      {
        title: "AI产品经理",
        description:
          "聚焦AI产品设计、功能规划与落地,是当前最热门的转型方向之一。",
      },
      {
        title: "AI应用工程师",
        description:
          "偏技术方向,需要掌握LLM应用开发框架(LangChain等)和工程实践。",
      },
      {
        title: "AI内容创作者",
        description:
          "结合AI工具进行内容生产,适合有写作和创意背景的转型者。",
      },
    ],
  };
}

function mockCoachReply(userMessage: string, context: CoachContext): string {
  const name = context.userProfile?.name ?? "朋友";
  const topic =
    context.currentTopic ?? "职业发展";

  return `${name},你好!关于"${topic}"这个话题,我来分享一些想法:\n\n你提到"${userMessage}"——这是一个很关键的思考。在职业转型过程中,我们常常会面临不确定性,但正是这种不确定性带来了成长的可能。\n\n我的建议是:\n1. 先聚焦你当前最核心的困惑点,把大目标拆解成可执行的小步骤\n2. 每周留出时间做复盘,记录你的进展和感悟\n3. 找到同行者或导师,他们的经验会让你少走很多弯路\n\n你想先从哪个方面深入聊聊?`;
}

export async function generateChat(
  messages: ChatMessage[],
  systemPrompt?: string,
  maxTokens?: number
): Promise<{ content: string; usage?: GLMUsage }> {
  if (isMockMode()) {
    const content = mockChatResponse(messages);
    return {
      content,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  const { apiKey, endpoint, model } = getGLMConfig();

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: 0.7,
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  if (maxTokens) {
    payload.max_tokens = maxTokens;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GLM API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as GLMResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, usage: data.usage };
  } catch (error) {
    if (error instanceof Error && error.message.includes("GLM API error")) {
      throw error;
    }
    console.error("[GLM] generateChat failed, falling back to mock:", error);
    return {
      content: mockChatResponse(messages),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}

export async function generateChatStream(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  if (isMockMode()) {
    const mockContent = mockChatResponse(messages);
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const words = mockContent.split(/(\s+)/);

    for (const word of words) {
      const chunk = {
        id: `mock-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "mock-glm",
        choices: [
          {
            index: 0,
            delta: { content: word },
            finish_reason: null,
          },
        ],
      };
      chunks.push(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    }
    chunks.push(encoder.encode("data: [DONE]\n\n"));

    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }

  const { apiKey, endpoint, model } = getGLMConfig();

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GLM API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("GLM API response has no body");
  }

  return response.body;
}

export async function generateDiagnosticReport(
  userProfile: DiagnosticReportInput
): Promise<DiagnosticReport> {
  if (isMockMode()) {
    return mockDiagnosticReport(userProfile);
  }

  const { apiKey, endpoint, model } = getGLMConfig();
  const isExplorationMode = !userProfile.targetRole;

  // 构建 8 问选择摘要
  const exploreAnswersStr = userProfile.exploreAnswers
    ? Object.entries(userProfile.exploreAnswers)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "未提供";

  const archetypeScoresStr = userProfile.archetypeScores
    ? Object.entries(userProfile.archetypeScores)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v}分`)
        .join("、")
    : "未提供";

  // 简历内容
  const resumeContentStr = userProfile.resumeContent
    ? userProfile.resumeContent.slice(0, 3000)
    : "未上传简历";

  // 专注方向（用户切换主推方向时传入）
  const focusDirectionStr = userProfile.focusDirection
    ? `\n【用户选择的专注方向】\n用户已选择"${userProfile.focusDirection}"作为主推方向。请将possiblePaths中该方向放在第一位（matchScore最高），行动项和技能都围绕此方向展开。`
    : "";

  const systemPrompt = `你是Pathway的职业诊断专家，擅长结合用户的性格画像、职业经历和简历内容，给出客观、中立的转型建议。
重要原则：
- 客观现实：不要美化转型难度。比如0-1年经验的英语老师想转产品经理，现实中极其困难，要直接说明
- 中立语气：不要用"你一定可以"、"加油"、"相信你"等鼓励性话术，用客观分析代替
- 前置步骤：除了列出要补的技能，还要说明现实路径，比如"建议先做3-6个月产品实习"、"先用vibe coding搭建2-3个产品demo积累作品集"、"先从产品运营/助理岗切入再转正"
- 风险要具体：不要泛泛说"有风险"，要说"0-1年经验转产品经理的成功率不足5%"、"需要接受降薪50%+"等具体数字
报告要求：
1. 必须明确引用用户的性格选择和简历中的具体内容（如职位、公司、项目、技能），让用户感受到"小北真的读懂了我的简历"
2. 每个结论都要能追溯到用户的某个选择或简历中的某段经历
3. 不要空泛，要具体到"因为你简历中提到XX经历，说明你具备XX能力，但XX能力仍然缺失，需要先XX"
4. 简历分析要"少说事实、多说分析"——不要复述简历内容，而是分析：哪些技能和经验是可迁移的，哪些是硬缺口，可以带到什么岗位上，为什么
5. 探索模式下，possiblePaths第一个是主推方向（matchScore最高），行动项和技能都围绕这个主推方向展开
6. 推荐公司要真实存在的公司（国内为主），匹配用户的经历和性格
7. 不要在报告中提到"第X题""q1""q2"等题号，只写分析结论，比如"从你的选择来看，你倾向于..."
8. 必须分析"AI替代风险"：用户当前岗位在AI时代被替代的程度（0-100，越高越容易被替代），以及如何在AI时代找到自己的位置
9. 必须列出转型风险点：针对用户选择的主推方向，列出2-3个可能的风险，要具体（如"薪资可能下降30-50%"、"需要6-12个月无收入学习期"）
${isExplorationMode ? "10. 用户在探索模式，没有明确目标岗位，不要给单一匹配度分数，而是推荐3-4个最适合的转型方向，每个方向给出匹配度分数和理由" : "10. 用户已有明确目标岗位，给出与该目标的综合匹配度分数"}
11. actionPlan必须包含现实前置步骤：不要只说"学技能"，要说"先做实习/项目/副业积累经验再投递正式岗"
12. 严格返回JSON，不要markdown`;

  const userMessage = `请根据以下信息生成一份完整的职业转型诊断报告：

【基本信息】
姓名: ${userProfile.name}
当前角色: ${userProfile.currentRole}
${userProfile.targetRole ? `目标角色: ${userProfile.targetRole}` : "目标角色: 未指定（探索模式）"}
经验: ${userProfile.experience}
技能: ${userProfile.skills.join("、")}
兴趣: ${userProfile.interests || "未提供"}
性格原型: ${userProfile.archetype || userProfile.personality || "未提供"}
用户自述: ${userProfile.coachNote || "无"}

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
  "aiReplaceAnalysis": "AI替代风险分析，120-180字。分析用户当前岗位在AI时代被替代的程度，以及如何在AI时代发挥自己的特长找到位置",
  "currentAssessment": "结合性格选择和简历内容，评估用户当前的职业状态和核心优势，150-200字。必须引用简历中的具体职位/项目/技能",
  "feasibility": "high或medium或low",
  "feasibilityExplanation": "转型可行性分析，180-250字。必须客观引用简历中的具体经历或性格选择来论证。如果经验不足要直接说明难度，不要美化。比如'0-1年经验转产品经理成功率较低，建议先从产品助理或运营岗切入'",
  "resumeSummary": "简历深度分析，200-300字。重点分析而非复述：(1)指出简历中哪些技能和经验是可迁移的、能带到哪些岗位；(2)同时指出硬缺口和不足；(3)基于可迁移能力推荐2-3个适合的岗位方向并说明理由，要现实",
  "choiceAnalysis": "性格选择与结论的关联分析，120-180字。说明哪些选择反映了什么特质，如何与简历经历呼应，共同影响推荐方向。不要提到题号",
  "riskPoints": ["风险点1：具体描述，要带数字，如'成功率不足10%''薪资下降30-50%''需6个月无收入学习期'", "风险点2：具体描述", "风险点3：具体描述"],
  "skillsToAcquire": [{"name": "技能名", "priority": "high|medium|low", "description": "说明为什么需要这个技能，结合用户简历或选择。技能要围绕主推转型方向"}],
  "actionPlan": [{"phase": "阶段名", "duration": "时长说明", "title": "阶段标题（必须包含现实前置步骤如实习/项目/副业积累，不要只说学技能）", "details": ["步骤1：要具体可执行", "步骤2"]}],
  "possiblePaths": [{"title": "路径标题", "description": "路径描述，必须结合用户的选择和简历经历", "tags": ["标签1"], "matchScore": 0-100的数字}],
  "recommendedCompanies": [{"name": "真实公司名", "position": "适合的岗位名", "reason": "为什么这家公司+岗位适合用户，结合简历经历和性格"}]
}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GLM API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as GLMResponse;
    const content = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch =
      content.match(/\{[\s\S]*\}/) || content.match(/\[[\s\S]*\]/);
    let parsedData: Record<string, unknown>;

    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse JSON from GLM response");
    }

    const now = new Date().toISOString();
    return {
      id: `dr-${Date.now()}`,
      userId: userProfile.id ?? "unknown",
      createdAt: now,
      matchScore: isExplorationMode ? undefined : (parsedData.matchScore as number ?? 60),
      aiReplaceRisk: parsedData.aiReplaceRisk as number ?? undefined,
      aiReplaceAnalysis: (parsedData.aiReplaceAnalysis as string) ?? undefined,
      riskPoints: Array.isArray(parsedData.riskPoints) ? (parsedData.riskPoints as string[]) : undefined,
      currentAssessment:
        (parsedData.currentAssessment as string) ?? "暂无评估",
      feasibility: (parsedData.feasibility as string) ?? "medium",
      feasibilityExplanation:
        (parsedData.feasibilityExplanation as string) ?? "暂无分析",
      resumeSummary: (parsedData.resumeSummary as string) ?? undefined,
      choiceAnalysis: (parsedData.choiceAnalysis as string) ?? undefined,
      skillsToAcquire:
        (parsedData.skillsToAcquire as DiagnosticReport["skillsToAcquire"]) ?? [],
      actionPlan:
        (parsedData.actionPlan as DiagnosticReport["actionPlan"]) ?? [],
      possiblePaths:
        (parsedData.possiblePaths as DiagnosticReport["possiblePaths"]) ?? [],
      recommendedCompanies:
        (parsedData.recommendedCompanies as DiagnosticReport["recommendedCompanies"]) ?? undefined,
    };
  } catch (error) {
    console.error(
      "[GLM] generateDiagnosticReport failed, falling back to mock:",
      error
    );
    return mockDiagnosticReport(userProfile);
  }
}

export async function generateCoachReply(
  userMessage: string,
  userContext: CoachContext
): Promise<string> {
  if (isMockMode()) {
    return mockCoachReply(userMessage, userContext);
  }

  const systemPrompt = buildMockSystemPrompt("AI职业教练");

  const messages: ChatMessage[] = [];

  if (userContext.conversationHistory && userContext.conversationHistory.length > 0) {
    messages.push(...userContext.conversationHistory);
  } else {
    messages.push({
      role: "user",
      content: `我是${userContext.userProfile?.name ?? "一位用户"},目前是${userContext.userProfile?.currentRole ?? "职场人"}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const { content } = await generateChat(messages, systemPrompt);
    return content;
  } catch (error) {
    console.error("[GLM] generateCoachReply failed, falling back to mock:", error);
    return mockCoachReply(userMessage, userContext);
  }
}

export { isMockMode, mockChatResponse, mockDiagnosticReport, mockCoachReply };