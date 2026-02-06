import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Fetch carryover: (1) pending from closed sessions, (2) status='carryover' (curator-skipped)
// Each item includes carryover_type: 'session_ended' | 'curator_skip' and transferred_at for 60-min restriction
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // 1. Pending from closed sessions (session ended without review - user may have missed livestream)
    const { data: closedSessions, error: sessionsError } = await supabase
      .from('submission_sessions')
      .select('session_number, ended_at')
      .not('ended_at', 'is', null)

    if (sessionsError) throw sessionsError

    const closedMap = new Map<number, string>()
    for (const s of closedSessions || []) {
      closedMap.set(s.session_number, s.ended_at)
    }
    const closedNumbers = Array.from(closedMap.keys())

    const list: Array<{
      id: string
      user_id: string
      soundcloud_url: string
      song_title?: string
      artist_name?: string
      session_number?: number
      created_at: string
      carryover_type: 'session_ended' | 'curator_skip'
      transferred_at: string
      users?: { display_name: string }
    }> = []

    if (closedNumbers.length > 0) {
      const { data: pendingClosed, error } = await supabase
        .from('submissions')
        .select(`
          id,
          user_id,
          soundcloud_url,
          song_title,
          artist_name,
          genre,
          session_number,
          created_at,
          users!submissions_user_id_fkey (
            display_name
          )
        `)
        .eq('status', 'pending')
        .in('session_number', closedNumbers)
        .order('created_at', { ascending: true })

      if (error) throw error

      for (const s of pendingClosed || []) {
        const endedAt = closedMap.get(s.session_number)
        list.push({
          ...s,
          carryover_type: 'session_ended',
          transferred_at: endedAt || s.created_at,
        })
      }
    }

    // 2. Curator-skipped (status='carryover')
    const { data: skipped, error: skipError } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        soundcloud_url,
        song_title,
        artist_name,
        genre,
        session_number,
        created_at,
        updated_at,
        users!submissions_user_id_fkey (
          display_name
        )
      `)
      .eq('status', 'carryover')
      .order('updated_at', { ascending: false })

    if (!skipError && skipped) {
      for (const s of skipped) {
        list.push({
          ...s,
          carryover_type: 'curator_skip',
          transferred_at: (s as { updated_at?: string }).updated_at || s.created_at,
        })
      }
    }

    // Sort by transferred_at descending (most recent first)
    list.sort((a, b) =>
      new Date(b.transferred_at).getTime() - new Date(a.transferred_at).getTime()
    )

    const myCarryoverCount = userId
      ? list.filter((s) => s.user_id === userId).length
      : 0

    return NextResponse.json({ carryover: list, my_carryover_count: myCarryoverCount })
  } catch (error) {
    console.error('Error fetching carryover:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
