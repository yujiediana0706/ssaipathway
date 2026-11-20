import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { bootstrapEligible, resolveAdmin } from "@/lib/admins";
import { getMyRoleState } from "@/lib/roleApplications";
import { isEmailVerificationRequired } from "@/lib/emailVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前登录用户的轻量信息（用于前端按权限渲染入口）。只读，不在本接口写库提权。 */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json(
      {
        user: null,
        isAdmin: false,
        isCoach: false,
        isPeer: false,
        role: "none",
        roleStatus: "none",
        emailVerified: false,
        bootstrapEligible: false,
      },
      { status: 401 },
    );
  }

  const [isAdmin, canBootstrap, roleState] = await Promise.all([
    resolveAdmin(user),
    // M5：只读判断，真正的提权走显式 POST /api/admin/bootstrap
    bootstrapEligible(user),
    getMyRoleState(user.id),
  ]);
  const active = roleState.roleStatus === "active";

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    isAdmin,
    // 只有 coach 且 active 才算教练；peer 不会被算成 coach
    isCoach: roleState.role === "coach" && active,
    isPeer: roleState.role === "peer" && active,
    role: roleState.role,
    roleStatus: roleState.roleStatus,
    emailVerified: user.emailVerified,
    // 降级开关：REQUIRE_EMAIL_VERIFICATION=0 时普通用户不强制验证邮箱
    requireEmailVerification: isEmailVerificationRequired(),
    bootstrapEligible: canBootstrap,
    applicationStatus: roleState.application?.status ?? null,
    requestedRole: roleState.application?.requested_role ?? null,
  });
}
