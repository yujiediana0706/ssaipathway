import { NextResponse } from 'next/server';
import * as db from '@/lib/db';

export const runtime = 'edge';

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
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'book': {
        const { booking } = body;
        const created = await db.createBooking(booking);
        return NextResponse.json({ booking: created });
      }
      case 'list-bookings': {
        const { user_id } = body;
        if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        const bookings = await db.getBookingsByUserId(user_id);
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
