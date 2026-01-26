import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSoundCloudUrl, normalizeSoundCloudUrl } from '@/lib/validators'
import { cookies } from 'next/headers'

// GET - Fetch a single submission by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error

    // Check if user owns this submission
    if (submission.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Error fetching submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update submission (only if pending)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { soundcloud_url, description, artist_name, song_title } = body

    const supabase = createAdminClient()
    
    // First, check if submission exists and belongs to user
    const { data: existingSubmission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingSubmission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (existingSubmission.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow editing if status is pending
    if (existingSubmission.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot edit submission that has already been reviewed' },
        { status: 400 }
      )
    }

    // Validate SoundCloud URL if provided
    let normalizedUrl = existingSubmission.soundcloud_url
    if (soundcloud_url) {
      if (!validateSoundCloudUrl(soundcloud_url)) {
        return NextResponse.json(
          { error: 'Invalid SoundCloud URL. Must be a valid SoundCloud track URL.' },
          { status: 400 }
        )
      }
      normalizedUrl = normalizeSoundCloudUrl(soundcloud_url)
    }

    // Update submission
    const { data: submission, error: updateError } = await supabase
      .from('submissions')
      .update({
        soundcloud_url: normalizedUrl,
        description: description?.trim() || null,
        artist_name: artist_name?.trim() || null,
        song_title: song_title?.trim() || null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      submission,
      message: 'Submission updated successfully'
    })
  } catch (error) {
    console.error('Error updating submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
