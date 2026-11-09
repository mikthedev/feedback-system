/**
 * Optional Twitch VIP grant for TOTM Featured Artists (special chat badge).
 *
 * Requires TWITCH_BROADCASTER_OAUTH_TOKEN (or TWITCH_VIP_OAUTH_TOKEN) with
 * scope channel:manage:vips for the mikegtcoff broadcaster (or a moderator).
 * If unset, recognition is still stored in DB; VIP grant is skipped.
 */

import { getMikegtcoffBroadcasterId } from '@/lib/twitch'

const HELIX_BASE = 'https://api.twitch.tv/helix'

function vipToken(): string | null {
  return (
    process.env.TWITCH_VIP_OAUTH_TOKEN?.trim() ||
    process.env.TWITCH_BROADCASTER_OAUTH_TOKEN?.trim() ||
    null
  )
}

export async function grantTwitchVipIfConfigured(
  twitchUserId: string
): Promise<{ granted: boolean; skipped?: boolean; reason?: string }> {
  const token = vipToken()
  const clientId = process.env.TWITCH_CLIENT_ID
  if (!token || !clientId) {
    return {
      granted: false,
      skipped: true,
      reason: 'TWITCH_VIP_OAUTH_TOKEN / TWITCH_BROADCASTER_OAUTH_TOKEN not configured',
    }
  }

  try {
    const broadcasterId = await getMikegtcoffBroadcasterId()
    const url = `${HELIX_BASE}/channels/vips?broadcaster_id=${encodeURIComponent(
      broadcasterId
    )}&user_id=${encodeURIComponent(twitchUserId)}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
    })

    // 204 success; 422 often means already VIP
    if (res.status === 204 || res.status === 200 || res.status === 422) {
      return { granted: true }
    }

    const body = await res.text()
    console.warn('Twitch VIP grant failed:', res.status, body)
    return { granted: false, reason: `helix_${res.status}` }
  } catch (e: any) {
    console.warn('Twitch VIP grant error:', e?.message || e)
    return { granted: false, reason: e?.message || 'error' }
  }
}

/** Distinctive chat colour used by the app / chat bot for Featured Artists (where supported). */
export const TOTM_FEATURED_CHAT_COLOR = '#CAF76F'
export const TOTM_FEATURED_CHAT_BADGE = '⭐'
