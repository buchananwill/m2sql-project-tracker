import { NextRequest, NextResponse } from 'next/server';
import { pullFromSupabase } from '@m2sql/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Parse request body (databaseName is optional)
    const body = await req.json().catch(() => ({}));
    const { databaseName = 'Database' } = body as { databaseName?: string };

    // Get Supabase client (may throw if env vars missing)
    const supabase = getSupabaseClient();

    // Pull from Supabase
    const database = await pullFromSupabase(supabase, databaseName, {
      verbose: false,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully pulled from Supabase',
        database,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Pull error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
