import { NextResponse } from 'next/server';

export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NOT_SET';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'NOT_SET';

  return NextResponse.json({
    status: 'ok',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url === 'NOT_SET' ? 'NOT_SET' : 'SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey === 'NOT_SET' ? 'NOT_SET' : 'SET',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey === 'NOT_SET' ? 'NOT_SET' : 'SET',
    },
    runtime: 'nodejs',
    timestamp: new Date().toISOString(),
  });
}
