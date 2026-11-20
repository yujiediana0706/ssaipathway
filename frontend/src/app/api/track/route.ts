import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebaseAdmin";
import { dayKey } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrackBody {
  event?: string;
  props?: Record<string, unknown>;
  anon_id?: string;
  path?: string;
  ts?: number;
}

/**
 * 内部埋点上报：写 events 集合。
 * 表结构（对齐 PostgreSQL）：
 *   id, event, anon_id, user_id, props(jsonb), path, locale,
 *   day(date), ts(bigint), created_at(timestamptz)
 * 任何异常都返回 204，不影响前端。
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrackBody;
    const event = (body.event || "").trim();
    if (!event || event.length > 64) return new NextResponse(null, { status: 204 });

    const db = getAdminDb();
    if (!db) return new NextResponse(null, { status: 204 });

    // 可选鉴权：已登录时把匿名标识与用户绑定
    const user = await getAuthedUser(request).catch(() => null);
    const anonId = (body.anon_id || "").slice(0, 64);
    const now = new Date();
    const iso = now.toISOString();

    if (user && anonId) {
      await db
        .collection("identities")
        .doc(anonId)
        .set(
          { anon_id: anonId, user_id: user.id, email: user.email || "", updated_at: iso },
          { merge: true }
        )
        .catch(() => undefined);
    }

    await db
      .collection("events")
      .add({
        event,
        anon_id: anonId,
        user_id: user?.id || "",
        props: body.props || {},
        path: (body.path || "").slice(0, 200),
        locale: String((body.props as Record<string, unknown> | undefined)?.locale || ""),
        day: dayKey(now),
        ts: typeof body.ts === "number" ? body.ts : now.getTime(),
        created_at: iso,
      })
      .catch(() => undefined);

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
