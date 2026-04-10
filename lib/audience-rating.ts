import type { SupabaseClient } from '@supabase/supabase-js'

/** Parse Twitch chat messages like `!rate "7"` or `!rate 10` (1–10 only). Trailing text/emotes allowed. */
export function parseRateCommand(message: string): number | null {
  const m = message.trim().match(/^!rate\s+"?(\d{1,2})"?\b/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (Number.isNaN(n) || n < 1 || n > 10) return null
  return n
}

/** First pending submission in the active session (same ordering as queue API). */
export async function getFirstPendingSubmissionId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: currentSession, error: sessionError } = await supabase
    .from('submission_sessions')
    .select('session_number')
    .is('ended_at', null)
    .order('session_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) throw sessionError
  const sn = currentSession?.session_number
  if (sn == null) return null

  const { data: row, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('status', 'pending')
    .eq('session_number', sn)
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (row as { id?: string } | null)?.id ?? null
}

export async function getAudienceAggregate(
  supabase: SupabaseClient,
  submissionId: string
): Promise<{ count: number; average: number | null }> {
  const { data, error } = await supabase
    .from('audience_chat_ratings')
    .select('score')
    .eq('submission_id', submissionId)

  if (error) throw error
  const rows = (data ?? []) as { score: number }[]
  if (rows.length === 0) return { count: 0, average: null }
  const sum = rows.reduce((s, r) => s + r.score, 0)
  const average = Math.round((sum / rows.length) * 10) / 10
  return { count: rows.length, average }
}
