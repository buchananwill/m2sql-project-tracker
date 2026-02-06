import { NextRequest, NextResponse } from 'next/server';
import { pushToSupabase } from '@m2sql/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Database } from '@m2sql/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const body = await req.json().catch(() => null);

    if (!body || !body.database) {
      return NextResponse.json(
        { error: 'Missing or invalid database in request body' },
        { status: 400 }
      );
    }

    const { database } = body as { database: Database };

    // Validate database structure
    if (!database.tables || !Array.isArray(database.tables)) {
      return NextResponse.json(
        { error: 'Invalid database structure: missing tables array' },
        { status: 400 }
      );
    }

    // Get Supabase client (may throw if env vars missing)
    const supabase = getSupabaseClient();

    // Push to Supabase
    const result = await pushToSupabase(database, supabase, {
      verbose: false,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully pushed to Supabase',
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Push error:', error);

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
