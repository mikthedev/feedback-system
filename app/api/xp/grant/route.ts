import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addXp, deductXp, logXp } from '@/lib/xp'
import { cookies } from 'next/headers'

/**
 * POST - Grant XP to a user (or self). Curator role only.
 * Body: { user_id?: string, amount: number }. If user_id omitted, grants to self.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const curatorId = cookieStore.get('session_user_id')?.value

    if (!curatorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: me } = await supabase
      .from('users')
      .select('role, display_name')
      .eq('id', curatorId)
      .single()

    if ((me as { role?: string } | null)?.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: Curator only' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = typeof body.amount === 'number' ? Math.round(body.amount) : 0
    const targetUserId = typeof body.user_id === 'string' && body.user_id.trim() ? body.user_id.trim() : curatorId

    if (amount === 0) {
      return NextResponse.json({ error: 'Amount must be a non-zero number' }, { status: 400 })
    }

    const { data: target } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', targetUserId)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isSelf = targetUserId === curatorId
    const newTotal = amount > 0
      ? await addXp(supabase, targetUserId, amount)
      : await deductXp(supabase, targetUserId, Math.abs(amount))

    await logXp(
      supabase,
      targetUserId,
      amount,
      'curator_grant',
      amount > 0
        ? (isSelf ? `Curator granted +${amount} XP (self)` : `Curator granted +${amount} XP`)
        : (isSelf ? `Curator deducted ${amount} XP (self)` : `Curator deducted ${Math.abs(amount)} XP`)
    )

    const absAmount = Math.abs(amount)
    const message = amount > 0
      ? (isSelf ? `Granted ${absAmount} XP to yourself.` : `Granted ${absAmount} XP to ${(target as { display_name?: string }).display_name ?? 'user'}.`)
      : (isSelf ? `Deducted ${absAmount} XP from yourself.` : `Deducted ${absAmount} XP from ${(target as { display_name?: string }).display_name ?? 'user'}.`)

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      amount,
      new_total: newTotal,
      message,
    })
  } catch (e) {
    console.error('POST /api/xp/grant error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
