// Vertex AI text-embedding-004 向量生成 + 相似度计算 + 轻量缓存
// 仅服务端使用，复用 Cloud Run 默认服务账号或 GOOGLE_CLOUD_PROJECT 环境变量
import { LRUCache } from "lru-cache";

const DEFAULT_MODEL = "text-embedding-004";
const DEFAULT_LOCATIONS = ["us-central1", "global"];

// 文本过长时截断：text-embedding-004 支持 ~8k token，这里按 6000 字符预留安全
const MAX_TEXT_CHARS = 6000;

interface EmbeddingResponse {
  predictions: Array<{ embeddings: { values: number[] } }>;
}

// 进程内缓存：embedding 计算不便宜，重复搜索里候选教练的向量会被多次命中
const embeddingCache = new LRUCache<string, number[]>({ max: 256, ttl: 30 * 60 * 1000 });

function getConfig() {
  const project = (process.env.GOOGLE_CLOUD_PROJECT ?? "").trim();
  const model = (process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL).trim();
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  return { project, model, apiKey };
}

/**
 * 优先用 Cloud Run / GCP 默认服务账号（Application Default Credentials），
 * 本地或无服务账号时用 GEMINI_API_KEY 走 Gemini Developer API 的 Embeddings 端点。
 */
async function fetchAuthToken(): Promise<string | null> {
  const apiKey = getConfig().apiKey;
  if (apiKey) return apiKey; // Developer API 直接用 key 当 bearer
  try {
    // Application Default Credentials（Cloud Run metadata server 自动可用）
    const url =
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
    const res = await fetch(url, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function callVertexEmbeddings(
  location: string,
  text: string,
  authToken: string,
): Promise<number[] | null> {
  const { project, model } = getConfig();
  const baseUrl =
    location === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${location}-aiplatform.googleapis.com`;
  const url = `${baseUrl}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken.startsWith("AIza")
          ? `Bearer ${authToken}` // Developer API key 直接当 bearer
          : `Bearer ${authToken}`,
      },
      body: JSON.stringify({ instances: [{ content: text.slice(0, MAX_TEXT_CHARS) }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Embeddings] ${model}@${location} HTTP ${res.status}: ${err.slice(0, 160)}`);
      return null;
    }
    const data = (await res.json()) as EmbeddingResponse;
    const values = data?.predictions?.[0]?.embeddings?.values;
    return Array.isArray(values) ? values : null;
  } catch (e) {
    console.warn(`[Embeddings] ${model}@${location} exception: ${(e as Error).message.slice(0, 120)}`);
    return null;
  }
}

/**
 * 生成向量。按候选 location 依次尝试，成功后缓存。
 * 返回 null 表示所有路径都不可用（上游故障或没有 GCP 凭证）。
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!text.trim()) return null;
  const cacheKey = text.slice(0, MAX_TEXT_CHARS);
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const auth = await fetchAuthToken();
  if (!auth) {
    console.error("[Embeddings] no auth token available — GCP credentials / API key both missing");
    return null;
  }

  for (const loc of DEFAULT_LOCATIONS) {
    const vec = await callVertexEmbeddings(loc, cacheKey, auth);
    if (vec && vec.length > 0) {
      embeddingCache.set(cacheKey, vec);
      return vec;
    }
  }
  return null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
