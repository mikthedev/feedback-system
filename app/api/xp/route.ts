import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_XP_USABLE_PER_SESSION, XP_PER_POSITION } from '@/lib/xp'
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
 * GET - Current user's XP. Returns { xp, moves_used_this_session, xp_used_this_session, xp_stored }.
 * xp_used_this_session = min(moves × 100, 300). xp_stored = total XP (accumulated); up to 300 can be used per session.
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
      return NextResponse.json({ xp: 0, moves_used_this_session: 0, xp_used_this_session: 0, xp_stored: 0, external_xp_this_session: 0, unused_external: 0 })
    }

    const xp = parseXp((data as { xp?: unknown })?.xp)

    const { data: session } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    let movesUsed = 0
    let externalXpThisSession = 0
    if (session?.session_number != null) {
      const { data: usx } = await supabase
        .from('user_session_xp')
        .select('moves_used_this_session, external_xp_this_session')
        .eq('user_id', userId)
        .eq('session_number', session.session_number)
        .maybeSingle()
      const u = usx as { moves_used_this_session?: number; external_xp_this_session?: number } | null
      movesUsed = Math.max(0, Math.floor(Number(u?.moves_used_this_session ?? 0)))
      externalXpThisSession = Math.max(0, Math.floor(Number(u?.external_xp_this_session ?? 0)))
    }

    const xpUsedThisSession = Math.min(movesUsed * XP_PER_POSITION, MAX_XP_USABLE_PER_SESSION)
    const unusedExternal = Math.max(0, externalXpThisSession - xpUsedThisSession)

    return NextResponse.json({
      xp,
      moves_used_this_session: movesUsed,
      xp_used_this_session: xpUsedThisSession,
      xp_stored: xp,
      external_xp_this_session: externalXpThisSession,
      unused_external: unusedExternal,
    })
  } catch (e) {
    console.error('GET /api/xp error:', e)
    return NextResponse.json({ xp: 0, moves_used_this_session: 0, xp_used_this_session: 0, xp_stored: 0, external_xp_this_session: 0, unused_external: 0 })
  }
}
