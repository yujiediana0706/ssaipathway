import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";
import { rateLimit } from "@/lib/rateLimit";

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

  // 预约状态变更限流：10 分钟最多 60 次
  const limited = await rateLimit(`bookings:${user.id}`, {
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    switch (body.action) {
      // ── 所有新预约必须走 Stripe Checkout，这里不再提供免支付下单入口 ──
      case "create": {
        return NextResponse.json(
          { error: "请通过支付页面完成下单", code: "USE_STRIPE_CHECKOUT" },
          { status: 410 }
        );
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
