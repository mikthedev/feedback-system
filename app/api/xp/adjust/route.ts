import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

/**
 * POST - Adjust current user's XP (tester role only). Body: { delta: number }.
 * Positive = add, negative = remove. XP is clamped to >= 0.
 */
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
      .select('role, xp')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'tester') {
      return NextResponse.json(
        { error: 'Forbidden: Tester role required to adjust XP' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const delta = typeof body.delta === 'number' ? Math.round(body.delta) : 0

    const parseXp = (v: unknown): number => {
      if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.floor(v))
      if (typeof v === 'string') {
        const n = parseInt(v, 10)
        if (!Number.isNaN(n)) return Math.max(0, n)
      }
      return 0
    }
    const current = parseXp((user as { xp?: unknown }).xp)

    if (delta === 0) return NextResponse.json({ xp: current })

    const next = Math.max(0, current + delta)

    const { error: updateError } = await supabase
      .from('users')
      .update({ xp: next })
      .eq('id', userId)

    if (updateError) throw updateError

    return NextResponse.json({ xp: next, delta })
  } catch (error) {
    console.error('XP adjust error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
