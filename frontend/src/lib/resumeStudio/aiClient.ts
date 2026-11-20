/**
 * 模型调用的并发闸门 + 超时 + 重试。
 *
 * 明天 60+ 人同时上传，如果每人一次解析 + 一次优化直接打给模型，
 * 很容易把配额打爆。这里在进程内做全局并发上限（默认 6 路），
 * 排队执行；每次调用有独立超时，失败按指数退避重试 2 次。
 *
 * 注意：上限是「单实例」的。多实例部署时实际并发 = 实例数 × 上限，
 * 如果有多个实例，请把 RESUME_STUDIO_AI_CONCURRENCY 调小。
 */
import { generateChat } from "@/lib/ai";
import { StudioError } from "./errors";

function readConcurrency(): number {
  const raw = Number(process.env.RESUME_STUDIO_AI_CONCURRENCY);
  if (!Number.isFinite(raw) || raw <= 0) return 6;
  return Math.min(16, Math.max(1, Math.floor(raw)));
}

const MAX_CONCURRENT = readConcurrency();
const CALL_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RESUME_STUDIO_AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 55000;
})();

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

/** 当前排队 / 执行中的调用数，用于前端展示「排队中」 */
export function aiQueueDepth(): number {
  return active + waiters.length;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GLM_API_KEY || process.env.GEMINI_API_KEY);
}

const MOCK_MARKER = "这是演示模式下的兜底回复";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StudioError("AI_TIMEOUT", "AI request timed out", true)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface AiCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 带并发限制的模型调用。返回原始文本，JSON 解析交给调用方
 * （模型偶尔会包 markdown 代码块，需要容错）。
 */
export async function callAI(options: AiCallOptions): Promise<string> {
  if (!isAiConfigured()) {
    throw new StudioError("AI_NOT_CONFIGURED", "AI model is not configured", false);
  }

  await acquire();
  try {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await withTimeout(
          generateChat(
            [{ role: "user", content: options.user }],
            options.system,
            {
              maxTokens: options.maxTokens ?? 4096,
              temperature: options.temperature ?? 0.3,
              thinking: false,
            }
          ),
          CALL_TIMEOUT_MS
        );
        const content = (result.content || "").trim();
        // generateChat 在调用失败时会返回演示文案，不能当真实结果用
        if (!content || content.includes(MOCK_MARKER)) {
          throw new StudioError("AI_EMPTY", "AI returned an empty response", true);
        }
        return content;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          const backoff = 800 * 2 ** attempt + Math.floor(Math.random() * 400);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    throw lastError instanceof StudioError
      ? lastError
      : new StudioError("AI_FAILED", "AI request failed after retries", true);
  } finally {
    release();
  }
}

/** 从模型输出里提取 JSON（兼容 ```json 代码块与前后多余文字） */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) return raw.slice(firstObj, lastObj + 1);
  return raw.trim();
}

export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(extractJson(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
