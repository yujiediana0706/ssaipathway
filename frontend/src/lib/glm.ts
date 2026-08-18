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
  systemPrompt?: string
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
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
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

  const systemPrompt = buildMockSystemPrompt("职业诊断专家");

  const userMessage = `请根据以下信息生成一份完整的职业转型诊断报告:

姓名: ${userProfile.name}
当前角色: ${userProfile.currentRole}
目标角色: ${userProfile.targetRole || "未指定"}
技能: ${userProfile.skills.join("、")}
经验: ${userProfile.experience}

请严格按照以下JSON格式返回,不要添加其他文字:
{
  "matchScore": 0-100的数字,
  "currentAssessment": "对当前背景的评估,50-100字",
  "feasibility": "转型可行性分析,100-200字",
  "skillsToAcquire": [{"name": "技能名", "priority": "high|medium|low"}],
  "actionPlan": [{"phase": "阶段描述", "steps": ["步骤1", "步骤2"]}],
  "possiblePaths": [{"title": "路径标题", "description": "路径描述"}]
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
      matchScore: parsedData.matchScore as number ?? 60,
      currentAssessment:
        (parsedData.currentAssessment as string) ?? "暂无评估",
      feasibility: (parsedData.feasibility as string) ?? "暂无分析",
      skillsToAcquire:
        (parsedData.skillsToAcquire as DiagnosticReport["skillsToAcquire"]) ?? [],
      actionPlan:
        (parsedData.actionPlan as DiagnosticReport["actionPlan"]) ?? [],
      possiblePaths:
        (parsedData.possiblePaths as DiagnosticReport["possiblePaths"]) ?? [],
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