import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp, logXp } from '@/lib/xp'
import { SUB_OR_DONATION_XP } from '@/lib/xp'
import { cookies } from 'next/headers'

/**
 * POST - Grant +20 donation XP to a user (curator only). Body: { user_id: string }.
 * Once per session per user. XP stored in Supabase (users.xp).
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const curatorId = cookieStore.get('session_user_id')?.value

    if (!curatorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: curator, error: curatorError } = await supabase
      .from('users')
      .select('role')
      .eq('id', curatorId)
      .single()

    if (curatorError || !curator || curator.role !== 'curator') {
      return NextResponse.json(
        { error: 'Forbidden: Curator access required' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data: currentSession } = await supabase
      .from('submission_sessions')
      .select('session_number')
      .is('ended_at', null)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentSession?.session_number) {
      return NextResponse.json(
        { error: 'No open session; cannot grant donation XP' },
        { status: 400 }
      )
    }

    const sn = currentSession.session_number
    const { data: usx } = await supabase
      .from('user_session_xp')
      .select('donation_xp_granted, external_xp_this_session')
      .eq('user_id', userId)
      .eq('session_number', sn)
      .maybeSingle()

    const u = usx as { donation_xp_granted?: boolean; external_xp_this_session?: number } | null
    const granted = u?.donation_xp_granted ?? false
    if (granted) {
      return NextResponse.json(
        { error: 'Donation XP already granted for this user this session' },
        { status: 400 }
      )
    }

    await addXp(supabase, userId, SUB_OR_DONATION_XP)
    await logXp(supabase, userId, SUB_OR_DONATION_XP, 'donation', 'Donation +20 XP (this session)')
    const prevExternal = Math.max(0, Math.floor(Number(u?.external_xp_this_session ?? 0)))
    await supabase.from('user_session_xp').upsert(
      {
        user_id: userId,
        session_number: sn,
        donation_xp_granted: true,
        external_xp_this_session: prevExternal + SUB_OR_DONATION_XP,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_number' }
    )

    return NextResponse.json({
      success: true,
      message: `+${SUB_OR_DONATION_XP} donation XP granted`,
    })
  } catch (e) {
    console.error('POST /api/xp/grant-donation error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
