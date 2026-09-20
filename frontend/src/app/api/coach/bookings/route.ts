import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as mp from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET：默认当前用户「作为学员」的全部预约；?scope=coach 返回作为教练收到的预约
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  if (searchParams.get("scope") === "coach") {
    const bookings = await mp.listBookingsAsCoach(user.id);
    const earnings = await mp.listEarningsAsCoach(user.id);
    return NextResponse.json({ bookings, earnings });
  }
  const bookings = await mp.listBookingsAsCoachee(user.id);
  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await request.json();
    switch (body.action) {
      // ── 学员下单（价格服务端取，禁止客户端改价）──
      case "create": {
        if (!body.coachId || !body.slotId || !["single", "package_5"].includes(body.kind)) {
          return NextResponse.json({ error: "参数不完整" }, { status: 400 });
        }
        const result = await mp.createBookingSession({
          coacheeId: user.id,
          coachId: body.coachId,
          slotId: body.slotId,
          kind: body.kind,
        });
        return NextResponse.json(result);
      }
      // ── 套餐内预约剩余次数 ──
      case "redeem": {
        if (!body.orderId || !body.slotId) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
        const booking = await mp.redeemPackageSlot({
          coacheeId: user.id, orderId: body.orderId, slotId: body.slotId,
        });
        return NextResponse.json({ booking });
      }
      // ── 学员取消 ──
      case "cancel": {
        await mp.coacheeCancelBooking(user.id, body.bookingId);
        return NextResponse.json({ ok: true });
      }
      // ── 学员确认完成 → 放款 ──
      case "confirm-complete": {
        await mp.coacheeCompleteBooking(user.id, body.bookingId);
        return NextResponse.json({ ok: true });
      }
      // ── 教练确认 / 拒绝 ──
      case "coach-confirm": {
        await mp.coachConfirmBooking(user.id, body.bookingId);
        return NextResponse.json({ ok: true });
      }
      case "coach-reject": {
        await mp.coachRejectBooking(user.id, body.bookingId, body.reason);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "未知操作" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof mp.MarketplaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/coach/bookings]", err);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
