import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', tokenResponse.status, errorText)
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} - ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token ?? ''
    const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 0
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Get user info from Twitch
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('User info fetch failed:', userResponse.status, errorText)
      throw new Error(`Failed to fetch user info: ${userResponse.status} - ${errorText}`)
    }

    const userData = await userResponse.json()
    const twitchUser = userData.data[0]
    
    if (!twitchUser) {
      throw new Error('No user data returned from Twitch API')
    }

    // Create or update user in Supabase
    const supabase = createAdminClient()
    
    // Check if user exists
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('twitch_id', twitchUser.id)
      .maybeSingle()
    
    // maybeSingle() returns null if no row found, but still check for actual errors
    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
      throw queryError
    }

    let userId: string

    const rawUrl =
      (typeof (twitchUser as { profile_image_url?: string }).profile_image_url === 'string'
        ? (twitchUser as { profile_image_url: string }).profile_image_url.trim()
        : '') ||
      (typeof (twitchUser as { profileImageUrl?: string }).profileImageUrl === 'string'
        ? (twitchUser as { profileImageUrl: string }).profileImageUrl.trim()
        : '')
    const profileImageUrl = rawUrl || null

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          display_name: twitchUser.display_name,
          email: twitchUser.email || existingUser.email,
          profile_image_url: profileImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('twitch_id', twitchUser.id)
        .select()
        .single()

      if (updateError) throw updateError
      userId = updatedUser.id
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          twitch_id: twitchUser.id,
          display_name: twitchUser.display_name,
          email: twitchUser.email,
          role: 'user',
          profile_image_url: profileImageUrl,
        })
        .select()
        .single()

      if (insertError) throw insertError
      userId = newUser.id
    }

    // Create a session token (simplified - in production, use proper JWT)
    // For this MVP, we'll use a simple cookie-based session
    const cookieStore = await cookies()
    cookieStore.set('session_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    cookieStore.set('session_twitch_id', twitchUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    // Persist Twitch tokens for follow/sub checks (user_tokens)
    await supabase.from('user_tokens').upsert(
      {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken || '',
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Twitch callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.redirect(new URL(`/?error=callback_failed&details=${encodeURIComponent(errorMessage)}`, request.url))
  }
}
