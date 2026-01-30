import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyQueueMovement, MAX_XP_USABLE_PER_SESSION, XP_PER_POSITION, type QueueItem } from '@/lib/xp'
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
 * POST - Use your XP to move your submission(s) up the queue (manual only).
 * Applies movement, persists moves_used_this_session, returns moves applied for current user.
 * Max 3 moves / 300 XP per session. No automatic usage elsewhere.
 */
export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: currentSession } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentSession?.session_number) {
      return NextResponse.json(
        { error: 'No open session' },
        { status: 400 }
      )
    }

    const sn = currentSession.session_number

    const { data: rows } = await supabase
      .from('submissions')
      .select('id, user_id, created_at')
      .eq('status', 'pending')
      .eq('session_number', sn)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    const submissions = rows ?? []
    const userIds = [...new Set((submissions as { user_id: string }[]).map((s) => s.user_id))]

    const xpByUser: Record<string, number> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, xp')
        .in('id', userIds)
      for (const u of users ?? []) {
        const r = u as { id: string; xp?: unknown }
        xpByUser[r.id] = parseXp(r.xp)
      }
    }

    const usxRows = (await (async () => {
      if (userIds.length === 0) return []
      const { data } = await supabase
        .from('user_session_xp')
        .select('user_id, moves_used_this_session, presence_minutes')
        .eq('session_number', sn)
        .in('user_id', userIds)
      return (data ?? []) as { user_id: string; moves_used_this_session: number; presence_minutes: number }[]
    })())

    const usxMap: Record<string, { moves: number; presence: number }> = {}
    for (const r of usxRows) {
      usxMap[r.user_id] = {
        moves: typeof r.moves_used_this_session === 'number' ? r.moves_used_this_session : 0,
        presence: typeof r.presence_minutes === 'number' ? r.presence_minutes : 0,
      }
    }

    const items: QueueItem[] = (submissions as { id: string; user_id: string; created_at: string }[]).map((s) => {
      const ux = usxMap[s.user_id]
      return {
        id: s.id,
        user_id: s.user_id,
        created_at: s.created_at,
        user_xp: xpByUser[s.user_id] ?? 0,
        moves_used_this_session: ux?.moves ?? 0,
        presence_minutes: ux?.presence ?? 0,
      }
    })

    const { ordered, movesDelta } = applyQueueMovement(items)
    const myDelta = movesDelta[userId] ?? 0

    if (myDelta <= 0) {
      const used = (usxMap[userId]?.moves ?? 0) * XP_PER_POSITION
      const xp = xpByUser[userId] ?? 0
      const potential = Math.min(3, Math.floor(xp / XP_PER_POSITION))
      if (potential <= 0 || xp < 100) {
        return NextResponse.json({
          success: true,
          movesApplied: 0,
          message: 'Not enough XP to move (need 100+).',
        })
      }
      if (used >= MAX_XP_USABLE_PER_SESSION) {
        return NextResponse.json({
          success: true,
          movesApplied: 0,
          message: 'You have already used the max 300 XP this session.',
        })
      }
      const maxMovesForCurrentXp = potential * XP_PER_POSITION
      if (used >= maxMovesForCurrentXp) {
        return NextResponse.json({
          success: true,
          movesApplied: 0,
          message: `No moves left for your current XP (${used} used). Add more XP to get another move.`,
        })
      }
      const isFirstInQueue = items.length > 0 && items[0].user_id === userId
      return NextResponse.json({
        success: true,
        movesApplied: 0,
        message: isFirstInQueue
          ? "You're already first in the queue. No position change needed."
          : 'No position change possible (queue or XP gap).',
      })
    }

    const xpUsedByDelta = myDelta * XP_PER_POSITION
    for (const uid of Object.keys(movesDelta)) {
      const delta = movesDelta[uid]
      if (delta <= 0) continue
      const ux = usxMap[uid]
      const prev = ux?.moves ?? 0
      const next = prev + delta
      await supabase.from('user_session_xp').upsert(
        {
          user_id: uid,
          session_number: sn,
          moves_used_this_session: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_number' }
      )
    }

    for (let i = 0; i < ordered.length; i++) {
      await supabase
        .from('submissions')
        .update({ queue_position: i + 1 })
        .eq('id', ordered[i].id)
    }

    return NextResponse.json({
      success: true,
      movesApplied: myDelta,
      xpUsed: xpUsedByDelta,
      message: myDelta === 1
        ? 'Used 100 XP. Your track moved up 1 position.'
        : `Used ${xpUsedByDelta} XP. Your track moved up ${myDelta} positions.`,
    })
  } catch (e) {
    console.error('POST /api/xp/use error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
