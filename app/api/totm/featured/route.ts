import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TOTM_FEATURED_CHAT_BADGE, TOTM_FEATURED_CHAT_COLOR } from '@/lib/twitch-vip'

/**
 * GET — Featured Artist Twitch IDs for chat bot / overlays.
 * Protected by AUDIENCE_RATING_CHAT_SECRET (same as chat rating bot) or CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    const chatSecret = process.env.AUDIENCE_RATING_CHAT_SECRET?.trim()
    const cronSecret = process.env.CRON_SECRET?.trim()
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    const ok =
      (chatSecret && token === chatSecret) ||
      (cronSecret && token === cronSecret) ||
      request.headers.get('x-cron-secret') === cronSecret

    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('totm_featured_artists')
      .select('twitch_user_id, user_id, awarded_at')

    if (error) throw error

    return NextResponse.json({
      badge: TOTM_FEATURED_CHAT_BADGE,
      color: TOTM_FEATURED_CHAT_COLOR,
      artists: (data ?? []).map((r: any) => ({
        twitch_user_id: r.twitch_user_id,
        user_id: r.user_id,
        awarded_at: r.awarded_at,
      })),
    })
  } catch (error) {
    console.error('GET /api/totm/featured error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
