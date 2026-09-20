import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as mp from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/coach/slots?coachId=xxx  → 未来可约档期（公开）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coachId = searchParams.get("coachId");
  if (!coachId) return NextResponse.json({ error: "缺少 coachId" }, { status: 400 });
  const slots = await mp.listSlotsByCoach(coachId, {
    onlyAvailable: true,
    fromIso: new Date().toISOString(),
  });
  return NextResponse.json({ slots });
}

// POST 教练管理自己的档期：add / remove / mine
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const coach = await mp.getCoachByUserId(user.id);
  if (!coach) return NextResponse.json({ error: "请先开通教练主页" }, { status: 403 });

  try {
    const body = await request.json();
    switch (body.action) {
      case "mine": {
        const slots = await mp.listSlotsByCoach(coach.id);
        return NextResponse.json({ slots });
      }
      case "add": {
        const startAts: string[] = Array.isArray(body.startAts) ? body.startAts : [];
        if (!startAts.length) return NextResponse.json({ error: "未提供时间" }, { status: 400 });
        const result = await mp.addSlots(coach.id, startAts);
        return NextResponse.json(result);
      }
      case "remove": {
        if (!body.slotId) return NextResponse.json({ error: "缺少 slotId" }, { status: 400 });
        await mp.deleteSlot(coach.id, body.slotId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "未知操作" }, { status: 400 });
    }
  } catch (err) {
    console.error("[api/coach/slots]", err);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
