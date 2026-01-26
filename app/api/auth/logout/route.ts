import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('session_user_id')
  cookieStore.delete('session_twitch_id')

  return NextResponse.json({ success: true })
}
