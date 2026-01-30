/**
 * Twitch Helix helpers for mikegtcoff channel (stream status, follow, sub).
 * App token for streams/users; user token for follow/sub checks.
 */

const TWITCH_CHANNEL_LOGIN = 'mikegtcoff'
const HELIX_BASE = 'https://api.twitch.tv/helix'
const OAUTH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'

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

/** mikegtcoff broadcaster user id for Helix calls */
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

/** True when mikegtcoff is currently live */
export async function isMikegtcoffLive(): Promise<boolean> {
  const bid = await getMikegtcoffBroadcasterId()
  const data = await helixGet<{ data: unknown[] }>(`/streams?user_id=${bid}`)
  return Array.isArray(data.data) && data.data.length > 0
}

/** Whether the given Twitch user follows mikegtcoff. Requires user access token (user:read:follows). */
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

/** Whether the given Twitch user is subscribed to mikegtcoff. Requires user access token (user:read:subscriptions). */
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
