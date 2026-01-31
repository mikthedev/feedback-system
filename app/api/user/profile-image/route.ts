import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

async function refreshTwitchToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.access_token) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : 0,
  }
}

/**
 * GET - Returns the current user's Twitch profile image URL.
 * If not stored, fetches from Twitch API (using stored token), updates user, returns URL.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, profile_image_url')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingUrl =
      typeof (user as { profile_image_url?: string | null }).profile_image_url === 'string'
        ? (user as { profile_image_url: string }).profile_image_url.trim()
        : ''
    if (existingUrl) {
      return NextResponse.json({ url: existingUrl })
    }

    const { data: tok } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single()

    const t = tok as { access_token?: string; refresh_token?: string; expires_at?: string } | null
    let accessToken = t?.access_token
    const refreshToken = t?.refresh_token
    const exp = t?.expires_at ? new Date(t.expires_at).getTime() : 0
    const now = Date.now()
    const isExpired = exp <= now + 60_000

    if (isExpired && refreshToken?.trim()) {
      const refreshed = await refreshTwitchToken(refreshToken)
      if (refreshed) {
        const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString()
        await supabase
          .from('user_tokens')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        accessToken = refreshed.access_token
      }
    }

    if (!accessToken) {
      return NextResponse.json({ url: null })
    }

    const helixRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
      },
    })

    if (!helixRes.ok) {
      return NextResponse.json({ url: null })
    }

    const helixData = (await helixRes.json()) as { data?: Array<{ profile_image_url?: string }> }
    const first = helixData?.data?.[0]
    const profileImageUrl =
      typeof first?.profile_image_url === 'string' ? first.profile_image_url.trim() : ''

    if (profileImageUrl) {
      await supabase
        .from('users')
        .update({
          profile_image_url: profileImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }

    return NextResponse.json({ url: profileImageUrl || null })
  } catch (error) {
    console.error('Profile image fetch error:', error)
    return NextResponse.json({ url: null })
  }
}
