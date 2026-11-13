import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as mp from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return { user: null, res: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  if (!mp.isAdminEmail(user.email)) {
    return { user: null, res: NextResponse.json({ error: "无管理员权限" }, { status: 403 }) };
  }
  return { user, res: null };
}

export async function GET(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const [pending, interviews, all] = await Promise.all([
    mp.listPendingVerifications(),
    mp.listPendingInterviews(),
    mp.listAllCoachesAdmin(),
  ]);
  return NextResponse.json({ pending, interviews, all });
}

export async function POST(request: Request) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  const body = await request.json();

  // mentor 1v1 面试结果登记
  if (body.action === 'interview_pass' || body.action === 'interview_fail') {
    if (!body.coachId) return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    if (body.action === 'interview_fail' && !String(body.reason ?? "").trim()) {
      return NextResponse.json({ error: "面试未通过必须填写理由" }, { status: 400 });
    }
    await mp.setInterviewResult(
      body.coachId,
      body.action === 'interview_pass',
      String(body.reason ?? "").trim() || undefined,
    );
    return NextResponse.json({ ok: true });
  }

  if (!body.coachId || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (!body.approved && !String(body.reason ?? "").trim()) {
    return NextResponse.json({ error: "驳回必须填写理由" }, { status: 400 });
  }
  await mp.setVerification(body.coachId, body.approved, String(body.reason ?? "").trim());
  return NextResponse.json({ ok: true });
}
