import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp, logXp } from '@/lib/xp'
import { FOLLOW_XP } from '@/lib/xp'
import { isMikegtcoffLive, userFollowsMikegtcoff } from '@/lib/twitch'
import { cookies } from 'next/headers'

/** Refresh Twitch user access token. Returns new access_token or null. */
async function refreshTwitchToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.access_token) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : 0,
  }
}

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
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single()

      const t = tok as { access_token?: string; refresh_token?: string; expires_at?: string } | null
      let accessToken = t?.access_token
      let refreshToken = t?.refresh_token
      const exp = t?.expires_at ? new Date(t.expires_at).getTime() : 0
      const now = Date.now()
      const isExpired = exp <= now + 60_000

      // Refresh token if expired and we have a valid refresh_token
      if (isExpired && refreshToken && refreshToken.trim()) {
        const refreshed = await refreshTwitchToken(refreshToken)
        if (refreshed) {
          const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString()
          await supabase
            .from('user_tokens')
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
          accessToken = refreshed.access_token
        }
      }

      if (accessToken) {
        try {
          following_mikegtcoff = await userFollowsMikegtcoff(twitchId, accessToken)
          if (following_mikegtcoff && !u?.follow_bonus_granted) {
            await addXp(supabase, userId, FOLLOW_XP)
            await logXp(supabase, userId, FOLLOW_XP, 'follow', 'Follow MikeGTC +10 XP')
            await supabase
              .from('users')
              .update({ follow_bonus_granted: true })
              .eq('id', userId)
          }
        } catch {
          // Fallback: if user already received follow bonus, assume they are following
          if (u?.follow_bonus_granted) {
            following_mikegtcoff = true
          }
        }
      } else if (u?.follow_bonus_granted) {
        // No token but user got follow bonus → assume following
        following_mikegtcoff = true
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
