import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch SoundCloud oEmbed data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url || (!url.includes('soundcloud.com') && !url.includes('on.soundcloud.com'))) {
      return NextResponse.json({ error: 'Invalid SoundCloud URL' }, { status: 400 })
    }

    // Clean URL - remove UTM parameters but keep si parameter
    let cleanUrl = url
    try {
      const urlObj = new URL(url)
      const cleanParams = new URLSearchParams()
      const siParam = urlObj.searchParams.get('si')
      if (siParam) {
        cleanParams.set('si', siParam)
      }
      cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
    } catch (error) {
      // Use original URL if parsing fails
    }

    // Call SoundCloud oEmbed API
    const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
    
    const response = await fetch(oembedUrl)
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch embed data' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching oEmbed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
