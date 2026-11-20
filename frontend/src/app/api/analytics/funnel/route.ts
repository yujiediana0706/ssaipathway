import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminEmailDynamic } from "@/lib/marketplaceFirestore";
import { dayKey } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNNEL = [
  "page_view",
  "quiz_start",
  "quiz_complete",
  "report_view",
  "coach_view",
  "booking_click",
  "wechat_modal_open",
  "wechat_added",
] as const;

/** 运营漏斗：按天统计各步骤人数（去重）与转化率 */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const admin = await isAdminEmailDynamic(user.email).catch(() => false);
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ days: [], totals: null });

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 14), 1), 90);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  try {
    const snap = await db
      .collection("events")
      .where("day", ">=", dayKey(start))
      .limit(20000)
      .get();

    type Bucket = Record<string, { total: number; users: Set<string> }>;
    const byDay: Record<string, Bucket> = {};
    const allUsers: Record<string, Set<string>> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      byDay[dayKey(d)] = Object.fromEntries(FUNNEL.map((e) => [e, { total: 0, users: new Set<string>() }]));
    }
    FUNNEL.forEach((e) => (allUsers[e] = new Set<string>()));

    snap.forEach((doc) => {
      const data = doc.data();
      const day = data.day as string;
      const event = data.event as string;
      if (!byDay[day] || !(event in byDay[day])) return;
      const who = (data.user_id as string) || (data.anon_id as string) || doc.id;
      byDay[day][event].total += 1;
      byDay[day][event].users.add(who);
      allUsers[event]?.add(who);
    });

    const rows = Object.entries(byDay).map(([day, bucket]) => {
      const counts = Object.fromEntries(FUNNEL.map((e) => [e, bucket[e].users.size]));
      return { day, counts };
    });

    const totals = Object.fromEntries(FUNNEL.map((e) => [e, allUsers[e].size]));
    const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
    const conversions = {
      view_to_quiz: rate(totals.quiz_start, totals.page_view),
      quiz_to_complete: rate(totals.quiz_complete, totals.quiz_start),
      complete_to_report: rate(totals.report_view, totals.quiz_complete),
      report_to_booking: rate(totals.booking_click, totals.report_view),
      booking_to_wechat: rate(totals.wechat_added, totals.booking_click),
      view_to_wechat: rate(totals.wechat_added, totals.page_view),
    };

    return NextResponse.json({ days: rows.reverse(), totals, conversions });
  } catch (e) {
    console.error("[analytics/funnel] failed:", e);
    return NextResponse.json({ days: [], totals: null, conversions: null });
  }
}
