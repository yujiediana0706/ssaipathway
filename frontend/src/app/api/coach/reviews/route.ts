import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as mp from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { action: create|update, bookingId/reviewId, rating, comment }
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await request.json();
    const rating = Number(body.rating);
    const comment = String(body.comment ?? "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "评分需为 1–5 的整数" }, { status: 400 });
    }
    if (comment.length < 5) return NextResponse.json({ error: "评价内容至少 5 个字" }, { status: 400 });

    if (body.action === "create") {
      const review = await mp.createReview({
        bookingId: body.bookingId, reviewerId: user.id, rating, comment,
      });
      return NextResponse.json({ review });
    }
    if (body.action === "update") {
      const review = await mp.updateReview({
        reviewId: body.reviewId, reviewerId: user.id, rating, comment,
      });
      return NextResponse.json({ review });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (err) {
    if (err instanceof mp.MarketplaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/coach/reviews]", err);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
