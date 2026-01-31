'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CarryoverItem {
  id: string
  user_id: string
  soundcloud_url: string
  song_title?: string
  artist_name?: string
  session_number?: number
  created_at: string
  carryover_type: 'session_ended' | 'curator_skip'
  transferred_at: string
  users?: { display_name: string }
}

interface EmbedData {
  html?: string
  error?: string
}

function getEmbedUrl(url: string): string {
  if (!url || (!url.includes('soundcloud.com') && !url.includes('on.soundcloud.com'))) return ''
  try {
    const urlObj = new URL(url)
    const cleanParams = new URLSearchParams()
    const siParam = urlObj.searchParams.get('si')
    if (siParam) cleanParams.set('si', siParam)
    const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  } catch {
    const cleaned = url.trim().split('#')[0]
    const siMatch = cleaned.match(/[?&]si=([^&]+)/)
    const baseUrl = cleaned.split('?')[0].replace(/\/$/, '')
    const final = siMatch ? `${baseUrl}?si=${siMatch[1]}` : baseUrl
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(final)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
  }
}

export default function CarryoverPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; display_name: string } | null>(null)
  const [carryover, setCarryover] = useState<CarryoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [embedData, setEmbedData] = useState<Record<string, EmbedData>>({})

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        setUser(data.user)
      } catch {
        router.push('/')
      }
    }
    fetchUser()
  }, [router])

  useEffect(() => {
    const fetchCarryover = async () => {
      try {
        const res = await fetch('/api/submissions/carryover')
        if (res.ok) {
          const data = await res.json()
          const all = data.carryover || []
          setCarryover(all)
          // Fetch embeds for user's own carryover
          const myItems = user ? all.filter((s: CarryoverItem) => s.user_id === user.id) : []
          const embedPromises = myItems.map(async (s: CarryoverItem) => {
            try {
              const er = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(s.soundcloud_url)}`)
              const d = er.ok ? await er.json() : null
              return { id: s.id, data: d?.html ? { html: d.html } : { error: 'Failed to load' } }
            } catch {
              return { id: s.id, data: { error: 'Failed to load' } }
            }
          })
          const results = await Promise.all(embedPromises)
          const map: Record<string, EmbedData> = {}
          results.forEach(({ id, data }) => { map[id] = data })
          setEmbedData(map)
        }
      } catch (e) {
        console.error('Error fetching carryover:', e)
      } finally {
        setLoading(false)
      }
    }
    if (user) fetchCarryover()
  }, [user?.id])

  if (!user) return null

  const myCarryover = carryover.filter((s) => s.user_id === user.id)

  return (
    <div className="min-h-screen bg-background animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="pt-10 sm:pt-12 md:pt-14 px-2 sm:px-3 md:p-4">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-primary hover:text-primary-hover text-[11px] sm:text-sm font-medium underline underline-offset-2 touch-manipulation">
              ← Dashboard
            </Link>
          </div>
          <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-5 animate-fade-in border border-gray-800/50">
            <div className="flex items-start gap-2 sm:gap-3 mb-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-md sm:rounded-lg shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-text-primary">Carryover</h1>
                <p className="text-[11px] sm:text-xs text-amber-400/90 mt-0.5">
                  Track skipped or session ended. You cannot submit again until 60 min after transfer.
                </p>
              </div>
            </div>
            {loading ? (
              <p className="text-text-secondary text-xs sm:text-sm">Loading…</p>
            ) : myCarryover.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <p className="text-text-secondary text-xs sm:text-sm">No tracks in carryover.</p>
                <Link href="/dashboard" className="inline-block mt-2 text-primary hover:text-primary-hover font-medium text-[11px] sm:text-sm touch-manipulation">
                  Back to Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {myCarryover.map((item, index) => (
                  <div
                    key={item.id}
                    className="border rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 bg-background-lighter border-amber-500/30 animate-slide-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5 sm:mb-2">
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm md:text-base font-semibold text-text-primary line-clamp-1">
                          {item.song_title || 'Untitled Track'}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5 line-clamp-1">
                          by {item.artist_name || item.users?.display_name || '—'}
                          {item.session_number != null && ` · #${item.session_number}`}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-amber-400 mt-1.5">
                          {item.carryover_type === 'curator_skip' ? 'Skipped by curator' : 'Session ended before review'}
                        </p>
                      </div>
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-button text-[10px] sm:text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
                        Carryover
                      </span>
                    </div>
                    <div className="mt-2 sm:mt-3">
                      {embedData[item.id]?.html ? (
                        <div
                          className="soundcloud-embed w-full"
                          style={{ maxWidth: '100%', overflow: 'hidden' }}
                          dangerouslySetInnerHTML={{ __html: embedData[item.id].html || '' }}
                        />
                      ) : embedData[item.id]?.error ? (
                        <iframe
                          width="100%"
                          height="166"
                          scrolling="no"
                          frameBorder="no"
                          allow="autoplay"
                          src={getEmbedUrl(item.soundcloud_url)}
                          className="rounded"
                          title="SoundCloud Player"
                        />
                      ) : (
                        <iframe
                          width="100%"
                          height="166"
                          scrolling="no"
                          frameBorder="no"
                          allow="autoplay"
                          src={getEmbedUrl(item.soundcloud_url)}
                          className="rounded"
                          title="SoundCloud Player"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
