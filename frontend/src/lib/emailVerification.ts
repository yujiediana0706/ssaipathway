/**
 * 邮箱验证策略开关（服务端读取，运行时生效，不需要重新构建）
 *
 * 默认严格：未验证邮箱的普通用户不能使用受保护的页面。
 * 显式设置 REQUIRE_EMAIL_VERIFICATION=0 时放宽（例如 Resend 域名还没配好）。
 * 管理员不受此开关影响：管理员判定始终要求 email_verified（见 lib/admins.ts）。
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== "0";
}
