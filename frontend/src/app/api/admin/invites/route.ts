import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { isAdminUser } from "@/lib/admins";
import {
  generateInviteCodes,
  isInviteRequired,
  listInviteCodes,
  type InviteType,
} from "@/lib/inviteCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!(await isAdminUser(user))) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  try {
    const invites = await listInviteCodes();
    return NextResponse.json({ invites, required: isInviteRequired() });
  } catch {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const type: InviteType = body?.type === "coach" ? "coach" : "peer";
  const multiUse = body?.multiUse === true;
  const count = Number(body?.count) || 0;
  const inviter = typeof body?.inviter === "string" ? body.inviter.trim() : "";
  const expiresDays = Number(body?.expiresDays) || 30;
  const maxUses = Number(body?.maxUses) || 100;
  const boundEmail =
    typeof body?.boundEmail === "string" && body.boundEmail.trim() ? body.boundEmail.trim() : null;

  if (!inviter) return NextResponse.json({ error: "inviter_required" }, { status: 400 });
  if (!multiUse && (count < 1 || count > 200)) {
    return NextResponse.json({ error: "invalid_count" }, { status: 400 });
  }
  if (multiUse && (maxUses < 1 || maxUses > 1000)) {
    return NextResponse.json({ error: "invalid_max_uses" }, { status: 400 });
  }

  try {
    const invites = await generateInviteCodes({
      type,
      count,
      inviter,
      expiresDays,
      boundEmail,
      multiUse,
      maxUses,
    });
    return NextResponse.json({ invites });
  } catch {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}
