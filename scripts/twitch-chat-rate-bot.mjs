/**
 * Listens to Twitch chat (default: mikegtcoff) and forwards !rate commands to the app API.
 * Also loads TOTM Featured Artist IDs for chat recognition (!totm + VIP badge via Helix elsewhere).
 *
 * Local dev (same machine as Next.js):
 *   1. Put AUDIENCE_RATING_CHAT_SECRET in .env.local (Next reads it too — must match).
 *   2. Optional: APP_URL=http://localhost:3000 (this is the default if unset).
 *   3. Run both:  npm run dev:with-chat-bot
 *      Or two terminals:  npm run dev   then   npm run twitch-chat-bot
 *
 * Production: set APP_URL to your public site; run this process on an always-on host (not Vercel).
 *
 * Run via `npm run twitch-chat-bot` — loads `.env` then `.env.local` from the repo root (same as Next).
 *
 * Required env:
 *   AUDIENCE_RATING_CHAT_SECRET — same as the Next.js /api route
 *   APP_URL or NEXT_PUBLIC_APP_URL — omit locally to use http://localhost:3000
 *
 * Optional:
 *   TWITCH_CHAT_CHANNEL — channel login without # (default: mikegtcoff)
 *   TWITCH_IRC_USERNAME + TWITCH_IRC_OAUTH_TOKEN — followers/subs-only chat (chat:read); needed to reply to !totm
 *   DEBUG_CHAT_RATE=1 — verbose logs
 */

import { config as loadEnv } from 'dotenv'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import tmi from 'tmi.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envLocalPath = join(root, '.env.local')
const envPath = join(root, '.env')
loadEnv({ path: envPath })
loadEnv({ path: envLocalPath, override: true })

const channelRaw = process.env.TWITCH_CHAT_CHANNEL || 'mikegtcoff'
const channel = channelRaw.replace(/^#/, '').toLowerCase()
const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
)
const secret = process.env.AUDIENCE_RATING_CHAT_SECRET?.trim()
const debug = process.env.DEBUG_CHAT_RATE === '1'

if (!secret) {
  console.error('[chat-rate] AUDIENCE_RATING_CHAT_SECRET is missing or empty.')
  console.error('[chat-rate] Add this exact line to .env.local (project root), same value Next.js uses for /api/audience-rating/chat:')
  console.error('[chat-rate]   AUDIENCE_RATING_CHAT_SECRET=your_long_random_secret')
  console.error('[chat-rate] Generate one:  openssl rand -hex 24')
  console.error(`[chat-rate] Files: .env exists=${existsSync(envPath)}  .env.local exists=${existsSync(envLocalPath)}`)
  console.error('[chat-rate] Tip: .env.local must be standard KEY=value lines (Next.js format).')
  console.error('[chat-rate] Avoid a blank line like AUDIENCE_RATING_CHAT_SECRET=  (that counts as empty).')
  process.exit(1)
}

const ircUser = process.env.TWITCH_IRC_USERNAME?.trim()
const ircPassRaw = process.env.TWITCH_IRC_OAUTH_TOKEN?.trim()
const identity =
  ircUser && ircPassRaw
    ? {
        username: ircUser.toLowerCase(),
        password: ircPassRaw.startsWith('oauth:') ? ircPassRaw : `oauth:${ircPassRaw}`,
      }
    : undefined

/** TOTM Featured Artist cache (Twitch user IDs) */
let featuredIds = new Set()
let featuredBadge = '⭐'
let featuredColor = '#CAF76F'
let featuredFetchedAt = 0
const FEATURED_TTL_MS = 5 * 60 * 1000

async function refreshFeaturedArtists() {
  try {
    const res = await fetch(`${baseUrl}/api/totm/featured`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!res.ok) return
    const data = await res.json()
    featuredIds = new Set((data.artists || []).map((a) => String(a.twitch_user_id)))
    if (data.badge) featuredBadge = data.badge
    if (data.color) featuredColor = data.color
    featuredFetchedAt = Date.now()
    if (debug) console.log(`[chat-rate] TOTM featured artists loaded: ${featuredIds.size}`)
  } catch (e) {
    if (debug) console.warn('[chat-rate] featured fetch failed:', e.message || e)
  }
}

function isFeatured(uid) {
  return featuredIds.has(String(uid))
}

const client = new tmi.Client({
  options: {
    debug,
    skipMembership: true,
    skipUpdatingEmotesSets: true,
  },
  connection: { reconnect: true, secure: true },
  identity,
  channels: [channel],
})

client.on('message', async (_channel, tags, message, self) => {
  if (self) return
  const trimmed = (message || '').trim()
  const uid = tags['user-id']

  if (Date.now() - featuredFetchedAt > FEATURED_TTL_MS) {
    refreshFeaturedArtists().catch(() => {})
  }

  if (/^!totm\b/i.test(trimmed)) {
    if (!uid) return
    const featured = isFeatured(uid)
    const name = tags['display-name'] || tags.username || 'user'
    try {
      if (identity) {
        await client.say(
          _channel,
          featured
            ? `${featuredBadge} ${name} is a TOTM Featured Artist (permanent). Chat badge/colour where supported (${featuredColor}).`
            : `@${tags.username} — not a TOTM Featured Artist yet. Enter a monthly Top 10 to earn it.`
        )
      } else if (debug) {
        console.log(`[chat-rate] !totm ${name} featured=${featured}`)
      }
    } catch (e) {
      console.warn('[chat-rate] !totm reply failed:', e.message || e)
    }
    return
  }

  if (!/^!rate\b/i.test(trimmed)) return

  if (!uid) {
    if (debug) console.warn('[chat-rate] missing user-id tags; try TWITCH_IRC_OAUTH_TOKEN + TWITCH_IRC_USERNAME')
    return
  }

  try {
    const res = await fetch(`${baseUrl}/api/audience-rating/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        twitch_user_id: uid,
        twitch_login: tags.username,
        message: trimmed,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('[chat-rate] API', res.status, data.error || JSON.stringify(data))
      return
    }
    const featuredPrefix = isFeatured(uid) ? `${featuredBadge} ` : ''
    if (debug || process.env.NODE_ENV !== 'production') {
      console.log(
        `[chat-rate] ${featuredPrefix}${tags.username} → ${data.score}/10 (${data.vote_count} votes, avg ${data.average ?? '—'})`
      )
    }
  } catch (e) {
    console.error('[chat-rate] fetch failed:', e.message || e)
  }
})

client.on('connected', (addr, port) => {
  console.log(`[chat-rate] IRC ${addr}:${port} — #${channel} → ${baseUrl}`)
})

async function main() {
  console.log(`[chat-rate] POST target: ${baseUrl}/api/audience-rating/chat`)
  await refreshFeaturedArtists()

  const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)
  if (isLocal) {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 5000)
      const res = await fetch(baseUrl, { signal: ac.signal })
      clearTimeout(t)
      if (!res.ok) {
        console.warn(`[chat-rate] Next at ${baseUrl} returned HTTP ${res.status}`)
      } else {
        console.log('[chat-rate] Next.js is reachable.')
      }
    } catch {
      console.warn(
        `[chat-rate] Could not reach ${baseUrl} — start Next in another terminal: npm run dev`
      )
    }
  }

  try {
    await client.connect()
  } catch (e) {
    console.error('[chat-rate] connect failed:', e)
    process.exit(1)
  }
}

main()
