/**
 * SoundCloud availability probe via oEmbed.
 * Only reports "unavailable" on confirmed gone/private responses — never on network/timeouts.
 */

export type SoundCloudAvailability =
  | { status: 'available' }
  | { status: 'unavailable'; reason: string }
  | { status: 'unknown'; reason: string }

const CONFIRMED_UNAVAILABLE_STATUSES = new Set([404, 403, 401, 410])

/** Simulation tracks use this prefix — never treat as unavailable. */
export const TOTM_SIM_URL_PREFIX = 'https://soundcloud.com/totm-sim/'

export async function checkSoundCloudAvailability(
  url: string,
  opts?: { timeoutMs?: number }
): Promise<SoundCloudAvailability> {
  if (url.startsWith(TOTM_SIM_URL_PREFIX)) {
    return { status: 'available' }
  }

  const timeoutMs = opts?.timeoutMs ?? 12_000
  let cleanUrl = url
  try {
    const urlObj = new URL(url)
    const cleanParams = new URLSearchParams()
    const siParam = urlObj.searchParams.get('si')
    if (siParam) cleanParams.set('si', siParam)
    cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${
      cleanParams.toString() ? `?${cleanParams.toString()}` : ''
    }`
  } catch {
    /* keep original */
  }

  const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { html?: string; title?: string } | null
      if (data && (data.html || data.title)) {
        return { status: 'available' }
      }
      // Empty successful body is ambiguous — do not remove
      return { status: 'unknown', reason: 'empty_oembed_body' }
    }

    if (CONFIRMED_UNAVAILABLE_STATUSES.has(res.status)) {
      return {
        status: 'unavailable',
        reason: `oembed_http_${res.status}`,
      }
    }

    // 429 rate limit, 5xx, etc. → unknown (do not remove)
    return { status: 'unknown', reason: `oembed_http_${res.status}` }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'timeout' : e?.message || 'network_error'
    return { status: 'unknown', reason: msg }
  } finally {
    clearTimeout(timer)
  }
}
