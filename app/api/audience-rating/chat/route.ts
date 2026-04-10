import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getFirstPendingSubmissionId,
  parseRateCommand,
} from '@/lib/audience-rating'

export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    twitch_user_id: z.string().min(1).max(64),
    twitch_login: z.string().min(1).max(80).optional(),
    score: z.number().int().min(1).max(10).optional(),
    message: z.string().min(1).max(500).optional(),
  })
  .refine((d) => d.score != null || (d.message != null && d.message.trim() !== ''), {
    message: 'Provide score (1–10) or a chat message to parse',
  })

function verifyChatSecret(request: NextRequest): boolean {
  const secret = process.env.AUDIENCE_RATING_CHAT_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim() === secret
  }
  return (request.headers.get('x-audience-rating-secret') ?? '').trim() === secret
}

/**
 * POST — Record a viewer rating for the **first** queued track.
 * Secured with AUDIENCE_RATING_CHAT_SECRET (Bearer token or x-audience-rating-secret).
 *
 * Body: { twitch_user_id, twitch_login?, score? | message? }
 * If `message` is set, parses `!rate "n"` / `!rate n` from it.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.AUDIENCE_RATING_CHAT_SECRET?.trim()) {
      return NextResponse.json(
        { error: 'Audience chat ratings are not configured' },
        { status: 503 }
      )
    }
    if (!verifyChatSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let score = parsed.data.score ?? null
    if (score == null && parsed.data.message) {
      score = parseRateCommand(parsed.data.message)
    }
    if (score == null) {
      return NextResponse.json(
        { error: 'Could not parse rating (use !rate "1" through !rate "10")' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const submissionId = await getFirstPendingSubmissionId(supabase)
    if (!submissionId) {
      return NextResponse.json(
        { error: 'No pending song in queue', ok: false },
        { status: 404 }
      )
    }

    const { error: upsertError } = await supabase.from('audience_chat_ratings').upsert(
      {
        submission_id: submissionId,
        twitch_user_id: parsed.data.twitch_user_id,
        twitch_login: parsed.data.twitch_login?.trim() || null,
        score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'submission_id,twitch_user_id' }
    )

    if (upsertError) {
      const msg = upsertError.message ?? ''
      if (msg.includes('audience_chat_ratings') || msg.includes('schema cache')) {
        return NextResponse.json(
          {
            error:
              'Database table missing. Run supabase/migrations/010_audience_chat_ratings.sql in the Supabase SQL editor.',
          },
          { status: 503 }
        )
      }
      throw upsertError
    }

    const { data: rows } = await supabase
      .from('audience_chat_ratings')
      .select('score')
      .eq('submission_id', submissionId)

    const list = (rows ?? []) as { score: number }[]
    const count = list.length
    const average =
      count === 0
        ? null
        : Math.round((list.reduce((s, r) => s + r.score, 0) / count) * 10) / 10

    return NextResponse.json({
      ok: true,
      submission_id: submissionId,
      score,
      vote_count: count,
      average,
    })
  } catch (e: unknown) {
    console.error('audience-rating chat POST:', e)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('audience_chat_ratings')) {
      return NextResponse.json(
        {
          error:
            'Database table missing. Run supabase/migrations/010_audience_chat_ratings.sql in the Supabase SQL editor.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
