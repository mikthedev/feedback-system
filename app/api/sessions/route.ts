import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - List all sessions with submission counts (curator only)
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
      return NextResponse.json({ error: 'Forbidden: MikeGTC access required' }, { status: 403 })
    }

    // Get all sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('submission_sessions')
      .select('*')
      .order('session_number', { ascending: false })

    if (sessionsError) throw sessionsError

    // Get submission counts for each session
    const sessionsWithCounts = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count, error: countError } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('session_number', session.session_number)

        return {
          ...session,
          submission_count: countError ? 0 : (count || 0)
        }
      })
    )

    return NextResponse.json({ sessions: sessionsWithCounts })
  } catch (error: any) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
