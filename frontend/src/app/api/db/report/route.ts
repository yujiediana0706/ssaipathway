import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  try {
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const reports = await db.getReportsByUserId(userId);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[API report] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'create': {
        const { report } = body;
        const created = await db.createReport(report);
        return NextResponse.json({ report: created });
      }
      case 'latest': {
        const { user_id } = body;
        if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        const report = await db.getLatestReportByUserId(user_id);
        return NextResponse.json({ report });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[API report] POST error:', error);
    return NextResponse.json({ error: 'Report operation failed' }, { status: 500 });
  }
}
