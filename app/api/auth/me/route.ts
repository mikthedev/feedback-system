import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const u = user as Record<string, unknown>
    let xp = 0
    const v = u.xp
    if (typeof v === 'number' && !Number.isNaN(v)) xp = Math.max(0, Math.floor(v))
    else if (typeof v === 'string') {
      const n = parseInt(v, 10)
      if (!Number.isNaN(n)) xp = Math.max(0, n)
    }
    return NextResponse.json({ user: { ...u, xp } })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
