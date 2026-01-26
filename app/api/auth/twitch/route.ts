import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const redirectUri = searchParams.get('redirect_uri') || process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI!
  
  const twitchAuthUrl = new URL('https://id.twitch.tv/oauth2/authorize')
  twitchAuthUrl.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID!)
  twitchAuthUrl.searchParams.set('redirect_uri', redirectUri)
  twitchAuthUrl.searchParams.set('response_type', 'code')
  twitchAuthUrl.searchParams.set('scope', 'user:read:email')
  twitchAuthUrl.searchParams.set('state', 'random_state_string') // In production, use a secure random string

  return NextResponse.redirect(twitchAuthUrl.toString())
}
