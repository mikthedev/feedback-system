import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { runMonthlyTotmFinalization } from '@/lib/totm'

/**
 * POST/GET — Finalise previous calendar month (idempotent).
 * Secure with CRON_SECRET. Schedule: start of each month (e.g. 0 0 1 * *).
 */
async function handle(request: NextRequest) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await runMonthlyTotmFinalization(supabase)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('TOTM finalize cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
