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

  try {
    // 用 Admin SDK 生成验证链接（oobCode 是 Firebase 能识别的一次性 token）
    // 验证链接指向自建页面，页面里用 Firebase Client SDK applyActionCode 处理
    const verifyUrl = await adminAuth.generateEmailVerificationLink(
      email,
      { url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/zh/auth/verify-email`, handleCodeInApp: true }
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
