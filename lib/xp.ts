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

/**
 * Single-swap "Use XP" validation.
 * Use XP = spend 100 XP to move up exactly ONE position (swap with immediate neighbor above).
 * Queue movement happens ONLY when user explicitly triggers it; no automatic reordering.
 */
export interface ValidateUseXpInput {
  /** Ordered queue items (by queue_position, created_at). At least id and user_id. */
  items: Array<{ id: string; user_id: string }>
  userId: string
  userXp: number
  movesUsedThisSession: number
  isTester: boolean
  submissionsOpen: boolean
  /** XP of the user whose submission is directly above the current user's (required if not first). */
  aboveUserXp: number | null
}

export type ValidateUseXpResult =
  | { allowed: false; reason: string }
  | {
      allowed: true
      myIndex: number
      mySubmissionId: string
      aboveSubmissionId: string
    }

/**
 * Validates whether "Use XP" is allowed (single move: spend 100 XP, move up one position).
 * Does NOT perform any state change. Caller must then swap the two submissions, deduct XP, and log.
 */
export function validateUseXp(input: ValidateUseXpInput): ValidateUseXpResult {
  const {
    items,
    userId,
    userXp,
    movesUsedThisSession,
    isTester,
    submissionsOpen,
    aboveUserXp,
  } = input

  if (!submissionsOpen) {
    return { allowed: false, reason: 'Submissions are closed.' }
  }

  if (items.length === 0) {
    return { allowed: false, reason: 'Queue is empty.' }
  }

  const myIndex = items.findIndex((i) => i.user_id === userId)
  if (myIndex === -1) {
    return { allowed: false, reason: "You don't have a submission in the queue." }
  }

  if (myIndex === 0) {
    return { allowed: false, reason: "You're already first in the queue." }
  }

  // First in queue is receiving feedback; second cannot move up into that slot (no XP is used)
  if (myIndex === 1) {
    return {
      allowed: false,
      reason: "The first in queue is receiving feedback. You can't move higher right now. No XP was used.",
    }
  }

  if (userXp < XP_PER_POSITION) {
    return { allowed: false, reason: 'Not enough XP (need 100).' }
  }

  // Only tester role can move without limit; others are capped at MAX_MOVE_PER_SESSION
  const moveCap = isTester ? 999 : MAX_MOVE_PER_SESSION
  if (movesUsedThisSession >= moveCap) {
    return {
      allowed: false,
      reason:
        moveCap === 999
          ? 'Session move limit reached.'
          : `Max moves this session (${MAX_MOVE_PER_SESSION}) reached.`,
    }
  }

  if (aboveUserXp != null && aboveUserXp >= userXp + XP_PER_POSITION) {
    return {
      allowed: false,
      reason:
        "Can't move up: the person above has 100+ more XP than you. You need more XP to overtake them.",
    }
  }

  const mySubmissionId = items[myIndex]!.id
  const aboveSubmissionId = items[myIndex - 1]!.id
  return {
    allowed: true,
    myIndex,
    mySubmissionId,
    aboveSubmissionId,
  }
}
