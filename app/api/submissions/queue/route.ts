import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Fetch queue (all pending submissions ordered by creation time)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    
    // Get pending submissions with user info, ordered by creation time (oldest first = queue order)
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        id,
        soundcloud_url,
        song_title,
        artist_name,
        created_at,
        users (
          display_name
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ queue: submissions || [] })
  } catch (error) {
    console.error('Error fetching queue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
