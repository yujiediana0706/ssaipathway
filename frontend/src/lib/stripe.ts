// ============================================================
// Stripe 服务端封装（仅服务端调用）
// 未配置 STRIPE_SECRET_KEY 时 isStripeConfigured() 返回 false，相关接口明确报错
// ============================================================
import Stripe from "stripe";

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { typescript: true });
  }
  return cached;
}

/** 订单币种（Stripe 小写，默认美元） */
export function getCurrency(): string {
  return (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
}

/** 平台抽成比例（0-1），用于记录教练可结算金额，不影响实际收款 */
export function getPlatformFeeRate(): number {
  const raw = Number(process.env.PLATFORM_FEE_RATE || "0.2");
  return Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : 0.2;
}
