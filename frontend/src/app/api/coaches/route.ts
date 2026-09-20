import { NextResponse } from "next/server";
import * as mp from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/coaches?q=&verified=1&tag=&maxPrice=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const tag = searchParams.get("tag")?.trim() || undefined;
  const verifiedOnly = searchParams.get("verified") === "1";
  const maxPriceRaw = searchParams.get("maxPrice");
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;

  const coaches = await mp.listCoaches({
    q, tag, verifiedOnly,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : undefined,
    limit: 20,
  });
  return NextResponse.json({ coaches });
}
