import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return { user: null, res: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  const ok = await mp.isAdminEmailDynamic(user.email);
  if (!ok) return { user: null, res: NextResponse.json({ error: "无管理员权限" }, { status: 403 }) };
  return { user, res: null };
}

export async function GET(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const [pending, interviews, all, bookings, admins] = await Promise.all([
    mp.listPendingVerifications(),
    mp.listPendingInterviews(),
    mp.listAllCoachesAdmin(),
    mp.listBookings({ limit: 200 }),
    mp.listAdminEmails(),
  ]);
  return NextResponse.json({ pending, interviews, all, bookings, admins });
}

export async function POST(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const body = await request.json();

  // ── 管理员权限管理 ──
  if (body.action === "add_admin") {
    try {
      const next = await mp.addAdminEmail(String(body.email ?? ""));
      return NextResponse.json({ admins: next });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }
  if (body.action === "remove_admin") {
    try {
      const next = await mp.removeAdminEmail(String(body.email ?? ""));
      return NextResponse.json({ admins: next });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }
  // 标记预约已对接 / 已完成
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
    return NextResponse.json({ ok: true });
  }

  // ── mentor 1v1 面试结果登记 ──
  if (body.action === 'interview_pass' || body.action === 'interview_fail') {
    if (!body.coachId) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    if (body.action === 'interview_fail' && !String(body.reason ?? "").trim()) {
      return NextResponse.json({ error: "面试未通过必须填写理由" }, { status: 400 });
    }
    await mp.setInterviewResult(
      body.coachId,
      body.action === 'interview_pass',
      String(body.reason ?? "").trim() || undefined,
    );
    return NextResponse.json({ ok: true });
  }

  if (!body.coachId || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (!body.approved && !String(body.reason ?? "").trim()) {
    return NextResponse.json({ error: "驳回必须填写理由" }, { status: 400 });
  }
  await mp.setVerification(body.coachId, body.approved, String(body.reason ?? "").trim());
  return NextResponse.json({ ok: true });
}
