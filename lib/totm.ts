/**
 * Top of the Month (TOTM) — selection sync, Featured Artist, queue skips, finalisation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { curatorAverage } from '@/lib/xp'
import {
  TOTM_MIN_REVIEWS,
  TOTM_MAX_ENTRIES,
  TOTM_MIN_CURATOR_SCORE,
  selectTotmTopTracks,
  calendarMonthKey,
  previousCalendarMonth,
  monthBoundsUtc,
  formatMonthLabel,
  type TotmCandidate,
} from '@/lib/totm-selection'
import {
  sendTotmFeaturedArtistEmail,
  sendTotmQueueSkipEmail,
  sendTotmTrackUnavailableEmail,
} from '@/lib/totm-email'
import { grantTwitchVipIfConfigured } from '@/lib/twitch-vip'
import {
  checkSoundCloudAvailability,
  TOTM_SIM_URL_PREFIX,
} from '@/lib/soundcloud-availability'

export {
  TOTM_MIN_REVIEWS,
  TOTM_MAX_ENTRIES,
  TOTM_MIN_CURATOR_SCORE,
  selectTotmTopTracks,
  calendarMonthKey,
  previousCalendarMonth,
  monthBoundsUtc,
  formatMonthLabel,
}

type MonthRow = {
  id: string
  year: number
  month: number
  status: 'collecting' | 'active' | 'finalized'
  review_count: number
  finalized_at: string | null
}

async function ensureMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<MonthRow> {
  const { data: existing } = await supabase
    .from('totm_months')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) return existing as MonthRow

  const { data: created, error } = await supabase
    .from('totm_months')
    .insert({ year, month, status: 'collecting', review_count: 0 })
    .select('*')
    .single()

  if (error) {
    // Race: another request inserted first
    const { data: again } = await supabase
      .from('totm_months')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .single()
    if (again) return again as MonthRow
    throw error
  }
  return created as MonthRow
}

async function loadMonthCandidates(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<{ reviewCount: number; candidates: TotmCandidate[] }> {
  const { startIso, endIso } = monthBoundsUtc(year, month)

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(
      `
      id,
      created_at,
      sound_score,
      structure_score,
      mix_score,
      vibe_score,
      submission_id,
      submissions!inner (
        id,
        user_id,
        created_at,
        artist_name,
        song_title,
        genre,
        soundcloud_url,
        audience_score,
        status,
        users!submissions_user_id_fkey (
          id,
          twitch_id,
          display_name,
          email
        )
      )
    `
    )
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = reviews ?? []
  const reviewCount = rows.length
  const candidates: TotmCandidate[] = []

  for (const row of rows as any[]) {
    const sub = row.submissions
    if (!sub || sub.status !== 'reviewed') continue
    const user = Array.isArray(sub.users) ? sub.users[0] : sub.users
    if (!user?.twitch_id) continue

    const score = curatorAverage(
      Number(row.sound_score),
      Number(row.structure_score),
      Number(row.mix_score),
      Number(row.vibe_score)
    )
    // Round to 1 decimal to match DECIMAL(3,1) storage
    const curatorScore = Math.round(score * 10) / 10

    candidates.push({
      submissionId: sub.id,
      userId: sub.user_id,
      twitchUserId: String(user.twitch_id),
      curatorScore,
      reviewCreatedAt: row.created_at,
      submissionCreatedAt: sub.created_at,
      artistName: sub.artist_name ?? user.display_name ?? null,
      songTitle: sub.song_title ?? null,
      genre: sub.genre ?? null,
      audienceScore:
        sub.audience_score != null ? Number(sub.audience_score) : null,
      soundcloudUrl: sub.soundcloud_url,
    })
  }

  return { reviewCount, candidates }
}

/**
 * Recompute the live Top 10 for a calendar month after a review.
 * Grants Featured Artist on first entry (idempotent). Does not grant queue skips.
 */
