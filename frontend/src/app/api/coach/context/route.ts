import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuthedUser, getAdminDb } from "@/lib/firebaseAdmin";
import {
  getProfileById,
  getLatestReportByUserId,
  getResumesByUserId,
} from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THREADS = "coach_threads";
const MAX_MESSAGES = 100;

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

/**
 * AI 教练的长期记忆：
 * GET  → 返回该用户的服务端档案、最新诊断报告、简历与历史对话
 * POST → 追加一轮对话（每条最多保留 4000 字，整条线程最多 100 条）
 */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const [profile, report, resumes] = await Promise.all([
      getProfileById(user.id).catch(() => null),
      getLatestReportByUserId(user.id).catch(() => null),
      getResumesByUserId(user.id).catch(() => []),
    ]);

    const db = getAdminDb();
    let messages: StoredMessage[] = [];
    if (db) {
      const snap = await db.collection(THREADS).doc(user.id).get();
      const stored = snap.exists ? snap.data()?.messages : null;
      if (Array.isArray(stored)) messages = stored.slice(-40) as StoredMessage[];
    }

    return NextResponse.json({ profile, report, resumes, messages });
  } catch (error) {
    console.error("[coach/context] GET failed:", error);
    return NextResponse.json({ error: "加载记忆失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: true, stored: false });

  let body: { messages?: { role?: string; content?: string }[] } | null = null;
  try {
    body = (await request.json()) as { messages?: { role?: string; content?: string }[] };
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const cleaned: StoredMessage[] = incoming
    .filter((m) => typeof m?.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content!.trim().slice(0, 4000),
      at: new Date().toISOString(),
    }));

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "没有可保存的消息" }, { status: 400 });
  }

  try {
    const ref = db.collection(THREADS).doc(user.id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = Array.isArray(snap.data()?.messages) ? snap.data()!.messages : [];
      const next = [...prev, ...cleaned].slice(-MAX_MESSAGES);
      tx.set(
        ref,
        {
          user_id: user.id,
          messages: next,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    console.error("[coach/context] POST failed:", error);
    return NextResponse.json({ error: "保存记忆失败" }, { status: 500 });
  }
}
