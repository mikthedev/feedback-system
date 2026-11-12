import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicTotmPayload } from '@/lib/totm'

// Always fresh — simulation seed and live ranking must appear immediately
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET — public Top of the Month (current + history). No curator scores.
 *  Simulation tracks are included only for curator/tester sessions.
 */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    let includeSimulation = false
    if (userId) {
      const { data: me } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      const role = (me as { role?: string } | null)?.role
      includeSimulation = role === 'curator' || role === 'tester'
    }

    const payload = await getPublicTotmPayload(supabase, { includeSimulation })
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('GET /api/totm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
