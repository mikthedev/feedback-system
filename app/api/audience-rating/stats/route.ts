import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAudienceAggregate } from '@/lib/audience-rating'

// GET — Curator-only: aggregate chat ratings for a submission (?submission_id=)
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const submissionId = request.nextUrl.searchParams.get('submission_id')
    if (!submissionId || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
      return NextResponse.json({ error: 'Invalid submission_id' }, { status: 400 })
    }

    const agg = await getAudienceAggregate(supabase, submissionId)
    return NextResponse.json({
      submission_id: submissionId,
      vote_count: agg.count,
      average: agg.average,
    })
  } catch (e) {
    console.error('audience-rating stats GET:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
