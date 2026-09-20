import { NextResponse } from 'next/server';
import * as mp from '@/lib/marketplace';

export const runtime = 'nodejs';

// 兼容旧前端（mockData.fetchCoaches）的 shim；新市场页面请使用 /api/coaches
export async function GET() {
  try {
    const coaches = await mp.listCoaches({ limit: 20 });
    const legacy = coaches.map((c) => ({
      id: c.id,
      name: c.display_name,
      avatar_url: c.avatar_url,
      headline: c.headline,
      industry: c.topic_tags[0] ?? '',
      years_experience: 0,
      rate_per_hour: c.price_single ?? (c.price_package_5 ? Math.round(c.price_package_5 / 5) : 0),
      rating: c.rating_avg ?? 0,
      sessions_count: c.sessions_count,
      available_slots: [],
      coach_type: c.verified ? 'verified' : 'human',
    }));
    return NextResponse.json({ coaches: legacy });
  } catch (error) {
    console.error('[API coach] GET error:', error);
    return NextResponse.json({ coaches: [] });
  }
}
