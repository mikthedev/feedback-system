import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deductXp,
  logXp,
  validateUseXp,
  XP_PER_POSITION,
} from '@/lib/xp'
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
 * POST - Use XP: spend exactly 100 XP to move the user's submission up exactly ONE position.
 * Movement happens ONLY when this action succeeds. No automatic queue reordering.
 * XP is deducted only on success.
 */
export async function POST(_request: NextRequest) {
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
        success: true,
        movesApplied: 0,
        message: 'No open session.',
      })
    }

    const sn = currentSession.session_number

    const { data: rows } = await supabase
      .from('submissions')
      .select('id, user_id, queue_position')
      .eq('status', 'pending')
      .eq('session_number', sn)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    const submissions = (rows ?? []) as Array<{ id: string; user_id: string; queue_position: number | null }>
    const items = submissions.map((s) => ({ id: s.id, user_id: s.user_id }))

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

    const userIndex = items.findIndex((i) => i.user_id === userId)
    let aboveUserXp: number | null = null
    if (userIndex > 0) {
      const aboveUserId = items[userIndex - 1]!.user_id
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

    if (!validation.allowed) {
      return NextResponse.json({
        success: false,
        movesApplied: 0,
        message: `No XP was spent. ${validation.reason}`,
      })
    }

    const { myIndex, mySubmissionId, aboveSubmissionId } = validation
    // Swap positions in the ordered array (index-based, not raw queue_position)
    const reordered = [...submissions]
    const aboveIndex = myIndex - 1
    ;[reordered[myIndex], reordered[aboveIndex]] = [reordered[aboveIndex]!, reordered[myIndex]!]
    // Assign sequential unique queue_positions (1,2,3,...) to prevent ties.
    // Ties + created_at tiebreaker caused users to jump multiple spots (e.g. 3rd→1st).
    const updates = reordered.map((row, i) => ({
      id: row.id,
      queue_position: i + 1,
    }))
    for (const u of updates) {
      await supabase
        .from('submissions')
        .update({ queue_position: u.queue_position })
        .eq('id', u.id)
    }

    // After swap: reordered[myIndex] holds the submission we swapped with (the bumped user)
    const bumpedUserId = reordered[myIndex]!.user_id
    await deductXp(supabase, userId, XP_PER_POSITION)
    await logXp(
      supabase,
      userId,
      -XP_PER_POSITION,
      'queue_move',
      `Moved up 1 position in queue (-${XP_PER_POSITION} XP)`
    )
    await logXp(
      supabase,
      bumpedUserId,
      0,
      'queue_bump',
      'Moved down 1 spot (someone passed you)',
      { allowZero: true }
    )

    await supabase.from('user_session_xp').upsert(
      {
        user_id: userId,
        session_number: sn,
        moves_used_this_session: movesUsedThisSession + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_number' }
    )

    return NextResponse.json({
      success: true,
      movesApplied: 1,
      xpUsed: XP_PER_POSITION,
      message: 'Used 100 XP. Your track moved up 1 position.',
    })
  } catch (e) {
    console.error('POST /api/xp/use error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
