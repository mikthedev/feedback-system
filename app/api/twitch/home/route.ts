import { NextResponse } from 'next/server'
import {
  TWITCH_CHANNEL_LOGIN,
  getMikegtcoffFeedbackSessionVods,
  getMikegtcoffStream,
} from '@/lib/twitch'

/**
 * GET — Public home payload: live stream (if any) + Feedback Session VODs.
 */
export async function GET() {
  try {
    let live = null
    let vods: Awaited<ReturnType<typeof getMikegtcoffFeedbackSessionVods>> = []

    try {
      live = await getMikegtcoffStream()
    } catch (e) {
      console.warn('GET /api/twitch/home stream:', e)
    }

    try {
      vods = await getMikegtcoffFeedbackSessionVods(12)
    } catch (e) {
      console.warn('GET /api/twitch/home vods:', e)
    }

    return NextResponse.json(
      {
        channel: TWITCH_CHANNEL_LOGIN,
        live,
        vods,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (e) {
    console.error('GET /api/twitch/home error:', e)
    return NextResponse.json(
      { channel: TWITCH_CHANNEL_LOGIN, live: null, vods: [], error: 'Failed to load Twitch data' },
      { status: 500 }
    )
  }
}
