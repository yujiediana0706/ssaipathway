import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { resolveAdmin } from "@/lib/admins";
import { getMyRoleState } from "@/lib/roleApplications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前登录用户的轻量信息（用于前端按权限渲染入口） */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json(
      { user: null, isAdmin: false, isCoach: false, isPeer: false, role: "none", roleStatus: "none" },
      { status: 401 },
    );
  }

  const [isAdmin, roleState] = await Promise.all([resolveAdmin(user), getMyRoleState(user.id)]);
  const active = roleState.roleStatus === "active";

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    isAdmin,
    // 只有 coach 且 active 才算教练；peer 不会被算成 coach
    isCoach: roleState.role === "coach" && active,
    isPeer: roleState.role === "peer" && active,
    role: roleState.role,
    roleStatus: roleState.roleStatus,
    applicationStatus: roleState.application?.status ?? null,
    requestedRole: roleState.application?.requested_role ?? null,
  });
}