export async function syncTotmMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<{ status: string; entryCount: number; newlyFeatured: string[] }> {
  const monthRow = await ensureMonth(supabase, year, month)

  // Never mutate a finalized month
  if (monthRow.status === 'finalized') {
    return { status: 'finalized', entryCount: 0, newlyFeatured: [] }
  }

  const { reviewCount, candidates } = await loadMonthCandidates(supabase, year, month)
  const selected =
    reviewCount >= TOTM_MIN_REVIEWS
      ? selectTotmTopTracks(candidates, TOTM_MAX_ENTRIES)
      : []

  const nextStatus = reviewCount >= TOTM_MIN_REVIEWS ? 'active' : 'collecting'

  await supabase
    .from('totm_months')
    .update({
      review_count: reviewCount,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', monthRow.id)

  // Preserve SoundCloud removal flags for submissions still selected
  const { data: existingEntries } = await supabase
    .from('totm_entries')
    .select(
      'submission_id, removed_from_active, removed_from_active_at, soundcloud_unavailable'
    )
    .eq('totm_month_id', monthRow.id)

  const removalBySubmission = new Map<
    string,
    {
      removed_from_active: boolean
      removed_from_active_at: string | null
      soundcloud_unavailable: boolean
    }
  >()
  for (const e of existingEntries ?? []) {
    const row = e as {
      submission_id: string
      removed_from_active: boolean
      removed_from_active_at: string | null
      soundcloud_unavailable: boolean
    }
    removalBySubmission.set(row.submission_id, {
      removed_from_active: row.removed_from_active,
      removed_from_active_at: row.removed_from_active_at,
      soundcloud_unavailable: row.soundcloud_unavailable,
    })
  }

  // Rebuild entries for the active month (replacement when outranked)
  await supabase.from('totm_entries').delete().eq('totm_month_id', monthRow.id)

  const newlyFeatured: string[] = []

  if (selected.length > 0) {
    const inserts = selected.map((c, i) => {
      const prev = removalBySubmission.get(c.submissionId)
      return {
        totm_month_id: monthRow.id,
        submission_id: c.submissionId,
        user_id: c.userId,
        twitch_user_id: c.twitchUserId,
        artist_name: c.artistName,
        song_title: c.songTitle,
        genre: c.genre,
        soundcloud_url: c.soundcloudUrl,
        audience_score: c.audienceScore,
        curator_score: c.curatorScore,
        rank: i + 1,
        review_created_at: c.reviewCreatedAt,
        submission_created_at: c.submissionCreatedAt,
        removed_from_active: prev?.removed_from_active ?? false,
        removed_from_active_at: prev?.removed_from_active_at ?? null,
        soundcloud_unavailable: prev?.soundcloud_unavailable ?? false,
      }
    })

    const { error: insertErr } = await supabase.from('totm_entries').insert(inserts)
    if (insertErr) throw insertErr

    for (const c of selected) {
      const awarded = await grantFeaturedArtistIfNew(supabase, {
        twitchUserId: c.twitchUserId,
        userId: c.userId,
        totmMonthId: monthRow.id,
        submissionId: c.submissionId,
        year,
        month,
      })
      if (awarded) newlyFeatured.push(c.twitchUserId)
    }
  }

  return { status: nextStatus, entryCount: selected.length, newlyFeatured }
}

async function grantFeaturedArtistIfNew(
  supabase: SupabaseClient,
  opts: {
    twitchUserId: string
    userId: string
    totmMonthId: string
    submissionId: string
    year: number
    month: number
  }
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('totm_featured_artists')
    .select('twitch_user_id, featured_email_sent_at, twitch_vip_granted_at')
    .eq('twitch_user_id', opts.twitchUserId)
    .maybeSingle()

  if (existing) return false

  const { error } = await supabase.from('totm_featured_artists').insert({
    twitch_user_id: opts.twitchUserId,
    user_id: opts.userId,
    first_totm_month_id: opts.totmMonthId,
    first_submission_id: opts.submissionId,
    awarded_at: new Date().toISOString(),
  })

  if (error) {
    // Unique violation = already granted by concurrent request
    if ((error as { code?: string }).code === '23505') return false
    throw error
  }

  // One-time email + VIP (best-effort; recognition already persisted)
  const { data: user } = await supabase
    .from('users')
    .select('display_name, email')
    .eq('id', opts.userId)
    .single()

  const email = (user as { email?: string | null } | null)?.email
  const displayName =
    (user as { display_name?: string } | null)?.display_name || 'Artist'

  if (email) {
    const sent = await sendTotmFeaturedArtistEmail(email, displayName, {
      year: opts.year,
      month: opts.month,
    })
    if (sent.success) {
      await supabase
        .from('totm_featured_artists')
        .update({ featured_email_sent_at: new Date().toISOString() })
        .eq('twitch_user_id', opts.twitchUserId)
    }
  }

  const vip = await grantTwitchVipIfConfigured(opts.twitchUserId)
  if (vip.granted) {
    await supabase
      .from('totm_featured_artists')
      .update({ twitch_vip_granted_at: new Date().toISOString() })
      .eq('twitch_user_id', opts.twitchUserId)
  }

  return true
}

/**
 * Finalise a calendar month: freeze Top 10, grant queue skips to remaining artists.
 * Idempotent — safe to run more than once.
 */
export async function finalizeTotmMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<{
  alreadyFinalized: boolean
  skipsGranted: number
  status: string
}> {
  const monthRow = await ensureMonth(supabase, year, month)

  const { data: existingLog } = await supabase
    .from('totm_finalization_log')
    .select('totm_month_id, skips_granted')
    .eq('totm_month_id', monthRow.id)
    .maybeSingle()

  if (existingLog || monthRow.status === 'finalized') {
    return {
      alreadyFinalized: true,
      skipsGranted: (existingLog as { skips_granted?: number } | null)?.skips_granted ?? 0,
      status: 'finalized',
    }
  }

  // Final sync so ranking is current before freeze
  await syncTotmMonth(supabase, year, month)

  const { data: refreshed } = await supabase
    .from('totm_months')
    .select('*')
    .eq('id', monthRow.id)
    .single()

  const current = (refreshed ?? monthRow) as MonthRow

  // Fewer than 10 reviews → no selection, still mark finalized to prevent re-runs
  if (current.status !== 'active' && current.review_count < TOTM_MIN_REVIEWS) {
    await supabase
      .from('totm_months')
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', monthRow.id)

    await supabase.from('totm_finalization_log').upsert(
      {
        totm_month_id: monthRow.id,
        finalized_at: new Date().toISOString(),
        skips_granted: 0,
        featured_preserved: 0,
      },
      { onConflict: 'totm_month_id' }
    )

    return { alreadyFinalized: false, skipsGranted: 0, status: 'finalized' }
  }

  // Eligible = still in Top 10 and not removed from active for SoundCloud unavailability
  const { data: entries } = await supabase
    .from('totm_entries')
    .select('*')
    .eq('totm_month_id', monthRow.id)
    .eq('removed_from_active', false)
    .order('rank', { ascending: true })

  let skipsGranted = 0
  const featuredPreserved = (entries ?? []).length

  for (const entry of entries ?? []) {
    const e = entry as {
      user_id: string
      twitch_user_id: string
      artist_name: string | null
      song_title: string | null
    }

    const { data: skipRow, error: skipErr } = await supabase
      .from('totm_queue_skips')
      .insert({
        user_id: e.user_id,
        twitch_user_id: e.twitch_user_id,
        totm_month_id: monthRow.id,
        earned_year: year,
        earned_month: month,
        status: 'available',
      })
      .select('*')
      .single()

    if (skipErr) {
      if ((skipErr as { code?: string }).code === '23505') continue
      throw skipErr
    }

    skipsGranted += 1

    const { data: user } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', e.user_id)
      .single()

    const email = (user as { email?: string | null } | null)?.email
    const displayName =
      (user as { display_name?: string } | null)?.display_name ||
      e.artist_name ||
      'Artist'

    if (email && skipRow) {
      const sent = await sendTotmQueueSkipEmail(email, displayName, {
        year,
        month,
        trackTitle: e.song_title,
      })
      if (sent.success) {
        await supabase
          .from('totm_queue_skips')
          .update({ reward_email_sent_at: new Date().toISOString() })
          .eq('id', (skipRow as { id: string }).id)
      }
    }
  }

  await supabase
    .from('totm_months')
    .update({
      status: 'finalized',
      finalized_at: new Date().toISOString(),
    })
    .eq('id', monthRow.id)

  await supabase.from('totm_finalization_log').upsert(
    {
      totm_month_id: monthRow.id,
      finalized_at: new Date().toISOString(),
      skips_granted: skipsGranted,
      featured_preserved: featuredPreserved,
    },
    { onConflict: 'totm_month_id' }
  )

  return { alreadyFinalized: false, skipsGranted, status: 'finalized' }
}

/** Finalise previous calendar month and ensure current month row exists. */
export async function runMonthlyTotmFinalization(
  supabase: SupabaseClient,
  now: Date = new Date()
) {
  const current = calendarMonthKey(now)
  const prev = previousCalendarMonth(current.year, current.month)
  const result = await finalizeTotmMonth(supabase, prev.year, prev.month)
  await ensureMonth(supabase, current.year, current.month)
  return { previous: prev, current, result }
}

/**
 * Place a new submission after the track currently being reviewed,
 * after any existing TOTM priority block, without interrupting review.
 */
export async function placeSubmissionWithTotmSkip(
  supabase: SupabaseClient,
  opts: {
    submissionId: string
    sessionNumber: number
    skipId: string
    userId: string
  }
): Promise<{ ok: true; queuePosition: number } | { ok: false; error: string }> {
  const { data: skip, error: skipFetchErr } = await supabase
    .from('totm_queue_skips')
    .select('*')
    .eq('id', opts.skipId)
    .eq('user_id', opts.userId)
    .maybeSingle()

  if (skipFetchErr) throw skipFetchErr
  if (!skip) return { ok: false, error: 'TOTM queue skip not found.' }
  if ((skip as { status: string }).status !== 'available') {
    return { ok: false, error: 'That TOTM queue skip is not available.' }
  }

  const { data: rows, error } = await supabase
    .from('submissions')
    .select('id, user_id, queue_position, totm_skip_id, created_at')
    .eq('status', 'pending')
    .eq('session_number', opts.sessionNumber)
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  const queue = (rows ?? []) as Array<{
    id: string
    user_id: string
    queue_position: number | null
    totm_skip_id: string | null
    created_at: string
  }>

  // Ensure our new submission is in the list (may already be appended at end)
  let ordered = queue.filter((r) => r.id !== opts.submissionId)
  const ours = queue.find((r) => r.id === opts.submissionId) ?? {
    id: opts.submissionId,
    user_id: opts.userId,
    queue_position: null,
    totm_skip_id: opts.skipId,
    created_at: new Date().toISOString(),
  }

  // Insert index: after currently reviewing (index 0), after consecutive TOTM priorities
  let insertAt = 0
  if (ordered.length === 0) {
    insertAt = 0
  } else {
    // Never interrupt ongoing review → keep index 0
    insertAt = 1
    while (
      insertAt < ordered.length &&
      ordered[insertAt]!.totm_skip_id != null
    ) {
      insertAt += 1
    }
  }

  ordered.splice(insertAt, 0, { ...ours, totm_skip_id: opts.skipId })

  // Mark skip activated BEFORE rewriting positions; roll back on failure
  const { error: activateErr } = await supabase
    .from('totm_queue_skips')
    .update({
      status: 'activated',
      activated_submission_id: opts.submissionId,
      activated_at: new Date().toISOString(),
    })
    .eq('id', opts.skipId)
    .eq('status', 'available')

  if (activateErr) {
    return { ok: false, error: 'Could not activate TOTM queue skip.' }
  }

  // Confirm activation won the race
  const { data: activated } = await supabase
    .from('totm_queue_skips')
    .select('status, activated_submission_id')
    .eq('id', opts.skipId)
    .single()

  if (
    (activated as { status?: string; activated_submission_id?: string } | null)
      ?.status !== 'activated' ||
    (activated as { activated_submission_id?: string }).activated_submission_id !==
      opts.submissionId
  ) {
    return { ok: false, error: 'TOTM queue skip was already used.' }
  }

  const { error: linkErr } = await supabase
    .from('submissions')
    .update({ totm_skip_id: opts.skipId })
    .eq('id', opts.submissionId)

  if (linkErr) {
    await supabase
      .from('totm_queue_skips')
      .update({
        status: 'available',
        activated_submission_id: null,
        activated_at: null,
      })
      .eq('id', opts.skipId)
    return { ok: false, error: 'Queue placement failed; skip was not consumed.' }
  }

  for (let i = 0; i < ordered.length; i++) {
    const { error: posErr } = await supabase
      .from('submissions')
      .update({ queue_position: i + 1 })
      .eq('id', ordered[i]!.id)
    if (posErr) {
      await restoreTotmSkip(supabase, opts.skipId)
      await supabase
        .from('submissions')
        .update({ totm_skip_id: null })
        .eq('id', opts.submissionId)
      return { ok: false, error: 'Queue placement failed; skip was not consumed.' }
    }
  }

  return { ok: true, queuePosition: insertAt + 1 }
}

export async function restoreTotmSkip(
  supabase: SupabaseClient,
  skipId: string
): Promise<void> {
  await supabase
    .from('totm_queue_skips')
    .update({
      status: 'available',
      activated_submission_id: null,
      activated_at: null,
      consumed_at: null,
    })
    .eq('id', skipId)
    .eq('status', 'activated')
}

/** Consume skip when the linked submission's review begins (review created). */
export async function consumeTotmSkipForSubmission(
  supabase: SupabaseClient,
  submissionId: string
): Promise<void> {
  const { data: sub } = await supabase
    .from('submissions')
    .select('totm_skip_id')
    .eq('id', submissionId)
    .maybeSingle()

  const skipId = (sub as { totm_skip_id?: string | null } | null)?.totm_skip_id
  if (!skipId) return

  await supabase
    .from('totm_queue_skips')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
    })
    .eq('id', skipId)
    .eq('status', 'activated')
}

