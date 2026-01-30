import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

function parseXp(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.floor(v))
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (!Number.isNaN(n)) return Math.max(0, n)
  }
  return 0
}

/**
 * GET - Current user's XP. Returns { xp: number }. 401 if not logged in.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({ xp: 0 })
    }

    const xp = parseXp((data as { xp?: unknown })?.xp)
    return NextResponse.json({ xp })
  } catch (e) {
    console.error('GET /api/xp error:', e)
    return NextResponse.json({ xp: 0 })
  }
}
