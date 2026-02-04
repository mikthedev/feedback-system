import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp, logXp, CARRYOVER_XP } from '@/lib/xp'
import { cookies } from 'next/headers'

// POST - Curator moves a submission to carryover (Skip)
// Only curator role can call this. Sets status='carryover', grants +25 XP to the user, and logs it.
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
      return NextResponse.json({ error: 'Forbidden: MikeGTC access required' }, { status: 403 })
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

    const submitterUserId = (submission as { user_id: string }).user_id

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'carryover', carryover_bonus_granted: true })
      .eq('id', id)

    if (updateError) throw updateError

    try {
      await addXp(supabase, submitterUserId, CARRYOVER_XP)
      await logXp(supabase, submitterUserId, CARRYOVER_XP, 'carryover', 'Track moved to carryover +25 XP')
    } catch (xpErr) {
      console.error('Error granting carryover XP on skip:', xpErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Submission moved to carryover',
    })
  } catch (error) {
    console.error('Error skipping submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
