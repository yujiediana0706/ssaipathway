import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { resolveAdmin } from "@/lib/admins";
import { ERR, RoleError, toErrorResponse } from "@/lib/roles";
import {
  beginReview,
  decideApplication,
  listApplications,
  type DecisionAction,
} from "@/lib/roleApplications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return { user: null, res: NextResponse.json({ error: "未登录", code: "E_UNAUTHORIZED" }, { status: 401 }) };
  }
  const ok = await resolveAdmin(user);
  if (!ok) {
    return {
      user: null,
      res: NextResponse.json({ error: "无管理员权限", code: ERR.NOT_ADMIN }, { status: 403 }),
    };
  }
  return { user, res: null };
}

/** 待审列表 / 已审列表（支持 overdue、reviewer 过滤） */
export async function GET(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status") ?? "pending";
  const status = (["pending", "reviewed", "all"].includes(statusRaw) ? statusRaw : "all") as
    | "pending"
    | "reviewed"
    | "all";
  try {
    const applications = await listApplications({
      status,
      overdueOnly: searchParams.get("overdue") === "1",
      reviewerId: searchParams.get("reviewer") ?? undefined,
    });
    return NextResponse.json({
      applications,
      stats: {
        pending: applications.filter((a) => ["submitted", "under_review"].includes(a.status)).length,
        overdue: applications.filter((a) => a.overdue).length,
      },
    });
  } catch (err) {
    const { body, status: code } = toErrorResponse(err);
    return NextResponse.json(body, { status: code });
  }
}

const ACTIONS: DecisionAction[] = ["approve", "reject", "suspend", "restore"];

/** begin_review | approve | reject | suspend | restore（一律需要原因） */
export async function POST(request: Request) {
  const { user, res } = await requireAdmin(request);
  if (res) return res;
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const applicationId = String(body.applicationId ?? "");
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!applicationId) {
    return NextResponse.json({ error: "缺少 applicationId", code: "E_BAD_REQUEST" }, { status: 400 });
  }

  try {
    if (action === "begin_review") {
      const app = await beginReview({ actor: user, applicationId });
      return NextResponse.json({ application: app });
    }
    if (!ACTIONS.includes(action as DecisionAction)) {
      throw new RoleError("E_BAD_REQUEST", "未知的审核动作", 400);
    }
    if (!reason) {
      throw new RoleError(ERR.REASON_REQUIRED, "审核动作必须填写原因", 400);
    }
    const app = await decideApplication({
      actor: user,
      applicationId,
      action: action as DecisionAction,
      reason,
    });
    return NextResponse.json({ application: app });
  } catch (err) {
    const { body: errBody, status } = toErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
