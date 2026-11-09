import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserTotmDashboard } from '@/lib/totm'

/** GET — authenticated user's TOTM featured status, history, and queue skips. */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const data = await getUserTotmDashboard(supabase, userId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/totm/me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
