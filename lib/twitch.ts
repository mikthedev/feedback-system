/**
 * Twitch Helix helpers for mikegtc channel (stream status, follow, sub, VODs).
 * App token for streams/users/videos; user token for follow/sub checks.
 */

export const TWITCH_CHANNEL_LOGIN = 'mikegtc'
export const TWITCH_CHANNEL_URL = `https://www.twitch.tv/${TWITCH_CHANNEL_LOGIN}`
const HELIX_BASE = 'https://api.twitch.tv/helix'
const OAUTH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const FEEDBACK_SESSION_TITLE = 'feedback session'

let appTokenCache: { token: string; expiresAt: number } | null = null
let broadcasterIdCache: string | null = null

async function getAppAccessToken(): Promise<string> {
  const now = Date.now()
  if (appTokenCache && appTokenCache.expiresAt > now + 60_000) {
    return appTokenCache.token
  }
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Twitch app token failed: ${res.status} ${t}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  appTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return appTokenCache.token
}

async function helixGet<T>(
  path: string,
  opts: { appToken?: boolean; userToken?: string } = {}
): Promise<T> {
  const token = opts.userToken ?? (opts.appToken !== false ? await getAppAccessToken() : null)
  if (!token) throw new Error('No Twitch token available')
  const url = path.startsWith('http') ? path : `${HELIX_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Twitch Helix ${path}: ${res.status} ${t}`)
  }
  return res.json() as Promise<T>
}

/** mikegtc broadcaster user id for Helix calls */
export async function getMikegtcoffBroadcasterId(): Promise<string> {
  if (broadcasterIdCache) return broadcasterIdCache
  const data = await helixGet<{ data: { id: string }[] }>(
    `/users?login=${encodeURIComponent(TWITCH_CHANNEL_LOGIN)}`
  )
  const user = data.data?.[0]
  if (!user) throw new Error(`Twitch user not found: ${TWITCH_CHANNEL_LOGIN}`)
  broadcasterIdCache = user.id
  return broadcasterIdCache
}

export type MikegtcoffStream = {
  id: string
  title: string
  viewer_count: number
  started_at: string
  thumbnail_url: string
  game_name: string
}

export type MikegtcoffVod = {
  id: string
  title: string
  url: string
  thumbnail_url: string
  duration: string
  view_count: number
  published_at: string
}

/** True when mikegtc is currently live */
export async function isMikegtcoffLive(): Promise<boolean> {
  const stream = await getMikegtcoffStream()
  return stream !== null
}

/** Current mikegtc stream, or null when offline */
export async function getMikegtcoffStream(): Promise<MikegtcoffStream | null> {
  const bid = await getMikegtcoffBroadcasterId()
  const data = await helixGet<{
    data: Array<{
      id: string
      title: string
      viewer_count: number
      started_at: string
      thumbnail_url: string
      game_name?: string
    }>
  }>(`/streams?user_id=${bid}`)
  const stream = data.data?.[0]
  if (!stream) return null
  return {
    id: stream.id,
    title: stream.title ?? '',
    viewer_count: stream.viewer_count ?? 0,
    started_at: stream.started_at ?? '',
    thumbnail_url: stream.thumbnail_url ?? '',
    game_name: stream.game_name ?? '',
  }
}

function normalizeTwitchThumbnail(url: string, width = 640, height = 360): string {
  return url
    .replace(/%?\{width\}/gi, String(width))
    .replace(/%?\{height\}/gi, String(height))
}

/**
 * Archive VODs from mikegtc whose titles include "Feedback Session".
 * Uses Helix videos (type=archive) with an app access token.
 */
export async function getMikegtcoffFeedbackSessionVods(
  limit = 12
): Promise<MikegtcoffVod[]> {
  const bid = await getMikegtcoffBroadcasterId()
  const pageSize = Math.min(Math.max(limit * 3, 20), 100)
  const data = await helixGet<{
    data: Array<{
      id: string
      title: string
      url: string
      thumbnail_url: string
      duration: string
      view_count: number
      published_at: string
      type?: string
    }>
  }>(`/videos?user_id=${bid}&type=archive&first=${pageSize}`)

  const matches = (data.data ?? [])
    .filter((v) => (v.title ?? '').toLowerCase().includes(FEEDBACK_SESSION_TITLE))
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      title: v.title ?? '',
      url: v.url ?? `https://www.twitch.tv/videos/${v.id}`,
      thumbnail_url: normalizeTwitchThumbnail(v.thumbnail_url ?? ''),
      duration: v.duration ?? '',
      view_count: v.view_count ?? 0,
      published_at: v.published_at ?? '',
    }))

  return matches
}

/** Whether the given Twitch user follows mikegtc. Requires user access token (user:read:follows). */
export async function userFollowsMikegtcoff(
  twitchUserId: string,
  userAccessToken: string
): Promise<boolean> {
  const bid = await getMikegtcoffBroadcasterId()
  const data = await helixGet<{ data: { broadcaster_id: string }[] }>(
    `/channels/followed?user_id=${encodeURIComponent(twitchUserId)}`,
    { appToken: false, userToken: userAccessToken }
  )
  const list = data.data ?? []
  return list.some((f) => f.broadcaster_id === bid)
}

/** Whether the given Twitch user is subscribed to mikegtc. Requires user access token (user:read:subscriptions). */
export async function userSubscribedToMikegtcoff(
  twitchUserId: string,
  userAccessToken: string
): Promise<boolean> {
  const bid = await getMikegtcoffBroadcasterId()
  const data = await helixGet<{ data: unknown[] }>(
    `/subscriptions/user?user_id=${encodeURIComponent(twitchUserId)}&broadcaster_id=${bid}`,
    { appToken: false, userToken: userAccessToken }
  )
  return Array.isArray(data.data) && data.data.length > 0
}
