import { NextResponse } from "next/server";
import * as mp from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/coaches?q=&verified=1&tag=&maxPrice=&tier=peer|mentor（公开，数据已在数据层脱敏）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const tag = searchParams.get("tag")?.trim() || undefined;
  const verifiedOnly = searchParams.get("verified") === "1";
  const maxPriceRaw = searchParams.get("maxPrice");
  const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;
  const tierParam = searchParams.get("tier");
  const tier = tierParam === "peer" || tierParam === "mentor" ? tierParam : undefined;

  const coaches = await mp.listCoaches({
    q, tag, verifiedOnly,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : undefined,
    tier,
    limit: 20,
  });
  return NextResponse.json({ coaches });
}
