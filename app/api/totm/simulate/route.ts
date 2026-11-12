import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calendarMonthKey,
  previousCalendarMonth,
  formatMonthLabel,
  TOTM_MIN_REVIEWS,
  getPublicTotmPayload,
} from '@/lib/totm'

export const SIM_TWITCH_PREFIX = 'totm_sim_'
export const SIM_URL_PREFIX = 'https://soundcloud.com/totm-sim/'

async function requireCuratorOrTester() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_user_id')?.value
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, role, twitch_id, display_name, email')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  const role = (user as { role: string }).role
  if (role !== 'curator' && role !== 'tester') {
    return { error: NextResponse.json({ error: 'Forbidden: curator or tester only' }, { status: 403 }) }
  }
  return {
    supabase,
    user: user as {
      id: string
      role: string
      twitch_id: string
      display_name: string
      email: string | null
    },
  }
}

async function ensureMonthRow(
  supabase: ReturnType<typeof createAdminClient>,
  year: number,
  month: number,
  status: 'active' | 'finalized',
  reviewCount: number
) {
  const nowIso = new Date().toISOString()
  const { data: existing } = await supabase
    .from('totm_months')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('totm_months')
      .update({
        status,
        review_count: reviewCount,
        finalized_at: status === 'finalized' ? nowIso : null,
        updated_at: nowIso,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single()
    if (error) throw error
    return data as { id: string; year: number; month: number; status: string }
  }

  const { data, error } = await supabase
    .from('totm_months')
    .insert({
      year,
      month,
      status,
      review_count: reviewCount,
      finalized_at: status === 'finalized' ? nowIso : null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as { id: string; year: number; month: number; status: string }
}

/** Remove previous simulation artifacts without leaving the current month stuck empty. */
async function clearSimulation(
  supabase: ReturnType<typeof createAdminClient>,
  actorUserId: string
) {
  const { data: simSubs } = await supabase
    .from('submissions')
    .select('id')
    .like('soundcloud_url', `${SIM_URL_PREFIX}%`)

  const simSubIds = (simSubs ?? []).map((s: { id: string }) => s.id)

  if (simSubIds.length > 0) {
    await supabase.from('totm_entries').delete().in('submission_id', simSubIds)
    await supabase.from('reviews').delete().in('submission_id', simSubIds)
    await supabase.from('submissions').delete().in('id', simSubIds)
  }

  // Remove sim skips for the actor (earned from sim months)
  const { data: actorSkips } = await supabase
    .from('totm_queue_skips')
    .select('id, totm_month_id')
    .eq('user_id', actorUserId)

  for (const skip of actorSkips ?? []) {
    const monthId = (skip as { totm_month_id: string }).totm_month_id
    const { count } = await supabase
      .from('totm_entries')
      .select('id', { count: 'exact', head: true })
      .eq('totm_month_id', monthId)
    // If month has no real entries left, this skip was from sim — remove it
    if ((count ?? 0) === 0) {
      await supabase.from('totm_queue_skips').delete().eq('id', (skip as { id: string }).id)
    }
  }

  const { data: simUsers } = await supabase
    .from('users')
    .select('id')
    .like('twitch_id', `${SIM_TWITCH_PREFIX}%`)

  const simUserIds = (simUsers ?? []).map((u: { id: string }) => u.id)
  if (simUserIds.length > 0) {
    await supabase.from('totm_featured_artists').delete().in('user_id', simUserIds)
    await supabase.from('totm_queue_skips').delete().in('user_id', simUserIds)
    await supabase.from('users').delete().in('id', simUserIds)
  }

  // Reset empty months back to collecting instead of deleting (avoids flicker / races)
  const { data: months } = await supabase.from('totm_months').select('id, year, month, status')
  for (const m of months ?? []) {
    const id = (m as { id: string }).id
    const { count } = await supabase
      .from('totm_entries')
      .select('id', { count: 'exact', head: true })
      .eq('totm_month_id', id)
    if ((count ?? 0) === 0) {
      await supabase.from('totm_finalization_log').delete().eq('totm_month_id', id)
      await supabase.from('totm_queue_skips').delete().eq('totm_month_id', id)
      await supabase
        .from('totm_months')
        .update({
          status: 'collecting',
          review_count: 0,
          finalized_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }
  }
}

/**
 * POST — Seed or clear a TOTM simulation for curator / tester.
 * Body: { action: 'seed' | 'clear' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCuratorOrTester()
    if ('error' in auth && auth.error) return auth.error
    const { supabase, user } = auth as {
      supabase: ReturnType<typeof createAdminClient>
      user: {
        id: string
        role: string
        twitch_id: string
        display_name: string
        email: string | null
      }
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action === 'clear' ? 'clear' : 'seed'

    if (action === 'clear') {
      const { data: featured } = await supabase
        .from('totm_featured_artists')
        .select('first_submission_id')
        .eq('user_id', user.id)
        .maybeSingle()
      const firstSubId = (featured as { first_submission_id?: string } | null)?.first_submission_id
      if (firstSubId) {
        const { data: sub } = await supabase
          .from('submissions')
          .select('soundcloud_url')
          .eq('id', firstSubId)
          .maybeSingle()
        if (
          String((sub as { soundcloud_url?: string } | null)?.soundcloud_url || '').startsWith(
            SIM_URL_PREFIX
          )
        ) {
          await supabase.from('totm_featured_artists').delete().eq('user_id', user.id)
        }
      }

      await clearSimulation(supabase, user.id)
      return NextResponse.json({
        success: true,
        action: 'clear',
        message: 'TOTM simulation cleared.',
      })
    }

    await clearSimulation(supabase, user.id)

    const now = new Date()
    const current = calendarMonthKey(now)
    const prev = previousCalendarMonth(current.year, current.month)

    const currentMonth = await ensureMonthRow(
      supabase,
      current.year,
      current.month,
      'active',
      TOTM_MIN_REVIEWS + 5
    )
    const prevMonth = await ensureMonthRow(
      supabase,
      prev.year,
      prev.month,
      'finalized',
      TOTM_MIN_REVIEWS + 2
    )

    let reviewCuratorId = user.id
    if (user.role !== 'curator') {
      const { data: curator } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'curator')
        .limit(1)
        .maybeSingle()
      if (curator?.id) reviewCuratorId = (curator as { id: string }).id
    }

    const artists: Array<{
      userId: string
      twitchId: string
      displayName: string
      submissionId: string
      soundcloudUrl: string
      score: number
      title: string
      genre: string
      audienceScore: number
    }> = []

    for (let i = 0; i < 10; i++) {
      // Curator score: #1 highest (~9.9), #10 at the 8.5 entry floor (not a ceiling)
      const score = Math.round((9.9 - i * ((9.9 - 8.5) / 9)) * 10) / 10
      const title = i === 0 ? 'Simulated TOTM Track (You)' : `Simulated Hit #${i + 1}`
      const genre = ['House', 'Drum & Bass', 'Dubstep', 'Future Bass', 'Techno'][i % 5]!
      // Audience is independent of the 8.5 curator entry threshold
      const audienceScore = Math.round((9.4 - i * 0.22) * 10) / 10

      if (i === 0) {
        const url = `${SIM_URL_PREFIX}you-${user.id.slice(0, 8)}`
        const { data: sub, error: subErr } = await supabase
          .from('submissions')
          .insert({
            user_id: user.id,
            soundcloud_url: url,
            artist_name: user.display_name,
            song_title: title,
            genre,
            status: 'reviewed',
            audience_score: audienceScore,
            session_number: null,
          })
          .select('id')
          .single()
        if (subErr) throw subErr

        await supabase.from('reviews').insert({
          submission_id: (sub as { id: string }).id,
          curator_id: reviewCuratorId,
          sound_score: score,
          structure_score: score,
          mix_score: score,
          vibe_score: score,
        })

        artists.push({
          userId: user.id,
          twitchId: user.twitch_id,
          displayName: user.display_name,
          submissionId: (sub as { id: string }).id,
          soundcloudUrl: url,
          score,
          title,
          genre,
          audienceScore,
        })
        continue
      }

      const twitchId = `${SIM_TWITCH_PREFIX}${i}`
      const displayName = `Sim Artist ${i}`

      let simUserId: string
      const { data: existingSim } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_id', twitchId)
        .maybeSingle()
      if (existingSim?.id) {
        simUserId = (existingSim as { id: string }).id
      } else {
        const { data: created, error: userErr } = await supabase
          .from('users')
          .insert({
            twitch_id: twitchId,
            display_name: displayName,
            role: 'user',
            email: null,
          })
          .select('id')
          .single()
        if (userErr) throw userErr
        simUserId = (created as { id: string }).id
      }

      const url = `${SIM_URL_PREFIX}artist-${i}`
      const { data: sub, error: subErr } = await supabase
        .from('submissions')
        .insert({
          user_id: simUserId,
          soundcloud_url: url,
          artist_name: displayName,
          song_title: title,
          genre,
          status: 'reviewed',
          audience_score: audienceScore,
          session_number: null,
        })
        .select('id')
        .single()
      if (subErr) throw subErr

      await supabase.from('reviews').insert({
        submission_id: (sub as { id: string }).id,
        curator_id: reviewCuratorId,
        sound_score: score,
        structure_score: score,
        mix_score: score,
        vibe_score: score,
      })

      artists.push({
        userId: simUserId,
        twitchId,
        displayName,
        submissionId: (sub as { id: string }).id,
        soundcloudUrl: url,
        score,
        title,
        genre,
        audienceScore,
      })
    }

    const insertEntries = async (
      monthId: string,
      list: typeof artists,
      opts?: { markUnavailableRank?: number }
    ) => {
      await supabase.from('totm_entries').delete().eq('totm_month_id', monthId)
      const rows = list.map((a, idx) => {
        const rank = idx + 1
        const unavailable = opts?.markUnavailableRank === rank
        return {
          totm_month_id: monthId,
          submission_id: a.submissionId,
          user_id: a.userId,
          twitch_user_id: a.twitchId,
          artist_name: a.displayName,
          song_title: a.title,
          genre: a.genre,
          soundcloud_url: a.soundcloudUrl,
          audience_score: a.audienceScore,
          curator_score: a.score,
          rank,
          review_created_at: new Date(now.getTime() - (10 - idx) * 3600_000).toISOString(),
          submission_created_at: new Date(now.getTime() - (20 - idx) * 86400_000).toISOString(),
          removed_from_active: false,
          soundcloud_unavailable: unavailable,
        }
      })
      const { error } = await supabase.from('totm_entries').insert(rows)
      if (error) throw error
    }

    // Active month Top 10 (you at #1) — this is what /totm shows
    await insertEntries(currentMonth.id, artists)

    // Previous finalized month for history + skip reward
    const prevOrder = [...artists]
    const you = prevOrder.shift()!
    prevOrder.splice(2, 0, you)
    await insertEntries(prevMonth.id, prevOrder.slice(0, 10), { markUnavailableRank: 8 })

    await supabase.from('totm_finalization_log').upsert(
      {
        totm_month_id: prevMonth.id,
        finalized_at: now.toISOString(),
        skips_granted: 1,
        featured_preserved: 10,
      },
      { onConflict: 'totm_month_id' }
    )

    await supabase.from('totm_featured_artists').upsert(
      {
        twitch_user_id: user.twitch_id,
        user_id: user.id,
        first_totm_month_id: prevMonth.id,
        first_submission_id: you.submissionId,
        awarded_at: now.toISOString(),
        featured_email_sent_at: now.toISOString(),
      },
      { onConflict: 'twitch_user_id' }
    )

    await supabase.from('totm_queue_skips').upsert(
      {
        user_id: user.id,
        twitch_user_id: user.twitch_id,
        totm_month_id: prevMonth.id,
        earned_year: prev.year,
        earned_month: prev.month,
        status: 'available',
        reward_email_sent_at: now.toISOString(),
      },
      { onConflict: 'totm_month_id,twitch_user_id' }
    )

    // Verify public payload sees the Top 10
    const publicPayload = await getPublicTotmPayload(supabase, {
      includeSimulation: true,
    })
    const visibleCount = publicPayload.current?.entries?.length ?? 0

    return NextResponse.json({
      success: true,
      action: 'seed',
      message: `TOTM simulation ready: ${visibleCount} tracks in this month’s Top 10.`,
      current_month: formatMonthLabel(current.year, current.month),
      previous_month: formatMonthLabel(prev.year, prev.month),
      your_rank_current: 1,
      your_rank_previous: 3,
      available_skips: 1,
      public_entries: visibleCount,
      public_status: publicPayload.current?.status ?? null,
    })
  } catch (error) {
    console.error('POST /api/totm/simulate error:', error)
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
