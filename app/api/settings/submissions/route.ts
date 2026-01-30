import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp } from '@/lib/xp'
import { CARRYOVER_XP } from '@/lib/xp'
import { cookies } from 'next/headers'

// GET - Get submissions status (app_config.submissions_open)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { data: config, error } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    const submissionsOpen = config?.submissions_open ?? true

    return NextResponse.json({ submissions_open: submissionsOpen })
  } catch (error) {
    console.error('Error fetching submissions status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Toggle submissions status (curator only)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { submissions_open } = body

    if (typeof submissions_open !== 'boolean') {
      return NextResponse.json({ error: 'submissions_open must be a boolean' }, { status: 400 })
    }

    const { data: current, error: fetchError } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError
    const currentlyOpen = current?.submissions_open ?? true
    const rowExists = !fetchError

    if (rowExists) {
      const { error: updateError } = await supabase
        .from('app_config')
        .update({ submissions_open })
        .eq('id', 1)
      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('app_config')
        .insert({ id: 1, submissions_open })
      if (insertError) throw insertError
    }

    if (submissions_open && !currentlyOpen) {
      const { data: newSessionNumber, error: sessionError } = await supabase.rpc('get_or_create_current_session')
      if (sessionError) {
        console.error('Error creating session:', sessionError)
      } else if (newSessionNumber != null) {
        const { data: closedSessions } = await supabase
          .from('submission_sessions')
          .select('session_number')
          .not('ended_at', 'is', null)
        const closedNumbers = (closedSessions || []).map((s: { session_number: number }) => s.session_number)
        if (closedNumbers.length > 0) {
          const { data: carryoverRows } = await supabase
            .from('submissions')
            .select('id, user_id, soundcloud_url, created_at')
            .eq('status', 'pending')
            .in('session_number', closedNumbers)
            .order('created_at', { ascending: true })
          const seen = new Map<string, string>()
          for (const row of carryoverRows || []) {
            const key = `${row.user_id}:${row.soundcloud_url}`
            if (!seen.has(key)) seen.set(key, row.id)
          }
          const idsToMove = Array.from(seen.values())
          if (idsToMove.length > 0) {
            await supabase
              .from('submissions')
              .update({ session_number: newSessionNumber })
              .in('id', idsToMove)
          }
        }
      }
    } else if (!submissions_open && currentlyOpen) {
      const { data: openRow } = await supabase
        .from('submission_sessions')
        .select('id, session_number')
        .is('ended_at', null)
        .order('session_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (openRow) {
        const sn = (openRow as { session_number: number }).session_number
        const { data: pending } = await supabase
          .from('submissions')
          .select('id, user_id, carryover_bonus_granted')
          .eq('status', 'pending')
          .eq('session_number', sn)
        for (const row of pending || []) {
          const r = row as { id: string; user_id: string; carryover_bonus_granted: boolean }
          if (!r.carryover_bonus_granted) {
            try {
              await addXp(supabase, r.user_id, CARRYOVER_XP)
            } catch (e) {
              console.error('Carryover XP grant error:', e)
            }
            await supabase
              .from('submissions')
              .update({ carryover_bonus_granted: true })
              .eq('id', r.id)
          }
        }
        const { error: updateErr } = await supabase
          .from('submission_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', openRow.id)
        if (updateErr) {
          const { error: rpcErr } = await supabase.rpc('close_current_session')
          if (rpcErr) console.error('Close session failed (direct update and RPC):', updateErr, rpcErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      submissions_open: submissions_open,
      message: submissions_open ? 'Submissions opened' : 'Submissions closed',
    })
  } catch (error) {
    console.error('Error updating submissions status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
