import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Fetch pending submissions (curator only)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    
    // Check if user is curator
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || !user || user.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: currentSession } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentSession?.session_number) {
      return NextResponse.json({ submissions: [] })
    }

    const sn = currentSession.session_number

    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        *,
        users!submissions_user_id_fkey (
          display_name,
          twitch_id
        )
      `)
      .eq('status', 'pending')
      .eq('session_number', sn)
      .order('queue_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    const subs = submissions ?? []
    const userIds = [...new Set((subs as { user_id: string }[]).map((s) => s.user_id))]
    let movesByUser: Record<string, number> = {}
    if (userIds.length > 0) {
      const { data: usxRows } = await supabase
        .from('user_session_xp')
        .select('user_id, moves_used_this_session')
        .eq('session_number', sn)
        .in('user_id', userIds)
      for (const row of usxRows ?? []) {
        const r = row as { user_id: string; moves_used_this_session?: number }
        movesByUser[r.user_id] = Math.max(0, Math.floor(Number(r.moves_used_this_session ?? 0)))
      }
    }

    const enriched = (subs as Array<{ user_id: string }>).map((s) => ({
      ...s,
      moves_used_this_session: movesByUser[s.user_id] ?? 0,
    }))

    return NextResponse.json({ submissions: enriched })
  } catch (error) {
    console.error('Error fetching pending submissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
