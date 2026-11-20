import { NextResponse } from "next/server";
import { getAuthedUser, getAdminDb } from "@/lib/firebaseAdmin";
import { buildMemoryContext, listMemories } from "@/lib/userMemory";
import { generateChat } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THREADS = "coach_threads";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * 小北主动开口：仅在「距上次对话 ≥7 天 + 有可用的具体记忆 + 7 天内未主动过」时返回一句开场。
 * 否则返回 { message: null }，前端回落到默认欢迎语。
 */
export async function POST(request: Request) {
  const user = await getAuthedUser(request).catch(() => null);
  if (!user) return NextResponse.json({ message: null });

  const en = new URL(request.url).searchParams.get("locale") === "en";

  const db = getAdminDb();
  if (!db) return NextResponse.json({ message: null });

  try {
    const ref = db.collection(THREADS).doc(user.id);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;

    const now = Date.now();
    const lastProactive = (data?.last_proactive_at as number) ?? 0;
    if (now - lastProactive < SEVEN_DAYS) return NextResponse.json({ message: null });

    const messages = Array.isArray(data?.messages) ? (data!.messages as { at?: string }[]) : [];
    const lastAt = messages.length ? Date.parse(messages[messages.length - 1]?.at || "") : 0;
    if (lastAt && now - lastAt < SEVEN_DAYS) return NextResponse.json({ message: null });

    // 必须有具体的记忆可引用，否则不打扰
    const memories = await listMemories(user.id, 5);
    const usable = memories.filter(
      (m) => m.type !== "fact" && m.content.length > 10
    );
    if (usable.length === 0) return NextResponse.json({ message: null });

    const memoryContext = await buildMemoryContext(user.id, usable[0].content, en, 3);

    const system = en
      ? `You are Xiaobei, a career coach. ${memoryContext}
Write ONE proactive opener in English, max 45 words. It must reference one concrete thing from memory, ask one light question, and offer an easy exit ("no pressure if you'd rather not talk about it"). No greetings like "How have you been". No markdown.`
      : `你是职业教练小北。${memoryContext}
写一句主动开场白，最多 60 字。必须引用上面某一条具体记忆，问一个轻问题，并给退出选项（如"不想聊这个也完全没问题"）。
不要空泛问候（禁止"最近怎么样"），不要 markdown，不要解释你在做什么。`;

    const { content } = await generateChat(
      [{ role: "user", content: en ? "Write the opener." : "写开场白。" }],
      system,
      160
    );

    const message = (content || "").trim().replace(/^["「]|["」]$/g, "");
    if (!message) return NextResponse.json({ message: null });

    await ref.set({ last_proactive_at: now }, { merge: true }).catch(() => undefined);

    return NextResponse.json({ message });
  } catch (e) {
    console.error("[coach/proactive] failed:", e);
    return NextResponse.json({ message: null });
  }
}
