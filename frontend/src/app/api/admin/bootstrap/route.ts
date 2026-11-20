import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { claimBootstrapAdmin, listAdmins } from "@/lib/admins";
import { toErrorResponse } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 首个管理员引导（唯一显式写入口）。
 * 成功后立即关闭 BOOTSTRAP_ADMIN_EMAILS 白名单，并写审计日志。
 */
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录", code: "E_UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const record = await claimBootstrapAdmin(user);
    return NextResponse.json({ admin: record, admins: await listAdmins() });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
