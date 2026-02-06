import { NextRequest, NextResponse } from 'next/server';
import { pullFromSupabase } from '@m2sql/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';

export async function POST(req: NextRequest) {
  try {
    const { databaseName } = await req.json() as { databaseName: string };

    const supabase = getSupabaseClient();

    const database = await pullFromSupabase(
      supabase,
      databaseName || 'Database',
      {
        verbose: false,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Successfully pulled from Supabase',
      database,
    });
  } catch (error) {
    console.error('Pull error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
