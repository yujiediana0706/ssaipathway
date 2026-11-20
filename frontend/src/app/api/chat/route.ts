import { generateChat, generateChatStream, type ChatMessage, type TokenUsage } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { buildMemoryContext } from "@/lib/userMemory";
import {
  analyzeUserStyle,
  buildAdaptBlock,
  CORE_RULES_EN,
  CORE_RULES_ZH,
  SELF_CHECK_EN,
  SELF_CHECK_ZH,
} from "@/lib/coachRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: ChatMessage[];
  systemPrompt?: string;
  stream?: boolean;
  maxTokens?: number;
  locale?: string;
  /** 传 false 可关闭长期记忆注入（如模拟面试等不需要用户画像的会话） */
  useMemory?: boolean;
  /** 仅 AI 教练「小北」开启：注入对话规则层与长度自适应 */
  coachMode?: boolean;
}

interface ChatResponseJson {
  content: string;
  usage?: TokenUsage;
}

export async function POST(request: Request): Promise<Response> {
  // 每分钟每 IP 最多 30 次对话请求，避免 AI 额度被刷
  const limited = await rateLimit(`chat:${clientIp(request)}`, {
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!limited.ok) {
    return Response.json(
      { error: "Too many requests, please slow down." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return Response.json(
      { error: "Missing or invalid 'messages' field" },
      { status: 400 }
    );
  }

  if (body.messages.length === 0) {
    return Response.json(
      { error: "'messages' array must not be empty" },
      { status: 400 }
    );
  }

  const validRoles = new Set(["system", "user", "assistant"]);
  for (const msg of body.messages) {
    if (!validRoles.has(msg.role)) {
      return Response.json(
        {
          error: `Invalid message role: "${msg.role}". Must be one of: system, user, assistant`,
        },
        { status: 400 }
      );
    }
    if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
      return Response.json(
        { error: "Each message must have a non-empty 'content' string" },
        { status: 400 }
      );
    }
  }

  try {
    // 按界面语言约束模型输出语言
    const localeSuffix =
      body.locale === "en"
        ? "\n\nThe user's interface language is English. Reply in English."
        : "\n\n用户界面语言为中文，请用中文回复。";
    // 已登录用户：按本次提问检索长期记忆（诊断 / 简历 / 咨询纪要）注入
    let memoryBlock = "";
    if (body.useMemory !== false) {
      const user = await getAuthedUser(request).catch(() => null);
      if (user) {
        const lastUserMsg =
          [...body.messages].reverse().find((m) => m.role === "user")?.content || "";
        memoryBlock = await buildMemoryContext(
          user.id,
          lastUserMsg,
          body.locale === "en"
        ).catch(() => "");
      }
    }

    const basePrompt = body.systemPrompt
      ? body.systemPrompt + localeSuffix
      : localeSuffix.trim();

    // AI 教练模式：注入规则层 + 本轮长度/情绪适配 + 自检清单
    const en = body.locale === "en";
    const rulesBlock = body.coachMode
      ? [
          basePrompt,
          en ? CORE_RULES_EN : CORE_RULES_ZH,
          buildAdaptBlock(analyzeUserStyle(body.messages), en),
          memoryBlock,
          en ? SELF_CHECK_EN : SELF_CHECK_ZH,
        ]
          .filter(Boolean)
          .join("\n\n")
      : memoryBlock
        ? `${basePrompt}\n\n${memoryBlock}`
        : basePrompt;

    const systemPrompt = rulesBlock;

    if (body.stream) {
      const stream = await generateChatStream(body.messages, systemPrompt);

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const { content, usage } = await generateChat(
      body.messages,
      systemPrompt,
      body.maxTokens
    );

    const responseBody: ChatResponseJson = { content };
    if (usage) {
      responseBody.usage = usage;
    }

    return Response.json(responseBody, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API chat] Error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}