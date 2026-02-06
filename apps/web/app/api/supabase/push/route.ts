import { NextRequest, NextResponse } from 'next/server';
import { pushToSupabase } from '@m2sql/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Database } from '@m2sql/model';

export async function POST(req: NextRequest) {
  try {
    const { database } = await req.json() as { database: Database };

    if (!database) {
      return NextResponse.json(
        { error: 'Missing database in request body' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const result = await pushToSupabase(database, supabase, {
      verbose: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully pushed to Supabase',
      result,
    });
  } catch (error) {
    console.error('Push error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
