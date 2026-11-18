import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";
import { runCoachAIReview } from "@/lib/coachVerificationAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 管理员手动触发 / 重新触发某位教练的 AI 初审 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!mp.isAdminEmail(user.email)) {
    return NextResponse.json({ error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const { coachId } = await request.json();
    if (!coachId) return NextResponse.json({ error: "缺少 coachId" }, { status: 400 });

    const coach = await mp.getCoachProfileById(coachId, { includePrivate: true });
    if (!coach) return NextResponse.json({ error: "教练不存在" }, { status: 404 });

    const review = await runCoachAIReview(coach);
    await mp.saveCoachAIReview(coach.id, review);
    return NextResponse.json({ review });
  } catch (err) {
    console.error("[admin/ai-review] error:", err);
    return NextResponse.json({ error: "AI 初审失败" }, { status: 500 });
  }
}