/** If an activated-skip submission leaves the queue without review, restore the skip. */
export async function restoreTotmSkipIfActivatedForSubmission(
  supabase: SupabaseClient,
  submissionId: string
): Promise<void> {
  const { data: sub } = await supabase
    .from('submissions')
    .select('totm_skip_id')
    .eq('id', submissionId)
    .maybeSingle()

  const skipId = (sub as { totm_skip_id?: string | null } | null)?.totm_skip_id
  if (!skipId) return
  await restoreTotmSkip(supabase, skipId)
  await supabase
    .from('submissions')
    .update({ totm_skip_id: null })
    .eq('id', submissionId)
}

/**
 * Daily SoundCloud check for the active (non-finalized) month selection.
 * Only removes after confirmed unavailability — not on network/API errors.
 */
export async function checkActiveTotmSoundCloudAvailability(
  supabase: SupabaseClient
): Promise<{ checked: number; removed: number }> {
  const { data: months } = await supabase
    .from('totm_months')
    .select('id, year, month')
    .eq('status', 'active')

  let checked = 0
  let removed = 0

  for (const m of months ?? []) {
    const month = m as { id: string; year: number; month: number }
    const { data: entries } = await supabase
      .from('totm_entries')
      .select('*')
      .eq('totm_month_id', month.id)
      .eq('removed_from_active', false)

    for (const entry of entries ?? []) {
      const e = entry as {
        id: string
        soundcloud_url: string
        user_id: string
        artist_name: string | null
        song_title: string | null
      }
      checked += 1
      const result = await checkSoundCloudAvailability(e.soundcloud_url)
      if (result.status !== 'unavailable') continue

      await supabase
        .from('totm_entries')
        .update({
          removed_from_active: true,
          removed_from_active_at: new Date().toISOString(),
          soundcloud_unavailable: true,
        })
        .eq('id', e.id)

      removed += 1

      const { data: user } = await supabase
        .from('users')
        .select('display_name, email')
        .eq('id', e.user_id)
        .single()

      const email = (user as { email?: string | null } | null)?.email
      const displayName =
        (user as { display_name?: string } | null)?.display_name ||
        e.artist_name ||
        'Artist'
      if (email) {
        await sendTotmTrackUnavailableEmail(email, displayName, {
          year: month.year,
          month: month.month,
          trackTitle: e.song_title,
          soundcloudUrl: e.soundcloud_url,
        })
      }
    }
  }

  return { checked, removed }
}

