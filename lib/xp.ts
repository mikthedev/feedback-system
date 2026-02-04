/**
 * XP constants, get/add helpers, queue movement, and rating→XP brackets.
 * All XP logic is tied to the mikegtcoff Twitch channel.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const XP_PER_POSITION = 100
export const MAX_MOVE_PER_SESSION = 3
/** Max XP usable for queue moves per session (3 moves × 100). */
export const MAX_XP_USABLE_PER_SESSION = 300

/** +5 XP per 5 minutes when mikegtcoff is live and submissions open */
export const TIME_XP_PER_TICK = 5
export const TIME_TICK_MINUTES = 5

export const CARRYOVER_XP = 25
export const FOLLOW_XP = 10
export const SUB_OR_DONATION_XP = 20

/** Mean of sound, structure, mix, vibe (0–10). */
export function curatorAverage(
  sound: number,
  structure: number,
  mix: number,
  vibe: number
): number {
  return (sound + structure + mix + vibe) / 4
}

/** Curator average → XP: 9–10 → 60, 8–8.9 → 40, 7–7.9 → 25, 6–6.9 → 10, <6 → 0 */
export function curatorXpFromAverage(avg: number): number {
  if (avg >= 9) return 60
  if (avg >= 8) return 40
  if (avg >= 7) return 25
  if (avg >= 6) return 10
  return 0
}

/** Audience score (0–10) → XP: 8–10 → 20, 6–7.9 → 10, <6 → 0 */
export function audienceXpFromScore(score: number): number {
  if (score >= 8) return 20
  if (score >= 6) return 10
  return 0
}

/** Increment user XP. Returns new total. */
export async function addXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<number> {
  if (amount <= 0) {
    return getXp(supabase, userId)
  }
  const current = await getXp(supabase, userId)
  const next = current + amount
  const { error } = await supabase.from('users').update({ xp: next }).eq('id', userId)
  if (error) throw error
  return next
}

/** Log an XP event for the user's history (does not grant XP). */
export async function logXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  source: string,
  description?: string
): Promise<void> {
  if (amount === 0) return
  await supabase.from('xp_log').insert({
    user_id: userId,
    amount,
    source,
    description: description ?? null,
  })
}

/** Get current user XP (or 0). */
export async function getXp(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase.from('users').select('xp').eq('id', userId).single()
  if (error && error.code !== 'PGRST116') throw error
  return ((data as { xp?: number } | null)?.xp ?? 0) as number
}

/** Deduct user XP (for queue moves). Clamps to 0. Returns new total. */
export async function deductXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<number> {
  if (amount <= 0) return getXp(supabase, userId)
  const current = await getXp(supabase, userId)
  const next = Math.max(0, current - amount)
  const { error } = await supabase.from('users').update({ xp: next }).eq('id', userId)
  if (error) throw error
  return next
}

/** Input item for queue movement. */
export interface QueueItem {
  id: string
  user_id: string
  created_at: string
  user_xp: number
  moves_used_this_session: number
  presence_minutes: number
}

/** Optional overrides for applyQueueMovement (e.g. tester: no session move cap). */
export interface ApplyQueueMovementOptions {
  /** Per-user cap on moves this session; if set, overrides MAX_MOVE_PER_SESSION for that user. */
  maxMovesPerUser?: Record<string, number>
}

/**
 * Apply XP-based upward movement to a list ordered by created_at.
 * Step-by-step, one position at a time; max MAX_MOVE_PER_SESSION per user (or maxMovesPerUser override);
 * never move down; respect XP gap (can't pass someone with ≥100 more XP).
 * Tie-break when |Δxp| < 100 using presence (higher may swap above).
 * Returns ordered list and per-user move deltas (to persist moves_used_this_session).
 */
export function applyQueueMovement(
  items: QueueItem[],
  options?: ApplyQueueMovementOptions
): {
  ordered: QueueItem[]
  movesDelta: Record<string, number>
} {
  const movesDelta: Record<string, number> = {}
  let list = items.slice()
  const movesUsed: Record<string, number> = {}
  for (const it of items) {
    movesUsed[it.user_id] = it.moves_used_this_session
  }

  const potentialMoves = (u: QueueItem) => {
    const cap = options?.maxMovesPerUser?.[u.user_id]
    if (cap !== undefined) return Math.min(cap, Math.floor(u.user_xp / XP_PER_POSITION))
    return Math.min(MAX_MOVE_PER_SESSION, Math.floor(u.user_xp / XP_PER_POSITION))
  }
  const canMove = (u: QueueItem) => (movesUsed[u.user_id] ?? 0) < potentialMoves(u)
  const xpGapOk = (above: QueueItem, below: QueueItem) =>
    (above.user_xp - below.user_xp) < XP_PER_POSITION
  const tieBreak = (above: QueueItem, below: QueueItem) =>
    (below.presence_minutes ?? 0) > (above.presence_minutes ?? 0)

  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < list.length - 1; i++) {
      const above = list[i]
      const below = list[i + 1]
      if (!canMove(below)) continue
      if (!xpGapOk(above, below)) continue
      const gapSmall = Math.abs(above.user_xp - below.user_xp) < XP_PER_POSITION
      if (gapSmall && !tieBreak(above, below)) continue
      const uid = below.user_id
      list[i] = below
      list[i + 1] = above
      movesUsed[uid] = (movesUsed[uid] ?? 0) + 1
      movesDelta[uid] = (movesDelta[uid] ?? 0) + 1
      changed = true
      break
    }
  }

  return { ordered: list, movesDelta }
}
