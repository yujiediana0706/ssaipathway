import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminEmailDynamic } from "@/lib/marketplaceFirestore";
import { listLeads, updateLeadStatus } from "@/lib/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const admin = await isAdminEmailDynamic(user.email).catch(() => false);
  const leads = await listLeads({ all: admin, userId: user.id });
  return NextResponse.json({ leads, isAdmin: admin });
}

export async function PATCH(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const admin = await isAdminEmailDynamic(user.email).catch(() => false);
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const { id, status, note } = await request.json();
    if (!id || !LEAD_STATUSES.includes(status)) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 });
    }
    const ok = await updateLeadStatus(id, status as LeadStatus, note);
    if (!ok) return NextResponse.json({ error: "线索不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
