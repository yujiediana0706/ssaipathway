import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { ERR, toErrorResponse, writeAudit } from "@/lib/roles";
import {
  detectForbiddenFields,
  getMyRoleState,
  saveApplication,
  withdrawApplication,
} from "@/lib/roleApplications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前用户的身份与申请状态 */
export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录", code: "E_UNAUTHORIZED" }, { status: 401 });
  try {
    const state = await getMyRoleState(user.id);
    return NextResponse.json(state);
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** 保存草稿 / 提交申请 / 重新提交 */
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录", code: "E_UNAUTHORIZED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // 客户端不得自授身份：出现 role / verified / status 等字段直接拒绝并留痕
  const forbidden = detectForbiddenFields(body);
  if (forbidden.length > 0) {
    await writeAudit({
      actor: user,
      action: "security_forbidden_field",
      entity: "security",
      targetUserId: user.id,
      targetEmail: user.email,
      reason: `申请接口收到受保护字段：${forbidden.join(", ")}`,
      meta: { fields: forbidden },
    });
    return NextResponse.json(
      { error: `不允许提交受保护字段：${forbidden.join(", ")}`, code: ERR.FORBIDDEN_FIELD },
      { status: 400 },
    );
  }

  try {
    const app = await saveApplication({
      user: { id: user.id, email: user.email, name: user.name },
      requestedRole: body.requested_role === "coach" ? "coach" : "peer",
      profile: body.profile,
      materials: body.materials,
      submit: body.submit !== false,
    });
    return NextResponse.json({ application: app });
  } catch (err) {
    const { body: errBody, status } = toErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}

/** 撤回申请（冷却 7 天） */
export async function PATCH(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录", code: "E_UNAUTHORIZED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const app = await withdrawApplication({
      user,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });
    return NextResponse.json({ application: app });
  } catch (err) {
    const { body: errBody, status } = toErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
