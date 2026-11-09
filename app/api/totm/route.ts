import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicTotmPayload } from '@/lib/totm'

// Always fresh — simulation seed and live ranking must appear immediately
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET — public Top of the Month (current + history). No curator scores. */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const payload = await getPublicTotmPayload(supabase)
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('GET /api/totm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
