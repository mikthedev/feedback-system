import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp, logXp } from '@/lib/xp'
import {
  TIME_XP_PER_TICK,
  TIME_TICK_MINUTES,
  SUB_OR_DONATION_XP,
} from '@/lib/xp'
import { isMikegtcoffLive, userSubscribedToMikegtcoff } from '@/lib/twitch'
import { cookies } from 'next/headers'

const TICK_MS = TIME_TICK_MINUTES * 60 * 1000

// GET - Fetch queue (pending, current session). Order by stored queue_position only
// (set when user clicks "Use my XP"); otherwise created_at. No automatic XP-based reordering.
// Also: time-based XP tick when live + submissions open; sub XP for requesting user (once per session).
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
    const submissionsOpen = config?.submissions_open ?? true

    const { data: currentSession, error: sessionError } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (!currentSession) {
      return NextResponse.json({ queue: [] })
    }

    const sn = currentSession.session_number

    let live = false
    try {
      live = await isMikegtcoffLive()
    } catch {
      /* ignore */
    }

    const { data: rows, error } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        soundcloud_url,
        song_title,
        artist_name,
        created_at,
        time_based_xp,
        last_time_xp_tick_at,
        queue_position,
        users!submissions_user_id_fkey (
          display_name
        )
      `)
      .eq('status', 'pending')
      .eq('session_number', sn)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) throw error
    const submissions = rows ?? []

    if (live && submissionsOpen) {
      const now = Date.now()
      for (const row of submissions) {
        const r = row as {
          id: string
          user_id: string
          created_at: string
          time_based_xp: number
          last_time_xp_tick_at: string | null
        }
        const base = r.last_time_xp_tick_at || r.created_at
        const baseMs = new Date(base).getTime()
        const elapsed = now - baseMs
        const ticks = Math.floor(elapsed / TICK_MS)
        if (ticks > 0) {
          const xp = ticks * TIME_XP_PER_TICK
          try {
            await addXp(supabase, r.user_id, xp)
            await logXp(supabase, r.user_id, xp, 'time', `Time XP +${xp} (${ticks}×${TIME_XP_PER_TICK} per ${TIME_TICK_MINUTES} min)`)
          } catch (e) {
            console.error('Time-based XP grant error:', e)
          }
          const newTickAt = new Date(baseMs + ticks * TICK_MS).toISOString()
          const newTimeXp = (r.time_based_xp ?? 0) + xp
          await supabase
            .from('submissions')
            .update({
              time_based_xp: newTimeXp,
              last_time_xp_tick_at: newTickAt,
            })
            .eq('id', r.id)
        }
      }
    }

    const { data: usx } = await supabase
      .from('user_session_xp')
      .select('sub_xp_granted, external_xp_this_session')
      .eq('user_id', userId)
      .eq('session_number', sn)
      .maybeSingle()

    const usxRow = usx as { sub_xp_granted?: boolean; external_xp_this_session?: number } | null
    const subGranted = usxRow?.sub_xp_granted ?? false
    if (submissionsOpen && !subGranted) {
      const { data: user } = await supabase
        .from('users')
        .select('twitch_id')
        .eq('id', userId)
        .single()
      const twitchId = (user as { twitch_id?: string } | null)?.twitch_id
      if (twitchId) {
        const { data: tok } = await supabase
          .from('user_tokens')
          .select('access_token, expires_at')
          .eq('user_id', userId)
          .single()
        const t = tok as { access_token?: string; expires_at?: string } | null
        if (t?.access_token) {
          const exp = t.expires_at ? new Date(t.expires_at).getTime() : 0
          if (exp > Date.now() + 60_000) {
            try {
              const subbed = await userSubscribedToMikegtcoff(twitchId, t.access_token)
              if (subbed) {
                await addXp(supabase, userId, SUB_OR_DONATION_XP)
                await logXp(supabase, userId, SUB_OR_DONATION_XP, 'sub', 'Sub +20 XP (this session)')
                const prevExternal = Math.max(0, Math.floor(Number(usxRow?.external_xp_this_session ?? 0)))
                await supabase.from('user_session_xp').upsert(
                  {
                    user_id: userId,
                    session_number: sn,
                    sub_xp_granted: true,
                    external_xp_this_session: prevExternal + SUB_OR_DONATION_XP,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'user_id,session_number' }
                )
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    }

    const userIds = [...new Set((submissions as { user_id: string }[]).map((s) => s.user_id))]
    let movesByUser: Record<string, number> = {}
    if (userIds.length > 0) {
      const { data: usxRows } = await supabase
        .from('user_session_xp')
        .select('user_id, moves_used_this_session')
        .eq('session_number', sn)
        .in('user_id', userIds)
      for (const row of usxRows ?? []) {
        const r = row as { user_id: string; moves_used_this_session?: number }
        movesByUser[r.user_id] = Math.max(0, Math.floor(Number(r.moves_used_this_session ?? 0)))
      }
    }

    const queue = (submissions as { id: string; user_id: string; soundcloud_url: string; song_title?: string; artist_name?: string; created_at: string; users: { display_name: string } }[]).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      soundcloud_url: s.soundcloud_url,
      song_title: s.song_title,
      artist_name: s.artist_name,
      created_at: s.created_at,
      users: s.users,
      moves_used_this_session: movesByUser[s.user_id] ?? 0,
    }))

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Error fetching queue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
