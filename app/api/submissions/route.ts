import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSoundCloudUrl, normalizeSoundCloudUrl } from '@/lib/validators'
import { sendConfirmationEmail } from '@/lib/resend'
import { cookies } from 'next/headers'

// GET - Fetch user's submissions
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
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
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new submission
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { soundcloud_url, email, description, artist_name, song_title } = body

    // Server-side validation - CRITICAL for security
    if (!soundcloud_url || typeof soundcloud_url !== 'string') {
      return NextResponse.json(
        { error: 'SoundCloud URL is required' },
        { status: 400 }
      )
    }

    // Hard validation - reject anything not SoundCloud
    if (!validateSoundCloudUrl(soundcloud_url)) {
      return NextResponse.json(
        { error: 'Invalid SoundCloud URL. Must be a valid SoundCloud track URL.' },
        { status: 400 }
      )
    }

    // Normalize URL for consistent storage (adds https:// if missing, etc.)
    const normalizedUrl = normalizeSoundCloudUrl(soundcloud_url)

    // Check if submissions are open (app_config)
    const supabase = createAdminClient()
    const { data: config } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()

    const submissionsOpen = config?.submissions_open ?? true

    if (!submissionsOpen) {
      return NextResponse.json(
        { error: 'Submissions are currently closed. Please check back later.' },
        { status: 403 }
      )
    }

    // Get current session number
    const { data: currentSessionNumber, error: sessionError } = await supabase
      .rpc('get_or_create_current_session')

    if (sessionError || !currentSessionNumber) {
      console.error('Error getting current session:', sessionError)
      return NextResponse.json(
        { error: 'Error determining submission session. Please try again.' },
        { status: 500 }
      )
    }

    // Check if this is the first session (session_number = 1)
    const isFirstSession = currentSessionNumber === 1

    // Check if this URL was already submitted in the current session
    const { data: currentSessionSubmission } = await supabase
      .from('submissions')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('soundcloud_url', normalizedUrl)
      .eq('session_number', currentSessionNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (currentSessionSubmission) {
      // Special handling for first session: allow resubmission after 1 hour
      if (isFirstSession) {
        const submissionTime = new Date(currentSessionSubmission.created_at).getTime()
        const now = Date.now()
        const hoursSinceSubmission = (now - submissionTime) / (1000 * 60 * 60)

        if (hoursSinceSubmission < 1) {
          const minutesRemaining = Math.ceil((1 - hoursSinceSubmission) * 60)
          return NextResponse.json(
            { 
              error: `This track was already submitted in this session. During the first session, you can only resubmit a track after 1 hour. Please wait ${minutesRemaining} more minute${minutesRemaining !== 1 ? 's' : ''}.`,
              warning: false
            },
            { status: 400 }
          )
        }
        // If 1 hour has passed, allow the resubmission in session 1
      } else {
        // For non-first sessions, block duplicate submissions in the same session
        return NextResponse.json(
          { 
            error: 'This track has already been submitted in this session. Each track can only be submitted once per session.',
            warning: false
          },
          { status: 400 }
        )
      }
    }

    // Check if this URL was submitted in a previous session (for warning)
    let previousSessionWarning = false
    if (!isFirstSession) {
      const { data: previousSessionSubmission } = await supabase
        .from('submissions')
        .select('id, created_at, session_number')
        .eq('user_id', userId)
        .eq('soundcloud_url', normalizedUrl)
        .neq('session_number', currentSessionNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (previousSessionSubmission) {
        previousSessionWarning = true
      }
    }

    // Create submission
    const { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert({
        user_id: userId,
        soundcloud_url: normalizedUrl,
        description: description?.trim() || null,
        artist_name: artist_name?.trim() || null,
        song_title: song_title?.trim() || null,
        status: 'pending',
        session_number: currentSessionNumber,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Get user data for email
    const { data: user } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', userId)
      .single()

    // Send confirmation email (optional - use provided email or user's email)
    const emailToSend = email || user?.email
    if (emailToSend) {
      await sendConfirmationEmail(emailToSend, user?.display_name || 'User')
    }

    return NextResponse.json({ 
      success: true, 
      submission,
      message: 'Demo submitted successfully',
      warning: previousSessionWarning ? 'This song has already been submitted in a previous session.' : undefined
    })
  } catch (error) {
    console.error('Error creating submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
