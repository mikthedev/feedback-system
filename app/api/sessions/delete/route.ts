import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// DELETE - Delete sessions and their submissions (curator only)
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden: Curator access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { session_numbers, delete_all } = body

    // Validate input
    if (delete_all !== true && (!session_numbers || !Array.isArray(session_numbers) || session_numbers.length === 0)) {
      return NextResponse.json(
        { error: 'Either provide session_numbers array or set delete_all to true' },
        { status: 400 }
      )
    }

    let deletedSessions: number[] = []
    let deletedSubmissionsCount = 0

    if (delete_all === true) {
      // Delete all sessions and their submissions
      // First, get all session numbers to delete
      const { data: allSessions, error: sessionsError } = await supabase
        .from('submission_sessions')
        .select('session_number')
        .order('session_number', { ascending: true })

      if (sessionsError) throw sessionsError

      if (allSessions && allSessions.length > 0) {
        const sessionNumbers = allSessions.map(s => s.session_number)

        // Count submissions before deletion
        const { count: beforeCount } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .in('session_number', sessionNumbers)
        
        deletedSubmissionsCount = beforeCount || 0

        // Delete submissions for these sessions (reviews will cascade delete)
        const { error: deleteSubmissionsError } = await supabase
          .from('submissions')
          .delete()
          .in('session_number', sessionNumbers)

        if (deleteSubmissionsError) throw deleteSubmissionsError

        // Delete the sessions
        const { error: deleteSessionsError } = await supabase
          .from('submission_sessions')
          .delete()
          .in('session_number', sessionNumbers)

        if (deleteSessionsError) throw deleteSessionsError

        deletedSessions = sessionNumbers
      }
    } else {
      // Delete specific sessions
      // Validate session numbers are integers
      const validSessionNumbers = session_numbers.filter((n: any) => Number.isInteger(n) && n > 0)
      
      if (validSessionNumbers.length === 0) {
        return NextResponse.json(
          { error: 'No valid session numbers provided' },
          { status: 400 }
        )
      }

      // Count submissions before deletion
      const { count: beforeCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .in('session_number', validSessionNumbers)

      deletedSubmissionsCount = beforeCount || 0

      // Delete submissions for these sessions (reviews will cascade delete)
      const { error: deleteSubmissionsError } = await supabase
        .from('submissions')
        .delete()
        .in('session_number', validSessionNumbers)

      if (deleteSubmissionsError) throw deleteSubmissionsError

      // Delete the sessions
      const { error: deleteSessionsError } = await supabase
        .from('submission_sessions')
        .delete()
        .in('session_number', validSessionNumbers)

      if (deleteSessionsError) throw deleteSessionsError

      deletedSessions = validSessionNumbers
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedSessions.length} session(s) and ${deletedSubmissionsCount} submission(s)`,
      deleted_sessions: deletedSessions,
      deleted_submissions_count: deletedSubmissionsCount
    })
  } catch (error: any) {
    console.error('Error deleting sessions:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
