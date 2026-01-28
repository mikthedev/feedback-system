import { z } from 'zod'

// SoundCloud URL validation - matches various SoundCloud URL formats
// Supports:
// - https://soundcloud.com/username/track-name
// - https://soundcloud.com/username/track-name/s-SHAREID
// - https://soundcloud.com/username/track-name/s-SHAREID?query-params
// - https://on.soundcloud.com/SHAREID (secondary option - share links)
// - URLs without https:// prefix (will be normalized)
const SOUNDCLOUD_URL_REGEX = /^https:\/\/((www\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(\/s-[a-zA-Z0-9_-]+)?(\?.*)?|on\.soundcloud\.com\/[a-zA-Z0-9]+(\?.*)?)$/

// Normalize URL - add https:// if missing
export function normalizeSoundCloudUrl(url: string): string {
  const trimmed = url.trim()
  // If it doesn't start with http:// or https://, add https://
  if (!trimmed.match(/^https?:\/\//i)) {
    // If it starts with soundcloud.com or on.soundcloud.com, add https://
    if (trimmed.match(/^(www\.)?soundcloud\.com\//i) || trimmed.match(/^on\.soundcloud\.com\//i)) {
      return `https://${trimmed}`
    }
  }
  return trimmed
}

export const soundcloudUrlSchema = z.string().transform(normalizeSoundCloudUrl).pipe(
  z.string().url().refine(
    (url) => SOUNDCLOUD_URL_REGEX.test(url),
    {
      message: "URL must be a valid SoundCloud track URL (https://soundcloud.com/username/track-name or https://on.soundcloud.com/SHAREID)"
    }
  )
)

export function validateSoundCloudUrl(url: string): boolean {
  try {
    soundcloudUrlSchema.parse(url)
    return true
  } catch {
    return false
  }
}

// Extract SoundCloud track URL for embedding (removes query params, fragments, but keeps share IDs for private tracks)
export function getSoundCloudEmbedUrl(trackUrl: string): string {
  if (!trackUrl || (!trackUrl.includes('soundcloud.com') && !trackUrl.includes('on.soundcloud.com'))) return ''
  
  try {
    // Parse URL and keep the path with share ID (for private tracks)
    // but remove query parameters and fragments
    const url = new URL(trackUrl)
    // Keep the full pathname (including /s-xxxxx for private tracks)
    const path = url.pathname
    // Reconstruct URL without query params or fragments
    const cleanUrl = `${url.protocol}//${url.host}${path}`
    
    // Create embed URL
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  } catch (error) {
    // Fallback: clean manually - remove query params and fragments but keep share ID
    let cleaned = trackUrl.trim().split('?')[0].split('#')[0]
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleaned)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }
}

// Review scores validation (0-10, step 0.5)
export const reviewScoreSchema = z.number()
  .min(0)
  .max(10)
  .step(0.5)

export const reviewSchema = z.object({
  submission_id: z.string().uuid(),
  sound_score: reviewScoreSchema,
  structure_score: reviewScoreSchema,
  mix_score: reviewScoreSchema,
  vibe_score: reviewScoreSchema,
})
