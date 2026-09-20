import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as mp from "@/lib/marketplace";
import type { CoachDoc } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 教练提交 Verified 认证申请
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = await request.json();
    const docs: CoachDoc[] = Array.isArray(body.verification_docs) ? body.verification_docs : [];
    if (!docs.some((d) => typeof d.path === "string" && d.path.startsWith(`${user.id}/`))) {
      return NextResponse.json({ error: "请至少上传 1 份专业资质材料" }, { status: 400 });
    }
    await mp.submitVerification(user.id, docs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof mp.MarketplaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/coach/verification]", err);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
