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

    // HARD SUBMISSION LIMIT: Check user's submissions in current session
    const { data: userSubmissionsInSession, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('session_number', currentSessionNumber)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      console.error('Error checking user submissions:', submissionsError)
      return NextResponse.json(
        { error: 'Error checking submission limit. Please try again.' },
        { status: 500 }
      )
    }

    const submissionCount = userSubmissionsInSession?.length || 0

    // If user has already submitted 1 or more tracks in this session
    if (submissionCount >= 1) {
      // Get the current session info to check if it's still open
      const { data: currentSession, error: sessionInfoError } = await supabase
        .from('submission_sessions')
        .select('ended_at')
        .eq('session_number', currentSessionNumber)
        .single()

      if (sessionInfoError) {
        console.error('Error checking session status:', sessionInfoError)
        return NextResponse.json(
          { error: 'Error checking session status. Please try again.' },
          { status: 500 }
        )
      }

      // Check if session is still open
      const isSessionOpen = currentSession?.ended_at === null

      if (!isSessionOpen) {
        // Session is closed - block second submission
        return NextResponse.json(
          { 
            error: 'You have already submitted 1 track in this session. A second submission is only allowed while the session is still open. This session has been closed.',
            warning: false
          },
          { status: 400 }
        )
      }

      // Session is open - check if 60 minutes have passed since last submission
      const lastSubmission = userSubmissionsInSession[0]
      const lastSubmissionTime = new Date(lastSubmission.created_at).getTime()
      const now = Date.now()
      const minutesSinceLastSubmission = (now - lastSubmissionTime) / (1000 * 60)

      if (minutesSinceLastSubmission < 60) {
        // Less than 60 minutes have passed - block second submission
        const minutesRemaining = Math.ceil(60 - minutesSinceLastSubmission)
        return NextResponse.json(
          { 
            error: `You have already submitted 1 track in this session. A second submission is allowed only after 60 minutes have passed since your last submission. Please wait ${minutesRemaining} more minute${minutesRemaining !== 1 ? 's' : ''}.`,
            warning: false
          },
          { status: 400 }
        )
      }
      // If 60+ minutes have passed and session is open, allow the second submission
    }

    // Check if this URL was already submitted in the current session (for duplicate URL check)
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
      // Block duplicate URL submissions in the same session
      return NextResponse.json(
        { 
          error: 'This track has already been submitted in this session. Each track can only be submitted once per session.',
          warning: false
        },
        { status: 400 }
      )
    }

    // Check if this URL was submitted in a previous session (for warning)
    let previousSessionWarning = false
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
