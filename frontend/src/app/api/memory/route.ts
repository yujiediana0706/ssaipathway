import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { listMemories, deleteMemory } from "@/lib/userMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI 教练记忆的查看与删除（隐私必需）。
 * GET    /api/memory            → 列出当前用户的记忆
 * DELETE /api/memory?id=xxx     → 删除单条记忆（用户可要求 AI「忘掉」某事）
 */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const items = await listMemories(user.id, 200);
    return NextResponse.json({
      memories: items.map((m) => ({ ...m, createdAtISO: new Date(m.createdAt).toISOString() })),
    });
  } catch (e) {
    console.error("[api/memory] GET failed:", e);
    return NextResponse.json({ error: "读取记忆失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const ok = await deleteMemory(user.id, id);
  return NextResponse.json({ ok });
}
