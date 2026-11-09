import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { checkActiveTotmSoundCloudAvailability } from '@/lib/totm'

/**
 * POST/GET — Daily SoundCloud availability check for active TOTM selection.
 * Secure with CRON_SECRET. Schedule: once per day (e.g. 0 6 * * *).
 */
async function handle(request: NextRequest) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await checkActiveTotmSoundCloudAvailability(supabase)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('TOTM availability cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
