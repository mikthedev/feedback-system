import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reviewSchema } from '@/lib/validators'
import { addXp, curatorAverage, curatorXpFromAverage } from '@/lib/xp'
import { cookies } from 'next/headers'

// POST - Create review (curator only)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Validate review data
    const validatedData = reviewSchema.parse({
      ...body,
      sound_score: parseFloat(body.sound_score),
      structure_score: parseFloat(body.structure_score),
      mix_score: parseFloat(body.mix_score),
      vibe_score: parseFloat(body.vibe_score),
    })

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('submission_id', validatedData.submission_id)
      .eq('curator_id', userId)
      .single()

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this submission' },
        { status: 400 }
      )
    }

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        submission_id: validatedData.submission_id,
        curator_id: userId,
        sound_score: validatedData.sound_score,
        structure_score: validatedData.structure_score,
        mix_score: validatedData.mix_score,
        vibe_score: validatedData.vibe_score,
      })
      .select()
      .single()

    if (reviewError) throw reviewError

    // Update submission status to reviewed
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'reviewed' })
      .eq('id', validatedData.submission_id)

    if (updateError) throw updateError

    // Grant curator XP to the submitter (not the curator)
    const { data: submission, error: subErr } = await supabase
      .from('submissions')
      .select('user_id')
      .eq('id', validatedData.submission_id)
      .single()

    if (!subErr && submission?.user_id) {
      const avg = curatorAverage(
        validatedData.sound_score,
        validatedData.structure_score,
        validatedData.mix_score,
        validatedData.vibe_score
      )
      const xpAmount = curatorXpFromAverage(avg)
      if (xpAmount > 0) {
        try {
          await addXp(supabase, submission.user_id, xpAmount)
        } catch (e) {
          console.error('Curator XP grant error:', e)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      review,
      message: 'Review submitted successfully'
    })
  } catch (error: any) {
    console.error('Error creating review:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid review data', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
