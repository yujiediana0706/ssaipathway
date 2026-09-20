import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as mp from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthedUser(request); // 可为匿名
  const coach = await mp.getCoachProfileById(id, {
    userId: user?.id ?? null,
    includePrivate: false,
  });
  if (!coach) return NextResponse.json({ error: "教练不存在" }, { status: 404 });

  const [reviews, slots] = await Promise.all([
    mp.listReviewsByCoach(id),
    mp.listSlotsByCoach(id, { onlyAvailable: true, fromIso: new Date().toISOString() }),
  ]);

  // 非教练本人且非确认订单的买家，meeting_link 在 getCoachProfileById 内已剥离
  return NextResponse.json({ coach, reviews, slots });
}
