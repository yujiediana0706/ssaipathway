/**
 * 邮件发送封装（Resend）
 *
 * 为什么不用 Firebase Auth 内置邮件？
 * - Firebase 默认发件域是 firebaseapp.com，国内邮箱（QQ/163/Outlook）送达率低
 * - Resend 用自定义域名 + 专业邮件基础设施，送达率 99%+
 * - 自建可以完全控制邮件内容和模板
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@pathway-app-512202.firebaseapp.com";
const FROM_NAME = "Pathway";

export interface VerificationEmailParams {
  to: string;
  displayName: string;
  verifyUrl: string;
}

/**
 * 发送邮箱验证邮件
 * 返回 success: boolean + error?: string
 */
export async function sendVerificationEmail(
  params: VerificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return {
      success: false,
      error: "邮件服务未配置。请设置 RESEND_API_KEY 环境变量。",
    };
  }

  const { to, displayName, verifyUrl } = params;

  try {
    console.log("[email] sending verification to:", to, "from:", FROM_EMAIL);
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: "【Pathway】请验证你的邮箱",
      html: `
        <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">欢迎加入 Pathway 🎉</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">职业转型，从找到对的人开始</p>
          </div>
          <div style="background: #fff; padding: 32px 24px; border-radius: 0 0 12px 12px; border: 1px solid #f1f5f9; border-top: none;">
            <p style="color: #334155; font-size: 15px; margin: 0 0 8px;">
              你好，<strong>${displayName}</strong>
            </p>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              请点击下面的按钮验证你的邮箱，完成后即可开始使用 Pathway。
            </p>
            <a href="${verifyUrl}" 
               style="display: block; background: #6366f1; color: white; text-align: center; 
                      padding: 14px 24px; border-radius: 10px; text-decoration: none; 
                      font-size: 15px; font-weight: 500; margin-bottom: 16px;">
              验证我的邮箱
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
              如果按钮无法点击，请复制以下链接到浏览器：
            </p>
            <p style="color: #64748b; font-size: 12px; margin: 0; word-break: break-all; line-height: 1.5;">
              ${verifyUrl}
            </p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              如果你没有注册 Pathway，请忽略此邮件。
            </p>
          </div>
        </div>
      `,
      text: `你好 ${displayName}，\n\n请点击此链接验证你的邮箱：${verifyUrl}\n\n如果你没有注册 Pathway，请忽略此邮件。`,
    });

    if (error) {
      console.error("[email] Resend error:", JSON.stringify(error));
      return { success: false, error: error.message };
    }

    console.log("[email] Resend sent successfully, id:", data?.id);
    return { success: true };
  } catch (err) {
    console.warn("[email] sendVerificationEmail failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "邮件发送失败",
    };
  }
}

/**
 * 发送通用邮件（密码重置等）
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return { success: false, error: "邮件服务未配置" };
  }
  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "邮件发送失败",
    };
  }
}
