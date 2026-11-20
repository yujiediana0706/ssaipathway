import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { listAdminEmails, listBookings } from "@/lib/marketplaceFirestore";
import { resolveAdmin } from "@/lib/admins";
import { updateLeadByBookingId } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return { user: null, res: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  const ok = await resolveAdmin(user);
  if (!ok) return { user: null, res: NextResponse.json({ error: "无管理员权限" }, { status: 403 }) };
  return { user, res: null };
}

export async function GET(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const [bookings, admins] = await Promise.all([listBookings({ limit: 200 }), listAdminEmails()]);
  return NextResponse.json({ bookings, admins });
}

const GONE = (what: string) =>
  NextResponse.json(
    {
      error: `${what}已迁移到新接口，请刷新后台重试`,
      code: "E_GONE",
      use: "/api/admin/role-applications",
    },
    { status: 410 },
  );

export async function POST(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const body = await request.json();

  // 旧的“直接通过 / 驳回 / 面试 / 管理员增删”入口全部下线：
  // 身份变更只能走 role_applications 状态机（含自审拦截、事务抢占与审计）。
  if (["approve", "reject", "interview_pass", "interview_fail", "add_admin", "remove_admin"].includes(body.action) ||
      typeof body.approved === "boolean") {
    return GONE("教练认证审核");
  }

  if (body.action === "mark_booking_grouped" || body.action === "mark_booking_done") {
    const { bookingId } = body;
    if (!bookingId) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    const db = (await import("@/lib/firebaseAdmin")).getAdminDb();
    if (!db) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
    const status = body.action === "mark_booking_grouped" ? "grouped" : "done";
    await db.collection("concierge_bookings").doc(bookingId).update({
      status,
      updated_at: new Date().toISOString(),
    });
    // 同步线索状态，保留每次流转时间
    await updateLeadByBookingId(bookingId, status);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
