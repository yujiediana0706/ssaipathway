import { NextResponse } from "next/server";
import { isInviteRequired, validateInviteCode } from "@/lib/inviteCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 公开校验邀请码（不消耗）。
 * GET  /api/auth/invite            -> 邀请码开关状态
 * GET  /api/auth/invite?code=XXX   -> 校验并返回类型
 * POST { code, email? }            -> 注册前校验（含邮箱绑定校验）
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const email = url.searchParams.get("email") || "";
  const required = isInviteRequired();
  if (!code) return NextResponse.json({ required });

  try {
    const result = await validateInviteCode(code, email);
    return NextResponse.json({ required, valid: result.ok, type: result.type, reason: result.reason });
  } catch {
    return NextResponse.json({ required, valid: false, reason: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const required = isInviteRequired();

  if (!code) {
    if (required) return NextResponse.json({ ok: false, reason: "required" }, { status: 400 });
    return NextResponse.json({ ok: true, required, type: null });
  }

  try {
    const result = await validateInviteCode(code, email);
    if (!result.ok) {
      return NextResponse.json({ ok: false, required, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, required, type: result.type });
  } catch {
    return NextResponse.json({ ok: false, required, reason: "db_unavailable" }, { status: 503 });
  }
}
