import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import {
  bootstrapAdminEmails,
  getBootstrapState,
  grantAdmin,
  listAdmins,
  resolveAdmin,
  revokeAdmin,
} from "@/lib/admins";
import { ERR, toErrorResponse } from "@/lib/roles";

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

export async function GET(request: Request) {
  const { user, res } = await requireAdmin(request);
  if (res) return res;
  const [admins, bootstrap] = await Promise.all([listAdmins(), getBootstrapState()]);
  return NextResponse.json({
    admins,
    me: user,
    bootstrap: { ...bootstrap, emails: bootstrapAdminEmails() },
  });
}

export async function POST(request: Request) {
  const { user, res } = await requireAdmin(request);
  if (res) return res;
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const email = String(body.email ?? "");

  try {
    if (action === "grant") {
      const record = await grantAdmin({
        actor: user,
        email,
        reason: String(body.reason ?? ""),
        confirm: body.confirm === true,
      });
      return NextResponse.json({ admin: record, admins: await listAdmins() });
    }
    if (action === "revoke") {
      await revokeAdmin({
        actor: user,
        email,
        reason: String(body.reason ?? ""),
        confirm: body.confirm === true,
      });
      return NextResponse.json({ admins: await listAdmins() });
    }
    return NextResponse.json({ error: "未知操作", code: "E_BAD_REQUEST" }, { status: 400 });
  } catch (err) {
    const { body: errBody, status } = toErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
