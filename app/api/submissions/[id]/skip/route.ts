import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// POST - Curator moves a submission to carryover (Skip)
// Only curator role can call this. Sets status='carryover'.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || !user || user.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: Curator access required' }, { status: 403 })
    }

    const { id } = await params

    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('id, status, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (submission.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending submissions can be skipped to carryover' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'carryover' })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: 'Submission moved to carryover',
    })
  } catch (error) {
    console.error('Error skipping submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
