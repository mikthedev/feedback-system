import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

type UserRow = { id: string; display_name: string | null }

type SubmissionRow = {
  id: string
  user_id: string
  song_title: string | null
  artist_name: string | null
  status: string
  created_at: string
  soundcloud_url: string
  users: UserRow | UserRow[] | null
}

type XpLogRow = {
  user_id: string
  amount: number
  source: string
  description: string | null
  created_at: string
  users: UserRow | UserRow[] | null
}

type UsxRow = {
  user_id: string
  moves_used_this_session: number
  external_xp_this_session: number | null
}

function oneUser(u: UserRow | UserRow[] | null | undefined): UserRow | null {
  if (!u) return null
  return Array.isArray(u) ? u[0] ?? null : u
}

/** GET - Session preview: submitters, tracks, XP gained/lost (curator only) */
export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionNumber: string } }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || !user || user.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: MikeGTC access required' }, { status: 403 })
    }

    const sessionNumber = Number.parseInt(params.sessionNumber, 10)
    if (!Number.isInteger(sessionNumber) || sessionNumber < 1) {
      return NextResponse.json({ error: 'Invalid session number' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('submission_sessions')
      .select('*')
      .eq('session_number', sessionNumber)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const startedAt = session.started_at as string
    const endedAt = (session.ended_at as string | null) ?? null

    const { data: submissionsRaw, error: submissionsError } = await supabase
      .from('submissions')
      .select(
        'id, user_id, song_title, artist_name, status, created_at, soundcloud_url, users!submissions_user_id_fkey(id, display_name)'
      )
      .eq('session_number', sessionNumber)
      .order('created_at', { ascending: true })

    if (submissionsError) throw submissionsError

    const submissions = (submissionsRaw ?? []) as SubmissionRow[]

    let xpQuery = supabase
      .from('xp_log')
      .select('user_id, amount, source, description, created_at, users(id, display_name)')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: true })

    if (endedAt) {
      xpQuery = xpQuery.lte('created_at', endedAt)
    }

    const { data: xpRaw, error: xpError } = await xpQuery
    if (xpError) throw xpError
    const xpRows = (xpRaw ?? []) as XpLogRow[]

    const { data: usxRaw, error: usxError } = await supabase
      .from('user_session_xp')
      .select('user_id, moves_used_this_session, external_xp_this_session')
      .eq('session_number', sessionNumber)

    if (usxError) throw usxError
    const usxByUser = new Map<string, UsxRow>()
    for (const row of (usxRaw ?? []) as UsxRow[]) {
      usxByUser.set(row.user_id, row)
    }

    type Agg = {
      user_id: string
      display_name: string
      track_count: number
      reviewed_count: number
      pending_count: number
      tracks: Array<{
        id: string
        song_title: string | null
        artist_name: string | null
        status: string
        created_at: string
        soundcloud_url: string
      }>
      xp_gained: number
      xp_lost: number
      xp_net: number
      moves_used: number
      by_source: Record<string, number>
    }

    const byUser = new Map<string, Agg>()

    const ensureUser = (id: string, displayName?: string | null) => {
      let agg = byUser.get(id)
      if (!agg) {
        const usx = usxByUser.get(id)
        agg = {
          user_id: id,
          display_name: displayName?.trim() || 'Unknown',
          track_count: 0,
          reviewed_count: 0,
          pending_count: 0,
          tracks: [],
          xp_gained: 0,
          xp_lost: 0,
          xp_net: 0,
          moves_used: usx?.moves_used_this_session ?? 0,
          by_source: {},
        }
        byUser.set(id, agg)
      } else if (displayName?.trim() && agg.display_name === 'Unknown') {
        agg.display_name = displayName.trim()
      }
      return agg
    }

    for (const sub of submissions) {
      const u = oneUser(sub.users)
      const agg = ensureUser(sub.user_id, u?.display_name)
      agg.track_count += 1
      if (sub.status === 'reviewed') agg.reviewed_count += 1
      else agg.pending_count += 1
      agg.tracks.push({
        id: sub.id,
        song_title: sub.song_title,
        artist_name: sub.artist_name,
        status: sub.status,
        created_at: sub.created_at,
        soundcloud_url: sub.soundcloud_url,
      })
    }

    let totalXpGained = 0
    let totalXpLost = 0

    for (const row of xpRows) {
      const amount = Number(row.amount) || 0
      if (amount > 0) totalXpGained += amount
      else if (amount < 0) totalXpLost += Math.abs(amount)

      const u = oneUser(row.users)
      const agg = ensureUser(row.user_id, u?.display_name)
      if (amount > 0) agg.xp_gained += amount
      else if (amount < 0) agg.xp_lost += Math.abs(amount)
      agg.xp_net += amount
      agg.by_source[row.source] = (agg.by_source[row.source] ?? 0) + amount
    }

    // Prefer submitters; also include anyone with XP activity in the window
    const submitterIds = new Set(submissions.map((s) => s.user_id))
    const submitters = Array.from(byUser.values())
      .filter((u) => submitterIds.has(u.user_id) || u.xp_net !== 0 || u.moves_used > 0)
      .sort((a, b) => {
        if (b.track_count !== a.track_count) return b.track_count - a.track_count
        return a.display_name.localeCompare(b.display_name)
      })

    const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length
    const pendingCount = submissions.length - reviewedCount

    return NextResponse.json({
      session: {
        id: session.id,
        session_number: session.session_number,
        started_at: startedAt,
        ended_at: endedAt,
        submission_count: submissions.length,
        unique_submitters: submitterIds.size,
        reviewed_count: reviewedCount,
        pending_count: pendingCount,
        xp_gained: totalXpGained,
        xp_lost: totalXpLost,
        xp_net: totalXpGained - totalXpLost,
      },
      submitters,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error fetching session detail:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
