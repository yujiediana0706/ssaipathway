import { NextResponse } from 'next/server';

export function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const configStatus: Record<string, boolean> = {
      NEXT_PUBLIC_SUPABASE_URL: !!url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!anonKey,
      SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
    };

    let dbWorking = false;
    let dbError = '';
    try {
      if (url && serviceKey) {
        const { createClient } = require('@supabase/supabase-js');
        const sb = createClient(url, serviceKey);
        const { data, error } = sb.from('coach_profiles').select('id').limit(1);
        if (!error) dbWorking = true;
        else dbError = error.message;
      }
    } catch (e: any) {
      dbError = e?.message || 'Unknown error';
    }

    return NextResponse.json({
      status: 'ok',
      config: configStatus,
      database: { working: dbWorking, error: dbError },
      timestamp: new Date().toISOString(),
      runtime: 'nodejs',
      nodeVersion: process.version,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    }, { status: 500 });
  }
}
