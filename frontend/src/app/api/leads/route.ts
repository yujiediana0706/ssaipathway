import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminEmailDynamic } from "@/lib/marketplaceFirestore";
import {
  listLeads,
  updateLeadStatus,
  getLead,
  getCoachIdForUser,
} from "@/lib/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const admin = await isAdminEmailDynamic(user.email).catch(() => false);
  const coachId = admin ? null : await getCoachIdForUser(user.id);
  const leads = await listLeads({ all: admin, coachId: coachId ?? undefined });
  return NextResponse.json({ leads, isAdmin: admin, isCoach: Boolean(coachId) });
}

export async function PATCH(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { id, status, note } = await request.json();
    if (!id || !LEAD_STATUSES.includes(status)) {
      return NextResponse.json({ error: "参数不合法" }, { status: 400 });
    }

    const admin = await isAdminEmailDynamic(user.email).catch(() => false);
    if (!admin) {
      // 教练只能改自己名下的线索
      const coachId = await getCoachIdForUser(user.id);
      const lead = coachId ? await getLead(id) : null;
      if (!lead || lead.coach_id !== coachId) {
        return NextResponse.json({ error: "无权限" }, { status: 403 });
      }
    }

    const ok = await updateLeadStatus(id, status as LeadStatus, note);
    if (!ok) return NextResponse.json({ error: "线索不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
