import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { getAuthedUser } from '@/lib/authServer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const coach = await db.getCoachById(id);
      return NextResponse.json({ coach });
    }
    const coaches = await db.getAllCoaches();
    return NextResponse.json({ coaches });
  } catch (error) {
    console.error('[API coach] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'book': {
        const { booking } = body;
        const created = await db.createBooking({ ...booking, user_id: user.id });
        return NextResponse.json({ booking: created });
      }
      case 'list-bookings': {
        const bookings = await db.getBookingsByUserId(user.id);
        return NextResponse.json({ bookings });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[API coach] POST error:', error);
    return NextResponse.json({ error: 'Coach operation failed' }, { status: 500 });
  }
}
