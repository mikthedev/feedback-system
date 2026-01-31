'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SoundCloudEmbed from '../components/SoundCloudEmbed'

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
    <div className="bg-background animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="pt-8 sm:pt-9 px-3 sm:px-4 md:px-5 pb-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <Link href="/dashboard" className="inline-flex items-center min-h-[48px] text-sm font-bold text-primary hover:text-primary-hover underline underline-offset-2 touch-manipulation">
            ← Dashboard
          </Link>
          <div className="bg-background-light rounded-xl shadow-lg p-4 md:p-5 animate-fade-in border-2 border-gray-700/60">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg shrink-0 border-2 border-amber-500/30">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-text-primary sm:text-xl tracking-tight">Carryover</h1>
                <p className="text-sm text-amber-400/90 mt-1 font-medium leading-snug">
                  Track skipped or session ended. You cannot submit again until 60 min after transfer.
                </p>
              </div>
            </div>
            {loading ? (
              <p className="text-xs text-text-secondary">Loading…</p>
            ) : myCarryover.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-text-secondary">No tracks in carryover.</p>
                <Link href="/dashboard" className="inline-flex items-center min-h-[40px] mt-3 px-3 py-2 rounded-lg bg-primary text-background font-semibold text-sm hover:bg-primary-hover transition-colors touch-manipulation sm:min-h-[36px] sm:rounded-md">
                  Back to Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myCarryover.map((item, index) => (
                  <div
                    key={item.id}
                    className="border-2 rounded-xl p-4 bg-background-lighter border-amber-500/40 animate-slide-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary line-clamp-2 sm:text-sm md:text-base">
                          {item.song_title || 'Untitled Track'}
                        </h3>
                        <p className="text-sm text-text-secondary mt-0.5 line-clamp-1">
                          by {item.artist_name || item.users?.display_name || '—'}
                          {item.session_number != null && ` · #${item.session_number}`}
                        </p>
                        <p className="text-xs text-amber-400 mt-2">
                          {item.carryover_type === 'curator_skip' ? 'Skipped by curator' : 'Session ended before review'}
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0 sm:rounded-button sm:px-2 sm:py-1">
                        Carryover
                      </span>
                    </div>
                    <div className="mt-2 sm:mt-3">
                      <SoundCloudEmbed
                        id={item.id}
                        embedHtml={embedData[item.id]?.html ?? null}
                        embedError={!!embedData[item.id]?.error}
                        soundcloudUrl={item.soundcloud_url}
                        embedUrl={getEmbedUrl(item.soundcloud_url)}
                      />
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
