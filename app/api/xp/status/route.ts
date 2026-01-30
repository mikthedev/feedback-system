import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp } from '@/lib/xp'
import { FOLLOW_XP } from '@/lib/xp'
import { isMikegtcoffLive, userFollowsMikegtcoff } from '@/lib/twitch'
import { cookies } from 'next/headers'

/**
 * GET - XP-related live status: time_xp_active, following_mikegtcoff.
 * 401 if not logged in.
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

    const submissionsOpen = config?.submissions_open ?? true
    let live = false
    try {
      live = await isMikegtcoffLive()
    } catch {
      /* ignore */
    }

    const time_xp_active = live && submissionsOpen

    let following_mikegtcoff: boolean | null = null
    const { data: user } = await supabase
      .from('users')
      .select('twitch_id, follow_bonus_granted')
      .eq('id', userId)
      .single()

    const u = user as { twitch_id?: string; follow_bonus_granted?: boolean } | null
    const twitchId = u?.twitch_id
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
            following_mikegtcoff = await userFollowsMikegtcoff(twitchId, t.access_token)
            if (following_mikegtcoff && !u?.follow_bonus_granted) {
              await addXp(supabase, userId, FOLLOW_XP)
              await supabase
                .from('users')
                .update({ follow_bonus_granted: true })
                .eq('id', userId)
            }
          } catch {
            /* leave null */
          }
        }
      }
    }

    return NextResponse.json({ time_xp_active, following_mikegtcoff })
  } catch (e) {
    console.error('GET /api/xp/status error:', e)
    return NextResponse.json(
      { time_xp_active: false, following_mikegtcoff: null },
      { status: 200 }
    )
  }
}
