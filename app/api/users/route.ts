import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

/**
 * GET - List users (id, display_name). Curator role only.
 * Used for the "Grant XP" dropdown.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if ((me as { role?: string } | null)?.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: Curator only' }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from('users')
      .select('id, display_name')
      .order('display_name', { ascending: true })

    if (error) throw error

    const users = (rows ?? []).map((r: { id: string; display_name: string | null }) => ({
      id: r.id,
      display_name: r.display_name ?? 'Unknown',
    }))

    return NextResponse.json({ users })
  } catch (e) {
    console.error('GET /api/users error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
