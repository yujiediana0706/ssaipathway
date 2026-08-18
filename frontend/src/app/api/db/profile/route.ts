import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const name = searchParams.get('name');

  try {
    if (id) {
      const profile = await db.getProfileById(id);
      return NextResponse.json({ profile });
    }
    if (name) {
      const profile = await db.getProfileByName(name);
      return NextResponse.json({ profile });
    }
    return NextResponse.json({ error: 'Missing id or name parameter' }, { status: 400 });
  } catch (error) {
    console.error('[API profile] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, profile } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'create': {
        const created = await db.createProfile(profile);
        return NextResponse.json({ profile: created });
      }
      case 'update': {
        const { id, updates } = body;
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const updated = await db.updateProfile(id, updates);
        return NextResponse.json({ profile: updated });
      }
      case 'delete': {
        const { id } = body;
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        await db.deleteProfile(id);
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
