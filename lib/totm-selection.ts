/**
 * Pure Top of the Month selection helpers (no DB I/O).
 * Selection uses curator ratings only; audience ratings never affect ranking.
 */

export const TOTM_MIN_REVIEWS = 10
export const TOTM_MAX_ENTRIES = 10
/** Minimum curator average (0–10) to qualify for TOTM — entry floor, not a ceiling. */
export const TOTM_MIN_CURATOR_SCORE = 8.5

export type TotmCandidate = {
  submissionId: string
  userId: string
  twitchUserId: string
  curatorScore: number
  reviewCreatedAt: string
  submissionCreatedAt: string
  artistName: string | null
  songTitle: string | null
  genre: string | null
  audienceScore: number | null
  soundcloudUrl: string
}

/** Compare two candidates for ranking: higher score first; earlier review; earlier submission. */
export function compareTotmCandidates(a: TotmCandidate, b: TotmCandidate): number {
  if (b.curatorScore !== a.curatorScore) return b.curatorScore - a.curatorScore
  const reviewDiff =
    new Date(a.reviewCreatedAt).getTime() - new Date(b.reviewCreatedAt).getTime()
  if (reviewDiff !== 0) return reviewDiff
  return (
    new Date(a.submissionCreatedAt).getTime() - new Date(b.submissionCreatedAt).getTime()
  )
}

/**
 * One track per Twitch user (highest qualifying). Then top N by ranking rules.
 * Only candidates with curatorScore >= TOTM_MIN_CURATOR_SCORE should be passed in.
 */
export function selectTotmTopTracks(
  candidates: TotmCandidate[],
  max = TOTM_MAX_ENTRIES
): TotmCandidate[] {
  const qualifying = candidates.filter((c) => c.curatorScore >= TOTM_MIN_CURATOR_SCORE)
  const bestByArtist = new Map<string, TotmCandidate>()

  for (const c of qualifying) {
    const key = c.twitchUserId
    const existing = bestByArtist.get(key)
    if (!existing || compareTotmCandidates(c, existing) < 0) {
      bestByArtist.set(key, c)
    }
  }

  return Array.from(bestByArtist.values())
    .sort(compareTotmCandidates)
    .slice(0, max)
}

export function calendarMonthKey(date: Date = new Date()): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export function previousCalendarMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export function monthBoundsUtc(
  year: number,
  month: number
): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function formatMonthLabel(year: number, month: number, locale = 'en'): string {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toLocaleString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
