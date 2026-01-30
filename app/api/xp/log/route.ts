import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

/** GET - Current user's XP log (description + timestamp per occurrence). */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100)

    const { data, error } = await supabase
      .from('xp_log')
      .select('id, amount, source, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('GET /api/xp/log error:', error)
      return NextResponse.json({ log: [] })
    }

    return NextResponse.json({
      log: (data ?? []).map((row) => ({
        id: row.id,
        amount: row.amount,
        source: row.source,
        description: row.description ?? undefined,
        created_at: row.created_at,
      })),
    })
  } catch (e) {
    console.error('GET /api/xp/log error:', e)
    return NextResponse.json({ log: [] })
  }
}
