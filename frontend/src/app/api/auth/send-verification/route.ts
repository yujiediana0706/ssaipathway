/**
 * POST /api/auth/send-verification
 *
 * 用 Firebase Admin SDK 生成邮箱验证链接，然后用 Resend 发邮件。
 * 替换 Firebase Auth 内置邮件（送达率太低）。
 *
 * Body: { email: string, displayName?: string }
 * Auth: 需要登录（从 Authorization header 提取 uid）
 */

import { NextResponse } from "next/server";
import { getAdminAuth, getAuthedUser } from "@/lib/firebaseAdmin";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authed = await getAuthedUser(request);
  if (!authed) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const { email, displayName } = (await request.json().catch(() => ({}))) as {
    email?: string;
    displayName?: string;
  };

  if (!email) {
    return NextResponse.json({ success: false, error: "缺少 email" }, { status: 400 });
  }

  // 安全检查：只能给当前登录用户自己的邮箱发
  if (email !== authed.email) {
    return NextResponse.json(
      { success: false, error: "只能给自己的邮箱发送验证邮件" },
      { status: 403 }
    );
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json(
      { success: false, error: "服务配置错误" },
      { status: 500 }
    );
  }

  // Resend 测试域只能发到管理员邮箱。此时直接让前端走 Firebase，
  // 避免先生成一条必然用不到的验证链接，额外消耗 Firebase 发信频率额度。
  if ((process.env.FROM_EMAIL || "").endsWith("@resend.dev")) {
    return NextResponse.json(
      { success: false, error: "Resend 测试域已切换为 Firebase 验证邮件" },
      { status: 503 }
    );
  }

  try {
    // 用 Admin SDK 生成验证链接，指向自建验证页面（applyActionCode 处理）
    // yourpathwayai.com 已添加到 Firebase 授权域，handleCodeInApp:true 让 oobCode 直接传给自建页面
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = await adminAuth.generateEmailVerificationLink(
      email,
      { url: `${appUrl}/zh/auth/verify-email`, handleCodeInApp: true }
    );
    // 用 Resend 发邮件
    const result = await sendVerificationEmail({
      to: email,
      displayName: displayName || authed.name || email.split("@")[0],
      verifyUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "邮件发送失败" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.warn("[send-verification] failed:", err);
    const msg = err instanceof Error ? err.message : "未知错误";

    // Firebase 错误码友好提示
    if (msg.includes("user-not-found")) {
      return NextResponse.json(
        { success: false, error: "未找到该邮箱对应的账号" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
