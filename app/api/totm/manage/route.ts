import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { calendarMonthKey, previousCalendarMonth, formatMonthLabel } from '@/lib/totm'

async function requireCurator() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_user_id')?.value
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createAdminClient()
  const { data: me, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (error || !me) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  if ((me as { role: string }).role !== 'curator') {
    return { error: NextResponse.json({ error: 'Forbidden: curator only' }, { status: 403 }) }
  }
  return { supabase, curatorId: (me as { id: string }).id }
}

async function loadTargetUser(
  supabase: ReturnType<typeof createAdminClient>,
  targetUserId: string
) {
  const { data, error } = await supabase
    .from('users')
    .select('id, twitch_id, display_name, email')
    .eq('id', targetUserId)
    .single()
  if (error || !data) return null
  return data as {
    id: string
    twitch_id: string
    display_name: string
    email: string | null
  }
}

async function ensureMonthRow(
  supabase: ReturnType<typeof createAdminClient>,
  year: number,
  month: number
) {
  const { data: existing } = await supabase
    .from('totm_months')
    .select('id, year, month')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (existing) return existing as { id: string; year: number; month: number }

  const { data, error } = await supabase
    .from('totm_months')
    .insert({ year, month, status: 'finalized', review_count: 0, finalized_at: new Date().toISOString() })
    .select('id, year, month')
    .single()
  if (error) throw error
  return data as { id: string; year: number; month: number }
}

/**
 * GET — Curator: TOTM feature status for a user.
 * Query: user_id
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCurator()
    if ('error' in auth) return auth.error

    const userId = request.nextUrl.searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const target = await loadTargetUser(auth.supabase, userId)
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: featured } = await auth.supabase
      .from('totm_featured_artists')
      .select('awarded_at, twitch_user_id')
      .eq('user_id', target.id)
      .maybeSingle()

    const { data: skips } = await auth.supabase
      .from('totm_queue_skips')
      .select('id, status, earned_year, earned_month, created_at')
      .eq('user_id', target.id)
      .order('created_at', { ascending: false })

    const skipRows = (skips ?? []) as Array<{
      id: string
      status: string
      earned_year: number
      earned_month: number
      created_at: string
    }>

    return NextResponse.json({
      user: {
        id: target.id,
        display_name: target.display_name,
        twitch_id: target.twitch_id,
      },
      featured_artist: featured
        ? { awarded_at: (featured as { awarded_at: string }).awarded_at }
        : null,
      skips: skipRows.map((s) => ({
        id: s.id,
        status: s.status,
        label: formatMonthLabel(s.earned_year, s.earned_month),
        earned_year: s.earned_year,
        earned_month: s.earned_month,
      })),
      available_skips: skipRows.filter((s) => s.status === 'available').length,
    })
  } catch (error) {
    console.error('GET /api/totm/manage error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST — Curator: manually grant / revoke Featured Artist or queue skips.
 * Body: { action, user_id, skip_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCurator()
    if ('error' in auth) return auth.error

    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    const targetUserId = typeof body.user_id === 'string' ? body.user_id : ''
    const skipId = typeof body.skip_id === 'string' ? body.skip_id : null

    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const target = await loadTargetUser(auth.supabase, targetUserId)
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    if (action === 'grant_featured') {
      const { data: existing } = await auth.supabase
        .from('totm_featured_artists')
        .select('twitch_user_id')
        .eq('user_id', target.id)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({
          success: true,
          message: `${target.display_name} is already a Featured Artist.`,
          already: true,
        })
      }

      const { error } = await auth.supabase.from('totm_featured_artists').insert({
        twitch_user_id: target.twitch_id,
        user_id: target.id,
        awarded_at: nowIso,
        featured_email_sent_at: nowIso,
      })
      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Featured Artist granted to ${target.display_name}.`,
      })
    }

    if (action === 'revoke_featured') {
      const { data: existing } = await auth.supabase
        .from('totm_featured_artists')
        .select('twitch_user_id')
        .eq('user_id', target.id)
        .maybeSingle()
      if (!existing) {
        return NextResponse.json({
          success: true,
          message: `${target.display_name} is not a Featured Artist.`,
          already: true,
        })
      }

      const { error } = await auth.supabase
        .from('totm_featured_artists')
        .delete()
        .eq('user_id', target.id)
      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Featured Artist removed from ${target.display_name}.`,
      })
    }

    if (action === 'grant_skip') {
      const current = calendarMonthKey(new Date())
      const prev = previousCalendarMonth(current.year, current.month)

      // Prefer previous month; if that slot is taken, try current month.
      const candidates = [prev, current]
      let granted: { year: number; month: number } | null = null
      let lastConflict = false

      for (const slot of candidates) {
        const monthRow = await ensureMonthRow(auth.supabase, slot.year, slot.month)
        const { data: existing } = await auth.supabase
          .from('totm_queue_skips')
          .select('id, status')
          .eq('totm_month_id', monthRow.id)
          .eq('twitch_user_id', target.twitch_id)
          .maybeSingle()

        if (!existing) {
          const { error } = await auth.supabase.from('totm_queue_skips').insert({
            user_id: target.id,
            twitch_user_id: target.twitch_id,
            totm_month_id: monthRow.id,
            earned_year: slot.year,
            earned_month: slot.month,
            status: 'available',
            reward_email_sent_at: nowIso,
          })
          if (error) throw error
          granted = slot
          break
        }

        const row = existing as { id: string; status: string }
        if (row.status === 'available') {
          lastConflict = true
          continue
        }

        // Restore a previously used skip for this month slot
        const { error } = await auth.supabase
          .from('totm_queue_skips')
          .update({
            status: 'available',
            activated_submission_id: null,
            activated_at: null,
            consumed_at: null,
            updated_at: nowIso,
          })
          .eq('id', row.id)
        if (error) throw error
        granted = slot
        break
      }

      if (!granted) {
        return NextResponse.json({
          success: true,
          already: true,
          message: lastConflict
            ? `${target.display_name} already has available skips for recent months.`
            : `Could not grant a skip to ${target.display_name}.`,
        })
      }

      return NextResponse.json({
        success: true,
        message: `Queue skip granted to ${target.display_name} (${formatMonthLabel(granted.year, granted.month)}).`,
      })
    }

    if (action === 'revoke_skip') {
      if (skipId) {
        const { data: skip } = await auth.supabase
          .from('totm_queue_skips')
          .select('id, status, user_id')
          .eq('id', skipId)
          .eq('user_id', target.id)
          .maybeSingle()
        if (!skip) {
          return NextResponse.json({ error: 'Skip not found' }, { status: 404 })
        }
        if ((skip as { status: string }).status !== 'available') {
          return NextResponse.json(
            { error: 'Only available (unused) skips can be revoked' },
            { status: 400 }
          )
        }
        const { error } = await auth.supabase
          .from('totm_queue_skips')
          .delete()
          .eq('id', skipId)
        if (error) throw error
        return NextResponse.json({
          success: true,
          message: `Queue skip revoked from ${target.display_name}.`,
        })
      }

      // Revoke one available skip (most recent)
      const { data: available } = await auth.supabase
        .from('totm_queue_skips')
        .select('id')
        .eq('user_id', target.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!available) {
        return NextResponse.json({
          success: true,
          already: true,
          message: `${target.display_name} has no available queue skips.`,
        })
      }

      const { error } = await auth.supabase
        .from('totm_queue_skips')
        .delete()
        .eq('id', (available as { id: string }).id)
      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Queue skip revoked from ${target.display_name}.`,
      })
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Use grant_featured, revoke_featured, grant_skip, or revoke_skip.',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('POST /api/totm/manage error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
