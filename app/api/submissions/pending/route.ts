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

    // Get pending submissions with user info
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        *,
        users (
          display_name,
          twitch_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Error fetching pending submissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
