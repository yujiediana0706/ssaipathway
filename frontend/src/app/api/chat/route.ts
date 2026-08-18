import {
  generateChat,
  generateChatStream,
  type ChatMessage,
  type GLMUsage,
} from "@/lib/glm";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: ChatMessage[];
  systemPrompt?: string;
  stream?: boolean;
}

interface ChatResponseJson {
  content: string;
  usage?: GLMUsage;
}

export async function POST(request: Request): Promise<Response> {
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
    if (body.stream) {
      const stream = await generateChatStream(body.messages, body.systemPrompt);

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
      body.systemPrompt
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