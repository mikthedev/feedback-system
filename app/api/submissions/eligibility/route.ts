import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export type SubmitBlockReason =
  | 'closed'
  | 'carryover_cooldown'
  | 'session_limit_closed'
  | 'session_limit_wait'
  | null

/**
 * GET — whether the current user can submit a new demo (mirrors POST /api/submissions gates,
 * without URL/TOTM checks).
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: config } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .maybeSingle()

    const submissionsOpen = config?.submissions_open !== false

    if (!submissionsOpen) {
      return NextResponse.json({
        can_submit: false,
        reason: 'closed' as SubmitBlockReason,
        minutes_remaining: null,
        submissions_open: false,
        has_pending: false,
        has_reviewed: false,
      })
    }

    const { data: currentSession } = await supabase
      .from('submission_sessions')
      .select('session_number, ended_at')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentSessionNumber = currentSession?.session_number ?? null
    const isSessionOpen = !!currentSession && currentSession.ended_at === null

    let hasPending = false
    let hasReviewed = false

    if (currentSessionNumber != null) {
      const { data: pendingRows } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('session_number', currentSessionNumber)
        .limit(1)
      hasPending = (pendingRows?.length ?? 0) > 0

      const { data: reviewedRows } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'reviewed')
        .eq('session_number', currentSessionNumber)
        .limit(1)
      hasReviewed = (reviewedRows?.length ?? 0) > 0
    } else {
      // No open session — still report any reviewed history for UI messaging
      const { data: anyReviewed } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'reviewed')
        .limit(1)
      hasReviewed = (anyReviewed?.length ?? 0) > 0
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userRow?.role !== 'tester') {
      let latestTransferredAt: string | null = null

      const { data: skipped } = await supabase
        .from('submissions')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('status', 'carryover')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (skipped?.updated_at) {
        latestTransferredAt = skipped.updated_at
      }

      const { data: closedSessions } = await supabase
        .from('submission_sessions')
        .select('session_number, ended_at')
        .not('ended_at', 'is', null)

      const closedNumbers = (closedSessions || []).map(
        (s: { session_number: number }) => s.session_number
      )

      if (closedNumbers.length > 0) {
        const { data: pendingClosed } = await supabase
          .from('submissions')
          .select('session_number')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .in('session_number', closedNumbers)

        if (pendingClosed && pendingClosed.length > 0) {
          const closedMap = new Map(
            (closedSessions || []).map(
              (s: { session_number: number; ended_at: string }) => [s.session_number, s.ended_at]
            )
          )
          for (const p of pendingClosed) {
            const endedAt = closedMap.get(p.session_number)
            if (
              endedAt &&
              (!latestTransferredAt || new Date(endedAt) > new Date(latestTransferredAt))
            ) {
              latestTransferredAt = endedAt
            }
          }
        }
      }

      if (latestTransferredAt) {
        const minutesSinceTransfer =
          (Date.now() - new Date(latestTransferredAt).getTime()) / (1000 * 60)
        if (minutesSinceTransfer < 60) {
          return NextResponse.json({
            can_submit: false,
            reason: 'carryover_cooldown' as SubmitBlockReason,
            minutes_remaining: Math.ceil(60 - minutesSinceTransfer),
            submissions_open: true,
            has_pending: hasPending,
            has_reviewed: hasReviewed,
          })
        }
      }
    }

    if (currentSessionNumber == null) {
      return NextResponse.json({
        can_submit: false,
        reason: 'closed' as SubmitBlockReason,
        minutes_remaining: null,
        submissions_open: submissionsOpen,
        has_pending: false,
        has_reviewed: hasReviewed,
      })
    }

    const { data: userSubmissionsInSession, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, created_at, status')
      .eq('user_id', userId)
      .eq('session_number', currentSessionNumber)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      console.error('Error checking eligibility submissions:', submissionsError)
      return NextResponse.json(
        { error: 'Error checking submission eligibility' },
        { status: 500 }
      )
    }

    const submissionCount = userSubmissionsInSession?.length || 0
    if (submissionCount >= 1) {
      if (!isSessionOpen) {
        return NextResponse.json({
          can_submit: false,
          reason: 'session_limit_closed' as SubmitBlockReason,
          minutes_remaining: null,
          submissions_open: true,
          has_pending: hasPending,
          has_reviewed: hasReviewed || userSubmissionsInSession.some((s) => s.status === 'reviewed'),
        })
      }

      const lastSubmission = userSubmissionsInSession[0]
      const minutesSinceLastSubmission =
        (Date.now() - new Date(lastSubmission.created_at).getTime()) / (1000 * 60)

      if (minutesSinceLastSubmission < 60) {
        return NextResponse.json({
          can_submit: false,
          reason: 'session_limit_wait' as SubmitBlockReason,
          minutes_remaining: Math.ceil(60 - minutesSinceLastSubmission),
          submissions_open: true,
          has_pending: hasPending,
          has_reviewed:
            hasReviewed || userSubmissionsInSession.some((s) => s.status === 'reviewed'),
        })
      }
    }

    return NextResponse.json({
      can_submit: true,
      reason: null as SubmitBlockReason,
      minutes_remaining: null,
      submissions_open: true,
      has_pending: hasPending,
      has_reviewed: hasReviewed,
    })
  } catch (error) {
    console.error('Error in GET /api/submissions/eligibility:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
