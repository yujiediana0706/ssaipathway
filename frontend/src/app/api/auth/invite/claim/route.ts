import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { claimInviteCode } from "@/lib/inviteCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 注册成功后激活邀请码（一次性）。必须登录态。 */
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 400 });

  try {
    const result = await claimInviteCode(code, { id: user.id, email: user.email });
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, type: result.type });
  } catch {
    return NextResponse.json({ ok: false, reason: "db_unavailable" }, { status: 503 });
  }
}
