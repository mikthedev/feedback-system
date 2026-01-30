import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Clear session only. We do not revoke Twitch tokens so the user can log in again
// with Twitch OAuth and enter their credentials next time.
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('session_user_id')
  cookieStore.delete('session_twitch_id')

  return NextResponse.json({ success: true })
}