export type PublicTotmPayloadOptions = {
  /** When false (default), omit simulation tracks — Lab seed is curator/tester only. */
  includeSimulation?: boolean
}

function isTotmSimulationUrl(url: string) {
  return url.startsWith(TOTM_SIM_URL_PREFIX)
}

export async function getPublicTotmPayload(
  supabase: SupabaseClient,
  options: PublicTotmPayloadOptions = {}
) {
  const includeSimulation = options.includeSimulation === true
  const currentKey = calendarMonthKey()
  await ensureMonth(supabase, currentKey.year, currentKey.month)

  const { data: months } = await supabase
    .from('totm_months')
    .select('id, year, month, status, review_count, finalized_at')
    .in('status', ['active', 'finalized'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const result: Array<{
    year: number
    month: number
    status: string
    review_count: number
    label: string
    entries: Array<{
      rank: number
      artist_name: string | null
      song_title: string | null
      genre: string | null
      audience_score: number | null
      soundcloud_url: string
      soundcloud_unavailable: boolean
      removed_from_active: boolean
    }>
  }> = []

  for (const m of months ?? []) {
    const month = m as MonthRow
    const isActive = month.status === 'active'
    let query = supabase
      .from('totm_entries')
      .select(
        'rank, artist_name, song_title, genre, audience_score, soundcloud_url, soundcloud_unavailable, removed_from_active'
      )
      .eq('totm_month_id', month.id)
      .order('rank', { ascending: true })

    if (isActive) {
      query = query.eq('removed_from_active', false)
    }

    const { data: entries } = await query

    const mapped = (entries ?? [])
      .filter((e: { soundcloud_url: string }) =>
        includeSimulation ? true : !isTotmSimulationUrl(e.soundcloud_url)
      )
      .map((e: any) => ({
        rank: e.rank,
        artist_name: e.artist_name,
        song_title: e.song_title,
        genre: e.genre,
        audience_score: e.audience_score != null ? Number(e.audience_score) : null,
        soundcloud_url: e.soundcloud_url,
        soundcloud_unavailable: !!e.soundcloud_unavailable,
        removed_from_active: !!e.removed_from_active,
      }))

    // Simulation-only months stay hidden from the public board
    if (!includeSimulation && mapped.length === 0) {
      continue
    }

    // Active month with no visible entries after removals — still show month shell if review threshold met
    result.push({
      year: month.year,
      month: month.month,
      status: month.status,
      review_count: month.review_count,
      label: formatMonthLabel(month.year, month.month),
      entries: mapped,
    })
  }

  // Include collecting current month so UI can show progress threshold
  const { data: collecting } = await supabase
    .from('totm_months')
    .select('id, year, month, status, review_count')
    .eq('year', currentKey.year)
    .eq('month', currentKey.month)
    .eq('status', 'collecting')
    .maybeSingle()

  if (collecting && !result.some((r) => r.year === currentKey.year && r.month === currentKey.month)) {
    const c = collecting as MonthRow
    result.unshift({
      year: c.year,
      month: c.month,
      status: c.status,
      review_count: c.review_count,
      label: formatMonthLabel(c.year, c.month),
      entries: [],
    })
  }

  // Current month may be "active" only via simulation — surface collecting shell for public viewers
  if (
    !includeSimulation &&
    !result.some((r) => r.year === currentKey.year && r.month === currentKey.month)
  ) {
    const { data: currentRow } = await supabase
      .from('totm_months')
      .select('id, year, month, status, review_count')
      .eq('year', currentKey.year)
      .eq('month', currentKey.month)
      .maybeSingle()

    if (currentRow) {
      const c = currentRow as MonthRow
      result.unshift({
        year: c.year,
        month: c.month,
        status: 'collecting',
        review_count: c.review_count,
        label: formatMonthLabel(c.year, c.month),
        entries: [],
      })
    }
  }

  return {
    current: result.find((r) => r.year === currentKey.year && r.month === currentKey.month) ?? null,
    history: result.filter(
      (r) => !(r.year === currentKey.year && r.month === currentKey.month)
    ),
    min_reviews: TOTM_MIN_REVIEWS,
    min_score: TOTM_MIN_CURATOR_SCORE,
  }
}

export async function getUserTotmDashboard(
  supabase: SupabaseClient,
  userId: string
) {
  const { data: user } = await supabase
    .from('users')
    .select('twitch_id, display_name')
    .eq('id', userId)
    .single()

  const twitchId = (user as { twitch_id?: string } | null)?.twitch_id ?? null

  const { data: featured } = await supabase
    .from('totm_featured_artists')
    .select('awarded_at, first_totm_month_id, first_submission_id')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: skips } = await supabase
    .from('totm_queue_skips')
    .select(
      'id, status, earned_year, earned_month, activated_at, consumed_at, activated_submission_id, created_at'
    )
    .eq('user_id', userId)
    .order('earned_year', { ascending: false })
    .order('earned_month', { ascending: false })

  const { data: historyEntries } = await supabase
    .from('totm_entries')
    .select(
      `
      rank,
      artist_name,
      song_title,
      genre,
      soundcloud_url,
      soundcloud_unavailable,
      removed_from_active,
      totm_month_id,
      totm_months!inner (
        year,
        month,
        status
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const history = (historyEntries ?? []).map((e: any) => {
    const m = Array.isArray(e.totm_months) ? e.totm_months[0] : e.totm_months
    return {
      year: m.year,
      month: m.month,
      month_status: m.status,
      label: formatMonthLabel(m.year, m.month),
      rank: e.rank,
      artist_name: e.artist_name,
      song_title: e.song_title,
      genre: e.genre,
      soundcloud_url: e.soundcloud_url,
      soundcloud_unavailable: !!e.soundcloud_unavailable,
      removed_from_active: !!e.removed_from_active,
      totm_month_id: e.totm_month_id as string | undefined,
    }
  })

  // Live badge: only while the user's track is in the active (non-finalized) Top 10
  const currentKey = calendarMonthKey()
  const liveHistory = history.find(
    (h) =>
      h.year === currentKey.year &&
      h.month === currentKey.month &&
      h.month_status === 'active' &&
      !h.removed_from_active
  )

  let inTotmPayload: {
    year: number
    month: number
    label: string
    rank: number
    song_title: string | null
    artist_name: string | null
  } | null = null

  if (liveHistory) {
    inTotmPayload = {
      year: liveHistory.year,
      month: liveHistory.month,
      label: liveHistory.label,
      rank: liveHistory.rank,
      song_title: liveHistory.song_title,
      artist_name: liveHistory.artist_name,
    }
  } else {
    // History join may miss if entry exists but order/filter edge — query directly
    const { data: currentMonth } = await supabase
      .from('totm_months')
      .select('id, year, month, status')
      .eq('year', currentKey.year)
      .eq('month', currentKey.month)
      .eq('status', 'active')
      .maybeSingle()

    if (currentMonth) {
      const cm = currentMonth as { id: string; year: number; month: number }
      const { data: liveEntry } = await supabase
        .from('totm_entries')
        .select('rank, song_title, artist_name')
        .eq('totm_month_id', cm.id)
        .eq('user_id', userId)
        .eq('removed_from_active', false)
        .maybeSingle()

      if (liveEntry) {
        const le = liveEntry as {
          rank: number
          song_title: string | null
          artist_name: string | null
        }
        inTotmPayload = {
          year: cm.year,
          month: cm.month,
          label: formatMonthLabel(cm.year, cm.month),
          rank: le.rank,
          song_title: le.song_title,
          artist_name: le.artist_name,
        }
      }
    }
  }

  // Featured Artist record: auto (first Top 10 entry → Twitch VIP) or curator grant (shown on profile)
  let featuredPayload: {
    awarded_at: string
    year: number | null
    month: number | null
    label: string | null
    rank: number | null
    song_title: string | null
    /** Curator-granted Featured shows on dashboard; auto entry only drives Twitch VIP. */
    show_on_profile: boolean
  } | null = null

  if (featured) {
    const f = featured as {
      awarded_at: string
      first_totm_month_id: string | null
      first_submission_id: string | null
    }
    // Auto sync always sets first_totm_month_id; curator grant leaves it null
    const showOnProfile = f.first_totm_month_id == null

    let year: number | null = null
    let month: number | null = null
    let label: string | null = null
    let rank: number | null = null
    let songTitle: string | null = null

    const fromFirstMonth = f.first_totm_month_id
      ? history.find((h) => h.totm_month_id === f.first_totm_month_id)
      : null

    const fallback = fromFirstMonth ?? (history.length > 0 ? history[history.length - 1]! : null)

    if (fallback) {
      year = fallback.year
      month = fallback.month
      label = fallback.label
      rank = fallback.rank
      songTitle = fallback.song_title
    } else if (f.first_totm_month_id) {
      const { data: monthRow } = await supabase
        .from('totm_months')
        .select('year, month')
        .eq('id', f.first_totm_month_id)
        .maybeSingle()
      if (monthRow) {
        const mr = monthRow as { year: number; month: number }
        year = mr.year
        month = mr.month
        label = formatMonthLabel(mr.year, mr.month)
      }

      const { data: entry } = await supabase
        .from('totm_entries')
        .select('rank, song_title')
        .eq('totm_month_id', f.first_totm_month_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (entry) {
        rank = (entry as { rank: number }).rank
        songTitle = (entry as { song_title: string | null }).song_title
      }
    }

    featuredPayload = {
      awarded_at: f.awarded_at,
      year,
      month,
      label,
      rank,
      song_title: songTitle,
      show_on_profile: showOnProfile,
    }
  }

  return {
    in_totm: inTotmPayload,
    featured_artist: featuredPayload,
    twitch_id: twitchId,
    skips: (skips ?? []).map((s: any) => ({
      id: s.id,
      status: s.status,
      earned_year: s.earned_year,
      earned_month: s.earned_month,
      label: formatMonthLabel(s.earned_year, s.earned_month),
      activated_at: s.activated_at,
      consumed_at: s.consumed_at,
      activated_submission_id: s.activated_submission_id,
    })),
    available_skips: (skips ?? []).filter((s: any) => s.status === 'available'),
    history,
  }
}
