import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminEmail } from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前登录用户的轻量信息（用于前端按权限渲染入口） */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ user: null, isAdmin: false }, { status: 401 });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    isAdmin: isAdminEmail(user.email),
  });
}
