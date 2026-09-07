import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAuthedUser } from '@/lib/authServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    // 无论传什么参数，只返回当前登录用户自己的档案
    const profile = await db.getProfileById(user.id);
    return NextResponse.json({ profile, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('[API profile] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { action, profile, updates } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'create':
      case 'update': {
        // 强制把数据归属到登录账号：id = auth 用户 id，附带 email
        const row = {
          ...(profile || updates || {}),
          email: user.email,
          // name 以账号注册名为准（若旅程带了名字也一并写入，保持同一个）
          ...(profile?.name ? { name: profile.name } : updates?.name ? { name: updates.name } : {}),
        };
        const saved = await db.upsertProfileForUser(user.id, row);
        return NextResponse.json({ profile: saved });
      }
      case 'delete': {
        await db.deleteProfile(user.id);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[API profile] POST error:', error);
    return NextResponse.json({ error: 'Profile operation failed' }, { status: 500 });
  }
}
