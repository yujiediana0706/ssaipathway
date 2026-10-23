import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminDb } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook：必须用原始 body 验签，不能用 request.json()。
 * 幂等：以 Stripe event.id 写入 stripe_events，重复投递直接返回 200。
 */
export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "db unavailable" }, { status: 503 });

  // 幂等去重
  const eventRef = db.collection("stripe_events").doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await eventRef.set({
    type: event.type,
    received_at: new Date().toISOString(),
    livemode: event.livemode,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id || session.client_reference_id || "";
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        if (orderId) await mp.markOrderPaid(orderId, paymentIntent);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id || session.client_reference_id || "";
        if (orderId) await mp.expireUnpaidOrder(orderId, "支付会话已过期");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id ?? "";
        if (paymentIntent) await mp.markOrderRefundedByPaymentIntent(paymentIntent);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // 处理失败：删除幂等标记，允许 Stripe 重试
    console.error("[stripe/webhook] handler failed", { eventId: event.id, type: event.type, err });
    await eventRef.delete().catch(() => undefined);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
