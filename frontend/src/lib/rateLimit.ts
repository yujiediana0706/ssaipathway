import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function bucketId(key: string, windowStart: number): string {
  return `${key}:${windowStart}`.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 400);
}

/**
 * 固定窗口限流，计数落在 Firestore（rate_limits 集合），
 * 多实例 Cloud Run 下共享同一份计数，不依赖单机内存。
 * Firestore 不可用时放行（fail-open），避免把整个服务卡死。
 */
export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const db = getAdminDb();
  if (!db) {
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs);
  const docRef = db.collection("rate_limits").doc(bucketId(key, windowStart));
  const resetAt = (windowStart + 1) * windowMs;

  try {
    const count = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const current = snap.exists ? Number(snap.data()?.count || 0) : 0;
      const next = current + 1;
      tx.set(
        docRef,
        {
          key,
          count: next,
          window_start: windowStart,
          // Firestore TTL 策略可基于该字段自动清理过期计数
          expires_at: new Date(resetAt),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return next;
    });

    const ok = count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ok ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  } catch (err) {
    console.error("[rateLimit] counter unavailable, allowing request", { key, err });
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** 取客户端 IP（Cloud Run 会带 X-Forwarded-For） */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}
