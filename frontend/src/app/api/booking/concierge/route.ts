import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Concierge MVP 预约接口
 * 不收钱、不走支付，只收集用户需求并通知平台，
 * 然后由 AI / 页面展示平台个人微信二维码，引导用户加微信。
 */
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // 限流：每个用户 10 分钟最多 10 次预约提交
  const limited = await rateLimit(`concierge-booking:${user.id}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { coachId, question, expectedTime, contact, consent } = body || {};

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "请填写你想聊的问题" }, { status: 400 });
    }
    if (!contact || !contact.trim()) {
      return NextResponse.json({ error: "请填写联系方式（微信号或手机号）" }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: "请同意将联系方式提供给匹配的教练" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) throw new Error("Firebase Admin not configured");

    const now = new Date().toISOString();
    const ref = db.collection("concierge_bookings").doc();

    const record = {
      id: ref.id,
      user_id: user.id,
      user_email: user.email || "",
      user_name: user.name || "",
      coach_id: coachId || null,
      question: question.trim(),
      expected_time: expectedTime || "",
      contact: contact.trim(),
      consent: true,
      status: "pending_wechat", // pending_wechat → grouped → done
      created_at: now,
      updated_at: now,
    };

    await ref.set(record);

    // 飞书机器人通知（如果配置了 webhook）
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const coachName = coachId
          ? (await db.collection("coaches").doc(coachId).get()).data()?.display_name || "未指定"
          : "平台 AI 推荐";
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            msg_type: "interactive",
            card: {
              header: {
                title: { tag: "plain_text", content: "🔔 新的 Concierge 预约请求" },
                template: "green",
              },
              elements: [
                { tag: "div", text: { tag: "lark_md", content: `**用户**：${record.user_name || record.user_email || "匿名"}` } },
                { tag: "div", text: { tag: "lark_md", content: `**想聊的问题**：${record.question}` } },
                { tag: "div", text: { tag: "lark_md", content: `**期望时间**：${record.expected_time || "未指定"}` } },
                { tag: "div", text: { tag: "lark_md", content: `**联系方式**：${record.contact}` } },
                { tag: "div", text: { tag: "lark_md", content: `**预约教练**：${coachName}` } },
                { tag: "hr" },
                { tag: "note", elements: [{ tag: "plain_text", content: "请在 2 小时内（工作时间）通过微信联系用户并拉群对接。" }] },
              ],
            },
          }),
        });
      } catch (err) {
        console.warn("[concierge] 飞书通知发送失败:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      bookingId: ref.id,
      wechatQrUrl: "/wechat/qr.jpg",
      message: "预约提交成功！请扫码添加我的微信，我会在 1 个工作日内帮你对接合适的教练～",
    });
  } catch (err) {
    console.error("[api/booking/concierge]", err);
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
