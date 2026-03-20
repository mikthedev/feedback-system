import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

function parseXp(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.floor(v))
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (!Number.isNaN(n)) return Math.max(0, n)
  }
  return 0
}

/**
 * GET — Stored XP for all users with xp > 0. Curator only.
 * Sorted by XP descending.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('users').select('role').eq('id', userId).single()

    if ((me as { role?: string } | null)?.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: Curator only' }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from('users')
      .select('id, display_name, xp')
      .gt('xp', 0)
      .order('xp', { ascending: false })

    if (error) throw error

    const users = (rows ?? []).map((r: { id: string; display_name: string | null; xp?: unknown }) => ({
      id: r.id,
      display_name: r.display_name ?? 'Unknown',
      xp: parseXp(r.xp),
    }))

    return NextResponse.json({ users })
  } catch (e) {
    console.error('GET /api/users/xp error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
