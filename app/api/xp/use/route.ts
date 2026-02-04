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
        xpDeducted: false,
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

    const myIndex = items.findIndex((i) => i.user_id === userId)
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

    if (!validation.allowed) {
      return NextResponse.json({
        success: true,
        movesApplied: 0,
        xpDeducted: false,
        message: validation.reason,
      })
    }

    const { mySubmissionId, aboveSubmissionId } = validation
    const myRow = submissions.find((s) => s.id === mySubmissionId)!
    const aboveRow = submissions.find((s) => s.id === aboveSubmissionId)!
    const myPos = myRow.queue_position ?? submissions.indexOf(myRow) + 1
    const abovePos = aboveRow.queue_position ?? submissions.indexOf(aboveRow) + 1

    await supabase
      .from('submissions')
      .update({ queue_position: abovePos })
      .eq('id', mySubmissionId)
    await supabase
      .from('submissions')
      .update({ queue_position: myPos })
      .eq('id', aboveSubmissionId)

    await deductXp(supabase, userId, XP_PER_POSITION)
    await logXp(
      supabase,
      userId,
      -XP_PER_POSITION,
      'queue_move',
      'Used 100 XP to move up 1 position'
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

    const newPosition1Based = validation.myIndex
    return NextResponse.json({
      success: true,
      movesApplied: 1,
      xpUsed: XP_PER_POSITION,
      xpDeducted: true,
      newPosition: newPosition1Based,
      message: `Used 100 XP. You're now #${newPosition1Based} in the queue.`,
    })
  } catch (e) {
    console.error('POST /api/xp/use error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
