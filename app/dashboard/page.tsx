'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  display_name: string
  role: string
}

interface Submission {
  id: string
  soundcloud_url: string
  description?: string
  artist_name?: string
  song_title?: string
  status: string
  session_number?: number
  created_at: string
  reviews?: Array<{
    sound_score: number
    structure_score: number
    mix_score: number
    vibe_score: number
    created_at: string
  }>
}

interface EmbedData {
  html?: string
  error?: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [embedData, setEmbedData] = useState<Record<string, EmbedData>>({})
  const [submissionsOpen, setSubmissionsOpen] = useState(true)
  const [bannerState, setBannerState] = useState<'visible' | 'hidden' | 'below'>('visible')
  const [lastScrollY, setLastScrollY] = useState(0)
  const [isScrollingUp, setIsScrollingUp] = useState(false)

  useEffect(() => {
    fetchUser()
    fetchSubmissions()
    fetchSubmissionsStatus()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollThreshold = 50
      const wasScrollingUp = currentScrollY < lastScrollY
      
      setIsScrollingUp(wasScrollingUp)
      
      // Determine banner state based on scroll position and direction
      if (currentScrollY < 10) {
        // At the top - show banner normally
        setBannerState('visible')
      } else if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
        // Scrolling down - move banner below Welcome panel
        setBannerState('below')
      } else if (wasScrollingUp) {
        // Scrolling up - show banner with slide-in animation
        setBannerState('visible')
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const fetchSubmissionsStatus = async () => {
    try {
      const response = await fetch('/api/settings/submissions')
      if (response.ok) {
        const data = await response.json()
        setSubmissionsOpen(data.submissions_open)
      }
    } catch (error) {
      console.error('Error fetching submissions status:', error)
    }
  }

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
        router.push('/')
        return
      }
      const data = await response.json()
      setUser(data.user)
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/submissions')
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
        
        // Try to fetch embed data for each submission
        const embedPromises = (data.submissions || []).map(async (submission: Submission) => {
          try {
            const embedResponse = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(submission.soundcloud_url)}`)
            if (embedResponse.ok) {
              const embedResult = await embedResponse.json()
              return { id: submission.id, data: { html: embedResult.html } }
            } else {
              return { id: submission.id, data: { error: 'Failed to load embed' } }
            }
          } catch (error) {
            return { id: submission.id, data: { error: 'Failed to load embed' } }
          }
        })
        
        const embedResults = await Promise.all(embedPromises)
        const embedMap: Record<string, EmbedData> = {}
        embedResults.forEach(({ id, data }) => {
          embedMap[id] = data
        })
        setEmbedData(embedMap)
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  // Convert SoundCloud URL to embed URL - simplified approach
  const getEmbedUrl = (url: string) => {
    if (!url || !url.includes('soundcloud.com')) return ''
    
    try {
      // Clean URL - remove UTM parameters but keep everything else
      const urlObj = new URL(url)
      const cleanParams = new URLSearchParams()
      
      // Keep only 'si' parameter if it exists (for private tracks)
      const siParam = urlObj.searchParams.get('si')
      if (siParam) {
        cleanParams.set('si', siParam)
      }
      
      // Reconstruct clean URL
      const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
      
      // Simple SoundCloud embed format
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
    } catch (error) {
      // Fallback: minimal cleaning
      let cleaned = url.trim().split('#')[0]
      // Remove UTM params but keep si
      const siMatch = cleaned.match(/[?&]si=([^&]+)/)
      const baseUrl = cleaned.split('?')[0].replace(/\/$/, '')
      
      if (siMatch) {
        cleaned = `${baseUrl}?si=${siMatch[1]}`
      } else {
        cleaned = baseUrl
      }
      
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleaned)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-text-primary">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Calculate banner position based on state
  const getBannerClasses = () => {
    if (bannerState === 'visible') {
      return 'opacity-100 translate-y-0'
    } else if (bannerState === 'below') {
      // Move down to position below Welcome panel (approximately 80px from top)
      return 'opacity-100 translate-y-[80px] md:translate-y-[90px]'
    } else {
      return 'opacity-0 -translate-y-full pointer-events-none'
    }
  }

  // Different animation when reappearing from scroll up
  const getBannerAnimation = () => {
    if (bannerState === 'visible' && isScrollingUp && lastScrollY > 10) {
      return 'animate-slide-down-in'
    }
    return ''
  }

  return (
    <div className="min-h-screen bg-background animate-page-transition">
      {/* Floating Status Banner */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${getBannerClasses()} ${getBannerAnimation()}`}
      >
        <div className="max-w-6xl mx-auto px-3 md:px-4 pt-2 pb-2">
          <div
            className={`rounded-lg px-4 py-2 shadow-md backdrop-blur-sm border ${
              submissionsOpen
                ? 'bg-primary/20 backdrop-blur-md text-primary border-primary/30'
                : 'bg-red-500/20 backdrop-blur-md text-red-400 border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-center">
              <span className="text-xs md:text-sm font-semibold uppercase tracking-wider">
                {submissionsOpen ? '✓ Submissions Open' : '✗ Submissions Closed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with consistent spacing */}
      <div className="pt-12 md:pt-14 p-3 md:p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="bg-background-light rounded-xl shadow-lg p-4 md:p-5 animate-fade-in border border-gray-800/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h1 className="text-lg md:text-xl font-bold text-text-primary">
                  Welcome, {user.display_name}!
                </h1>
                {user.role === 'curator' && (
                  <p className="text-text-secondary text-xs md:text-sm mt-0.5">
                    MikeGTC Dashboard
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {user.role === 'curator' && (
                  <Link
                    href="/curator"
                    className="bg-primary hover:bg-primary-hover active:bg-primary-active text-background px-3 py-1.5 rounded-button transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press text-xs md:text-sm font-medium"
                  >
                    MikeGTC Panel
                  </Link>
                )}
                <Link
                  href="/submit"
                  className="bg-primary hover:bg-primary-hover active:bg-primary-active text-background px-3 py-1.5 rounded-button transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press text-xs md:text-sm font-medium"
                >
                  Submit Demo
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-background-lighter hover:bg-gray-800 text-text-primary px-3 py-1.5 rounded-button transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] button-press text-xs md:text-sm font-medium border border-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="bg-background-light rounded-xl shadow-lg p-4 md:p-5 animate-fade-in border border-gray-800/50">
            <h2 className="text-base md:text-lg font-bold text-text-primary mb-3">Your Submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-text-secondary">No submissions yet. Submit your first demo!</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission, index) => (
                <div
                  key={submission.id}
                  className={`border rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-200 animate-slide-in ${
                    submission.status === 'reviewed'
                      ? 'bg-background-lighter border-primary/30'
                      : 'bg-background-lighter border-yellow-500/30'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-2 md:mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 md:mb-2">
                        {submission.song_title && (
                          <h3 className="text-sm md:text-base font-semibold text-text-primary break-words">
                            {submission.song_title}
                          </h3>
                        )}
                        {submission.artist_name && (
                          <p className="text-xs md:text-sm text-text-secondary break-words mt-0.5">
                            by {submission.artist_name}
                          </p>
                        )}
                      </div>
                      {submission.description && (
                        <p className="text-xs md:text-sm text-text-secondary mb-1.5 md:mb-2 break-words whitespace-pre-wrap line-clamp-2">
                          {submission.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-text-muted">
                          {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                        {submission.session_number && (
                          <span className="text-xs text-text-muted">
                            • Session #{submission.session_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 md:gap-2 flex-shrink-0">
                      <span
                        className={`px-3 py-1.5 rounded-button text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-md ${
                          submission.status === 'reviewed'
                            ? 'bg-primary text-background'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}
                      >
                        {submission.status === 'reviewed' ? '✓ Reviewed' : '⏳ Pending'}
                      </span>
                      {submission.status === 'pending' && (
                        <Link
                          href={`/submit?edit=${submission.id}`}
                          className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap transition-colors duration-200 underline underline-offset-2"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  {/* SoundCloud Embed */}
                  <div className="mt-4">
                    {embedData[submission.id]?.html ? (
                      <div 
                        className="soundcloud-embed w-full"
                        style={{ maxWidth: '100%', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{ __html: embedData[submission.id].html || '' }}
                      />
                    ) : embedData[submission.id]?.error ? (
                      <div className="p-4 bg-background-lighter rounded-lg border border-gray-800/50">
                        <p className="text-sm text-text-secondary mb-2">
                          Unable to embed this track. 
                          <a 
                            href={submission.soundcloud_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-hover underline underline-offset-2 ml-1 transition-colors duration-200"
                          >
                            Open in SoundCloud
                          </a>
                        </p>
                        <iframe
                          width="100%"
                          height="166"
                          scrolling="no"
                          frameBorder="no"
                          allow="autoplay"
                          src={getEmbedUrl(submission.soundcloud_url)}
                          className="rounded"
                          title="SoundCloud Player"
                        ></iframe>
                      </div>
                    ) : (
                      <iframe
                        width="100%"
                        height="166"
                        scrolling="no"
                        frameBorder="no"
                        allow="autoplay"
                        src={getEmbedUrl(submission.soundcloud_url)}
                        className="rounded"
                        title="SoundCloud Player"
                      ></iframe>
                    )}
                  </div>
                  {submission.reviews && submission.reviews.length > 0 && (
                    <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-800/50">
                      <h3 className="text-xs md:text-sm font-semibold text-text-primary mb-1.5 md:mb-2">Review Scores:</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                        {[
                          { label: 'Sound', score: submission.reviews[0].sound_score, bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
                          { label: 'Structure', score: submission.reviews[0].structure_score, bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
                          { label: 'Mix', score: submission.reviews[0].mix_score, bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400' },
                          { label: 'Vibe', score: submission.reviews[0].vibe_score, bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
                        ].map(({ label, score, bg, border, text }) => (
                          <div key={label} className={`${bg} border ${border} rounded-lg p-2 md:p-2.5 shadow-md`}>
                            <p className={`text-xs ${text} mb-0.5 md:mb-1 font-medium`}>{label}</p>
                            <p className={`text-sm md:text-base font-bold ${text}`}>
                              {score}/10
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
