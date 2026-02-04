import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { normalizeSoundCloudUrl } from '@/lib/validators'

// GET - Fetch all users who submitted a specific song (by soundcloud_url)
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

    const { searchParams } = new URL(request.url)
    const soundcloudUrl = searchParams.get('url')

    if (!soundcloudUrl) {
      return NextResponse.json({ error: 'SoundCloud URL is required' }, { status: 400 })
    }

    // Normalize URL to match stored format
    const normalizedUrl = normalizeSoundCloudUrl(soundcloudUrl)

    // Fetch all submissions with this URL, including user info
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        created_at,
        users!submissions_user_id_fkey (
          id,
          display_name,
          twitch_id
        )
      `)
      .eq('soundcloud_url', normalizedUrl)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group by user_id to get unique users
    const userMap = new Map<string, {
      user_id: string
      display_name: string
      twitch_id: string
      submission_count: number
      first_submission_at: string
    }>()

    submissions?.forEach((submission: any) => {
      const userId = submission.user_id
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          display_name: submission.users.display_name,
          twitch_id: submission.users.twitch_id,
          submission_count: 0,
          first_submission_at: submission.created_at
        })
      }
      const userData = userMap.get(userId)!
      userData.submission_count++
      if (new Date(submission.created_at) < new Date(userData.first_submission_at)) {
        userData.first_submission_at = submission.created_at
      }
    })

    const users = Array.from(userMap.values())

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users by URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
