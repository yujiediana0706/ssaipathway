import { NextResponse } from 'next/server';
import * as db from '@/lib/firestore';
import { getAuthedUser } from '@/lib/firebaseAdmin';
import { addMemory, summarizeReport } from '@/lib/userMemory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const reports = await db.getReportsByUserId(user.id);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[API report] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'create': {
        const { report } = body;
        // 强制归属到当前登录用户
        const created = await db.createReport({ ...report, user_id: user.id });
        // 写入 AI 教练长期记忆：这次诊断的结论
        if (report && typeof report === 'object') {
          const summary = summarizeReport(report as Record<string, unknown>);
          if (summary) {
            await addMemory(user.id, {
              type: 'diagnosis',
              title: '职业诊断分析',
              content: summary,
              tags: ['诊断', '职业方向'],
              source: 'report',
              importance: 5,
            }).catch(() => null);
          }
        }
        return NextResponse.json({ report: created });
      }
      case 'latest': {
        const report = await db.getLatestReportByUserId(user.id);
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
