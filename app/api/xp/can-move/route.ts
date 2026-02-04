import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUseXp } from '@/lib/xp'
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
 * GET - Returns whether "Use XP" is currently allowed and the reason if not.
 * Use for enabling/disabling the Use XP button and showing a clear reason when disabled.
 * Same validation as POST /api/xp/use (single move: spend 100 XP, move up 1 position).
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: config } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()
    const submissionsOpen = (config as { submissions_open?: boolean } | null)?.submissions_open ?? true

    const { data: userRow } = await supabase
      .from('users')
      .select('role, xp')
      .eq('id', userId)
      .single()
    const user = userRow as { role?: string; xp?: unknown } | null
    const isTester = user?.role === 'tester'
    const userXp = parseXp(user?.xp)

    const { data: currentSession } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentSession?.session_number) {
      return NextResponse.json({
        allowed: false,
        reason: 'No open session.',
      })
    }

    const sn = currentSession.session_number

    const { data: rows } = await supabase
      .from('submissions')
      .select('id, user_id')
      .eq('status', 'pending')
      .eq('session_number', sn)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    const items = (rows ?? []).map((r: { id: string; user_id: string }) => ({ id: r.id, user_id: r.user_id }))

    let movesUsedThisSession = 0
    const { data: usx } = await supabase
      .from('user_session_xp')
      .select('moves_used_this_session')
      .eq('user_id', userId)
      .eq('session_number', sn)
      .maybeSingle()
    if (usx && typeof (usx as { moves_used_this_session?: number }).moves_used_this_session === 'number') {
      movesUsedThisSession = Math.max(0, (usx as { moves_used_this_session: number }).moves_used_this_session)
    }

    const myIndex = items.findIndex((i: { user_id: string }) => i.user_id === userId)
    let aboveUserXp: number | null = null
    if (myIndex > 0) {
      const aboveUserId = items[myIndex - 1]!.user_id
      const { data: aboveUser } = await supabase
        .from('users')
        .select('xp')
        .eq('id', aboveUserId)
        .single()
      aboveUserXp = aboveUser ? parseXp((aboveUser as { xp?: unknown }).xp) : 0
    }

    const validation = validateUseXp({
      items,
      userId,
      userXp,
      movesUsedThisSession,
      isTester,
      submissionsOpen,
      aboveUserXp,
    })

    if (validation.allowed) {
      return NextResponse.json({
        allowed: true,
        reason: 'Spend 100 XP to move up 1 position.',
      })
    }
    return NextResponse.json({
      allowed: false,
      reason: validation.reason,
    })
  } catch (e) {
    console.error('GET /api/xp/can-move error:', e)
    return NextResponse.json({ allowed: false, reason: 'Unable to check.' }, { status: 200 })
  }
}
