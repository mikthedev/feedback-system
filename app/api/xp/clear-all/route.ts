import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const BATCH_SIZE = 200

/**
 * POST - Clear all users' XP (curator only). Sets users.xp = 0 for every user.
 * XP is stored per-user in Supabase (users.xp). Uses batch UPDATE, no RPC required.
 */
export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: curator, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || !curator || curator.role !== 'curator') {
      return NextResponse.json(
        { error: 'Forbidden: MikeGTC access required' },
        { status: 403 }
      )
    }

    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id')

    if (fetchError) throw fetchError
    const ids = (users ?? []).map((u: { id: string }) => u.id)
    if (ids.length === 0) {
      return NextResponse.json({ success: true, message: 'All XP cleared', cleared: 0 })
    }

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error: updateError } = await supabase
        .from('users')
        .update({ xp: 0 })
        .in('id', batch)
      if (updateError) throw updateError
    }

    return NextResponse.json({
      success: true,
      message: 'All XP cleared',
      cleared: ids.length,
    })
  } catch (e) {
    console.error('POST /api/xp/clear-all error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
