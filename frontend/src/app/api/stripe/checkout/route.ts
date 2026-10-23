import { NextResponse } from "next/server";
import { getAuthedUser, getAdminDb } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";
import { getStripe, isStripeConfigured, getCurrency } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutBody {
  coachId?: string;
  slotId?: string;
  kind?: "single" | "package_5";
  locale?: string;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // 每个用户 10 分钟最多发起 10 次支付会话，防止刷单占用档期
  const limited = await rateLimit(`stripe:checkout:${user.id}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "在线支付尚未开启，请联系平台客服完成付款", code: "STRIPE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "支付服务不可用" }, { status: 503 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { coachId, slotId, kind } = body;
  const locale = body.locale === "en" ? "en" : "zh";
  if (!coachId || !slotId || (kind !== "single" && kind !== "package_5")) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  // Stripe 下单前先校验教练已配置，避免创建孤儿订单
  try {
    const coach = await mp.getCoachProfileById(coachId, { includePrivate: false });
    if (!coach) return NextResponse.json({ error: "教练不存在" }, { status: 404 });
  } catch (err) {
    console.error("[stripe/checkout] coach lookup failed", err);
    return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 });
  }

  let orderId = "";
  try {
    const { order } = await mp.createBookingSession({
      coacheeId: user.id,
      coachId,
      slotId,
      kind,
    });
    orderId = order.id;

    const base = appBaseUrl();
    const currency = getCurrency();
    const productName = kind === "single"
      ? (locale === "en" ? "1:1 Career Coaching Session" : "1 对 1 职业教练单次咨询")
      : (locale === "en" ? "5-Session Career Coaching Package" : "5 次职业教练套餐");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round(order.amount * 100),
            product_data: {
              name: productName,
              metadata: { coach_id: coachId, kind },
            },
          },
        },
      ],
      customer_email: user.email || undefined,
      client_reference_id: order.id,
      metadata: {
        order_id: order.id,
        coachee_id: user.id,
        coach_id: coachId,
        kind,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${base}/${locale}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${locale}/payment/cancel?order_id=${order.id}`,
    });

    await mp.attachStripeSession(order.id, session.id);

    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (err) {
    console.error("[stripe/checkout] failed", { orderId, err });
    if (orderId) {
      // 支付会话创建失败：释放档期，避免长时间占位
      try {
        await mp.expireUnpaidOrder(orderId, "支付会话创建失败");
      } catch (cleanupErr) {
        console.error("[stripe/checkout] cleanup failed", { orderId, cleanupErr });
      }
    }
    if (err instanceof mp.MarketplaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "创建支付会话失败" }, { status: 500 });
  }
}

/** 定时任务入口：清理过期未支付订单（Cloud Scheduler 调用，需带 X-Cleanup-Token） */
export async function GET(request: Request): Promise<Response> {
  const token = process.env.CLEANUP_TOKEN || "";
  if (!token || request.headers.get("x-cleanup-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  const cleaned = await mp.expireStaleUnpaidOrders();
  return NextResponse.json({ cleaned });
}
