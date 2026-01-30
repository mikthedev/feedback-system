import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Fetch carryover (all pending submissions from closed sessions, same scope as Queue)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: closedSessions, error: sessionsError } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .not('ended_at', 'is', null)

    if (sessionsError) throw sessionsError

    const closedNumbers = (closedSessions || []).map((s) => s.session_number)
    if (closedNumbers.length === 0) {
      return NextResponse.json({ carryover: [] })
    }

    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        soundcloud_url,
        song_title,
        artist_name,
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

    const list = submissions || []
    const myCarryoverCount = userId ? list.filter((s: { user_id?: string }) => s.user_id === userId).length : 0

    return NextResponse.json({ carryover: list, my_carryover_count: myCarryoverCount })
  } catch (error) {
    console.error('Error fetching carryover:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
