import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Fetch user's reviewed submissions (from any session)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Fetch all reviewed submissions from any session
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        *,
        reviews (
          sound_score,
          structure_score,
          mix_score,
          vibe_score,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'reviewed')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ submissions: submissions || [] })
  } catch (error) {
    console.error('Error fetching reviewed submissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
