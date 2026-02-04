'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Queue, { type QueueLoadedItem } from '../components/Queue'
import XpHelpModal, { getXpHelpDismissed } from '../components/XpHelpModal'
import IndicatorsHelpModal from '../components/IndicatorsHelpModal'
import DashboardFooter from '../components/DashboardFooter'
import SoundCloudEmbed from '../components/SoundCloudEmbed'

interface User {
  id: string
  display_name: string
  role: string
  xp?: number
  profile_image_url?: string | null
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
  const [reviewedSubmissions, setReviewedSubmissions] = useState<Submission[]>([])
  const [showReviewed, setShowReviewed] = useState(false)
  const [loadingReviewed, setLoadingReviewed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [embedData, setEmbedData] = useState<Record<string, EmbedData>>({})
  const [reviewedEmbedData, setReviewedEmbedData] = useState<Record<string, EmbedData>>({})
  const [submissionsOpen, setSubmissionsOpen] = useState(true)
  const [bannerState, setBannerState] = useState<'visible' | 'hidden' | 'below'>('visible')
  const [lastScrollY, setLastScrollY] = useState(0)
  const [isScrollingUp, setIsScrollingUp] = useState(false)
  const prevSubmissionsOpenRef = useRef<boolean | null>(null)
  const [showXpHelpModal, setShowXpHelpModal] = useState(false)
  const [showIndicatorsHelpModal, setShowIndicatorsHelpModal] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const hasAutoShownXpHelpRef = useRef(false)
  const [xpAdjustValue, setXpAdjustValue] = useState('')
  const [xpAdjusting, setXpAdjusting] = useState(false)
  const [xp, setXp] = useState<number>(0)
  const [xpUsedThisSession, setXpUsedThisSession] = useState<number>(0)
  const [unusedExternal, setUnusedExternal] = useState<number>(0)
  const [externalXpThisSession, setExternalXpThisSession] = useState<number>(0)
  const [xpStatus, setXpStatus] = useState<{
    time_xp_active: boolean
    following_mikegtcoff: boolean | null
  } | null>(null)
  const [xpLog, setXpLog] = useState<Array<{ id: string; amount: number; source: string; description?: string; created_at: string }>>([])
  const [loadingXpLog, setLoadingXpLog] = useState(false)
  const [carryoverCount, setCarryoverCount] = useState(0)
  const [queueRefetchTrigger, setQueueRefetchTrigger] = useState(0)
  const [xpAdjustMessage, setXpAdjustMessage] = useState<string | null>(null)
  const [useXpMessage, setUseXpMessage] = useState<string | null>(null)
  const [useXpLoading, setUseXpLoading] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [profileImageFailed, setProfileImageFailed] = useState(false)
  const profileImageRequestedRef = useRef(false)
  const lastMyPositionsRef = useRef<Record<string, number>>({})

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
        const open = data.submissions_open ?? true
        const prev = prevSubmissionsOpenRef.current
        prevSubmissionsOpenRef.current = open
        setSubmissionsOpen(open)
        if (prev !== null && prev !== open) {
          fetchSubmissions()
        }
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
      const u = data.user as { xp?: unknown; profile_image_url?: string | null }
      if (typeof u?.xp === 'number') setXp(u.xp)
      else if (typeof u?.xp === 'string') {
        const n = parseInt(u.xp, 10)
        if (!Number.isNaN(n)) setXp(Math.max(0, n))
      }
      setProfileImageFailed(false)
      profileImageRequestedRef.current = false
      if (typeof u?.profile_image_url === 'string' && u.profile_image_url.trim()) {
        setProfileImageUrl(u.profile_image_url.trim())
      } else {
        setProfileImageUrl(null)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchXp = async () => {
    try {
      const res = await fetch('/api/xp', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const v = data.xp
      if (typeof v === 'number' && !Number.isNaN(v)) setXp(Math.max(0, Math.floor(v)))
      else if (typeof v === 'string') {
        const n = parseInt(v, 10)
        if (!Number.isNaN(n)) setXp(Math.max(0, n))
      }
      const u = data.xp_used_this_session
      if (typeof u === 'number' && !Number.isNaN(u)) setXpUsedThisSession(Math.max(0, Math.floor(u)))
      else if (typeof u === 'string') {
        const n = parseInt(u, 10)
        if (!Number.isNaN(n)) setXpUsedThisSession(Math.max(0, n))
      }
      const ue = data.unused_external
      if (typeof ue === 'number' && !Number.isNaN(ue)) setUnusedExternal(Math.max(0, Math.floor(ue)))
      else if (typeof ue === 'string') {
        const n = parseInt(ue, 10)
        if (!Number.isNaN(n)) setUnusedExternal(Math.max(0, n))
      }
      const ext = data.external_xp_this_session
      if (typeof ext === 'number' && !Number.isNaN(ext)) setExternalXpThisSession(Math.max(0, Math.floor(ext)))
      else if (typeof ext === 'string') {
        const n = parseInt(ext, 10)
        if (!Number.isNaN(n)) setExternalXpThisSession(Math.max(0, n))
      }
    } catch {
      /* ignore */
    }
  }

  const fetchXpLog = async () => {
    setLoadingXpLog(true)
    try {
      const res = await fetch('/api/xp/log', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setXpLog(data.log ?? [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingXpLog(false)
    }
  }

  const fetchCarryoverCount = async () => {
    try {
      const res = await fetch('/api/submissions/carryover', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const count = typeof data.my_carryover_count === 'number' ? data.my_carryover_count : 0
        setCarryoverCount(count)
      }
    } catch {
      /* ignore */
    }
  }

  const fetchXpStatus = async () => {
    try {
      const res = await fetch('/api/xp/status')
      if (!res.ok) return
      const data = await res.json()
      setXpStatus({
        time_xp_active: !!data.time_xp_active,
        following_mikegtcoff: typeof data.following_mikegtcoff === 'boolean' ? data.following_mikegtcoff : null,
      })
    } catch {
      /* ignore */
    }
  }

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/submissions')
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
        
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

  const fetchReviewedSubmissions = async () => {
    // If hiding, just toggle and return
    if (showReviewed) {
      setShowReviewed(false)
      return
    }

    // If embeds already loaded, just show the section
    if (reviewedSubmissions.length > 0 && Object.keys(reviewedEmbedData).length > 0) {
      setShowReviewed(true)
      return
    }

    // Otherwise, fetch embeds (list may already be from mount)
    setLoadingReviewed(true)
    try {
      const response = await fetch('/api/submissions/reviewed')
      if (response.ok) {
        const data = await response.json()
        setReviewedSubmissions(data.submissions || [])
        
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
        setReviewedEmbedData(embedMap)
        setShowReviewed(true)
      }
    } catch (error) {
      console.error('Error fetching reviewed submissions:', error)
    } finally {
      setLoadingReviewed(false)
    }
  }

  // Calculate average scores for reviewed submissions
  const getAverageScores = () => {
    if (reviewedSubmissions.length === 0) return null
    
    const totals = reviewedSubmissions.reduce((acc, sub) => {
      if (sub.reviews && sub.reviews.length > 0) {
        const review = sub.reviews[0]
        acc.sound += Number(review.sound_score) || 0
        acc.structure += Number(review.structure_score) || 0
        acc.mix += Number(review.mix_score) || 0
        acc.vibe += Number(review.vibe_score) || 0
        acc.count++
      }
      return acc
    }, { sound: 0, structure: 0, mix: 0, vibe: 0, count: 0 })
    
    if (totals.count === 0) return null
    
    return {
      sound: (totals.sound / totals.count).toFixed(1),
      structure: (totals.structure / totals.count).toFixed(1),
      mix: (totals.mix / totals.count).toFixed(1),
      vibe: (totals.vibe / totals.count).toFixed(1),
      count: totals.count
    }
  }

  // Fetch reviewed submissions list on mount (for footer averages); no embeds
  const fetchReviewedList = async () => {
    try {
      const response = await fetch('/api/submissions/reviewed')
      if (response.ok) {
        const data = await response.json()
        setReviewedSubmissions(data.submissions || [])
      }
    } catch (error) {
      console.error('Error fetching reviewed list:', error)
    }
  }

  useEffect(() => {
    if (!user || profileImageFailed || profileImageRequestedRef.current) return
    const fromUser = typeof user.profile_image_url === 'string' && user.profile_image_url.trim()
    if (fromUser) return
    profileImageRequestedRef.current = true
    fetch('/api/user/profile-image', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.url === 'string' && data.url.trim()) {
          setProfileImageUrl(data.url.trim())
        } else {
          setProfileImageFailed(true)
        }
      })
      .catch(() => setProfileImageFailed(true))
  }, [user, profileImageFailed])

  useEffect(() => {
    fetchUser()
    fetchSubmissions()
    fetchSubmissionsStatus()
    fetchReviewedList()
    fetchXp()
    fetchXpStatus()
    fetchXpLog()
    fetchCarryoverCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch
  }, [])

  // Poll submission status; refetch submissions when open/closed changes (e.g. curator toggles)
  useEffect(() => {
    const interval = setInterval(fetchSubmissionsStatus, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  // Poll XP status (follow, time XP) every 30s
  useEffect(() => {
    const interval = setInterval(fetchXpStatus, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  // Refetch submissions, reviewed list, and XP when page becomes visible (e.g. return from submit)
  useEffect(() => {
    const onFocus = () => {
      fetchSubmissions()
      fetchSubmissionsStatus()
      fetchReviewedList()
      fetchXp()
      fetchXpStatus()
      fetchXpLog()
      fetchCarryoverCount()
    }
    const handler = () => document.visibilityState === 'visible' && onFocus()
    window.addEventListener('visibilitychange', handler)
    return () => window.removeEventListener('visibilitychange', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  // Auto-show XP help modal on first dashboard visit after login (unless already dismissed)
  useEffect(() => {
    if (loading || !user || hasAutoShownXpHelpRef.current || getXpHelpDismissed()) return
    hasAutoShownXpHelpRef.current = true
    setShowXpHelpModal(true)
  }, [loading, user])

  // Open XP help when navigating to #show-xp-help (e.g. from footer "How XP works" link)
  useEffect(() => {
    const check = () => {
      if (typeof window === 'undefined') return
      if (window.location.hash === '#show-xp-help') {
        setShowXpHelpModal(true)
        const base = window.location.pathname + window.location.search
        window.history.replaceState(null, '', base)
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  const performLogout = async () => {
    setShowLogoutConfirm(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const openLogoutConfirm = () => setShowLogoutConfirm(true)

  const handleQueueLoaded = useCallback(
    (items: QueueLoadedItem[]) => {
      const uid = user?.id
      if (!uid) return
      const myItems = items.filter((i) => i.user_id === uid)
      const myPositions: Record<string, number> = {}
      for (const it of myItems) myPositions[it.id] = it.position
      lastMyPositionsRef.current = myPositions
    },
    [user?.id]
  )

  const handleXpAdjust = async (delta: number) => {
    if (user?.role !== 'tester') return
    setXpAdjustMessage(null)
    setXpAdjusting(true)
    try {
      const res = await fetch('/api/xp/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to adjust XP')
      }
      const data = await res.json()
      const next = typeof data.xp === 'number' ? data.xp : parseInt(String(data.xp || 0), 10) || 0
      setXp(Math.max(0, next))
      setUser((u) => (u ? { ...u, xp: next } : null))
      setXpAdjustValue('')
      setXpAdjustMessage('XP updated. Click "Use my XP" to apply and move up.')
      fetchXp()
    } catch (e) {
      console.error('XP adjust error:', e)
      alert(e instanceof Error ? e.message : 'Failed to adjust XP')
    } finally {
      setXpAdjusting(false)
    }
  }

  const handleUseXp = async () => {
    setUseXpMessage(null)
    setUseXpLoading(true)
    try {
      const res = await fetch('/api/xp/use', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUseXpMessage(data?.error || 'Failed to use XP')
        return
      }
      setUseXpMessage(data.message ?? 'Done.')
      fetchXp()
      setQueueRefetchTrigger((t) => t + 1)
    } catch (e) {
      setUseXpMessage('Something went wrong.')
    } finally {
      setUseXpLoading(false)
    }
  }

  const handleXpAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(xpAdjustValue, 10)
    if (!Number.isNaN(n) && n !== 0) handleXpAdjust(n)
  }

  useEffect(() => {
    if (!xpAdjustMessage) return
    const t = setTimeout(() => setXpAdjustMessage(null), 6000)
    return () => clearTimeout(t)
  }, [xpAdjustMessage])

  useEffect(() => {
    if (!useXpMessage) return
    const t = setTimeout(() => setUseXpMessage(null), 6000)
    return () => clearTimeout(t)
  }, [useXpMessage])

  const xpToNext = 100 - (xp % 100)
  const xpInBlock = xp % 100

  // Convert SoundCloud URL to embed URL - simplified approach
  const getEmbedUrl = (url: string) => {
    if (!url || (!url.includes('soundcloud.com') && !url.includes('on.soundcloud.com'))) return ''
    
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

  // Calculate banner position based on state - always fixed at top when visible
  const getBannerClasses = () => {
    if (bannerState === 'visible' || bannerState === 'below') {
      return 'opacity-100 translate-y-0'
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
    <div className="bg-background animate-page-transition">{/* Floating Status Banner - compact */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out pt-[env(safe-area-inset-top)] ${getBannerClasses()} ${getBannerAnimation()}`}
      >
        <div className="max-w-6xl mx-auto px-2 sm:px-3 pt-1.5 pb-1.5 sm:pt-1 sm:pb-1">
          <div
            className={`rounded-md px-2.5 py-1.5 shadow-md backdrop-blur-sm border ${
              submissionsOpen
                ? 'bg-primary/20 backdrop-blur-md text-primary border-primary/30'
                : 'bg-red-500/20 backdrop-blur-md text-red-400 border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider sm:text-xs">
                {submissionsOpen ? 'Submission Open' : 'Submission Closed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main: even spacing (space-y-4); on lg, main column + sticky sidebar */}
      <div className="pt-8 sm:pt-9 md:pt-10 px-3 sm:px-4 md:px-5 pb-4 sm:pb-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <DashboardFooter
            xp={xp}
            xpUsedThisSession={xpUsedThisSession}
            unusedExternal={unusedExternal}
            externalXpThisSession={externalXpThisSession}
            timeXpActive={xpStatus?.time_xp_active ?? null}
            followingMikegtcoff={xpStatus?.following_mikegtcoff ?? null}
            carryoverCount={carryoverCount}
            xpLog={xpLog}
            loadingLog={loadingXpLog}
            onShowXpHelp={() => setShowXpHelpModal(true)}
            onShowIndicatorsHelp={() => setShowIndicatorsHelpModal(true)}
            compactTop
          />

          <div className="lg:flex lg:gap-6 lg:items-start">
            {/* Main column: welcome, submissions, reviewed — even space-y-4 */}
            <div className="lg:flex-1 lg:min-w-0 space-y-4">
          {/* Welcome card */}
          <div className="bg-background-light rounded-xl shadow-lg p-4 animate-fade-in border-2 border-gray-700/60">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto sm:flex-1">
                  {(profileImageUrl ?? user.profile_image_url) && !profileImageFailed ? (
                    <img
                      src={profileImageUrl ?? user.profile_image_url ?? ''}
                      alt=""
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="h-11 w-11 shrink-0 rounded-full border-2 border-gray-600 bg-background-lighter object-cover"
                      onError={() => setProfileImageFailed(true)}
                    />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-full border-2 border-gray-600 bg-background-lighter flex items-center justify-center text-text-muted text-base font-bold" aria-hidden>
                      {(user.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-extrabold text-text-primary break-words sm:text-xl md:text-2xl sm:truncate tracking-tight">
                      Welcome, {user.display_name}!
                    </h1>
                    {user.role === 'curator' && (
                      <p className="text-sm text-text-secondary mt-1 font-medium">MikeGTC Dashboard</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border-2 border-primary/40 animate-xp-pulse min-h-[44px] sm:min-h-[40px]"
                      title="Your XP — use it to move up the queue"
                    >
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">XP</span>
                      <span className="text-base font-extrabold text-primary tabular-nums">{xp}</span>
                      {xpInBlock > 0 && (
                        <div className="hidden sm:flex items-center gap-2 ml-1">
                          <div className="w-12 h-2 bg-background-lighter rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xpInBlock}%` }} />
                          </div>
                          <span className="text-xs text-text-muted tabular-nums font-medium">{xpToNext} to +1</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openLogoutConfirm}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-background-lighter hover:bg-gray-800 text-text-primary border-2 border-gray-600 transition-all duration-200 active:scale-[0.98] button-press touch-manipulation sm:min-h-[40px] sm:min-w-[40px] overflow-hidden"
                    title="Log out"
                    aria-label="Log out"
                  >
                    <svg className="w-4 h-4 shrink-0 block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
                </div>
              </div>
              {useXpMessage && (
                <p className="text-sm font-bold text-primary bg-primary/10 border-2 border-primary/40 rounded-lg px-4 py-2 animate-scale-in">
                  {useXpMessage}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap">
                {user.role === 'curator' && (
                  <Link href="/curator" className="min-h-[48px] flex items-center justify-center px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold transition-all active:scale-[0.98] button-press touch-manipulation border-2 border-transparent hover:border-primary/30">
                    MikeGTC
                  </Link>
                )}
                <Link href="/submit" className="min-h-[48px] flex items-center justify-center px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold transition-all active:scale-[0.98] button-press touch-manipulation border-2 border-transparent hover:border-primary/30">
                  Submit Demo
                </Link>
                <Link href="/carryover" className="min-h-[48px] flex items-center justify-center px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold transition-all active:scale-[0.98] button-press touch-manipulation border-2 border-transparent hover:border-primary/30">
                  Carryover {carryoverCount > 0 ? `(${carryoverCount})` : ''}
                </Link>
                {xp >= 100 && xpUsedThisSession < 300 && (
                  <button
                    type="button"
                    onClick={handleUseXp}
                    disabled={useXpLoading}
                    className="min-h-[48px] flex items-center justify-center px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25 active:bg-primary-active active:scale-[0.98] text-background text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all button-press touch-manipulation border-2 border-transparent hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-light"
                  >
                    {useXpLoading ? '…' : 'Use XP'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tester panel */}
          {user.role === 'tester' && (
            <div className="bg-amber-500/5 rounded-xl shadow-lg p-4 border-2 border-amber-500/40 animate-fade-in">
              <h2 className="text-base font-extrabold text-text-primary mb-1">Adjust XP</h2>
              <p className="text-sm text-text-secondary mb-4 font-medium">Add/remove XP, then &quot;Use XP&quot; to apply.</p>
              <form onSubmit={handleXpAdjustSubmit} className="flex flex-wrap items-center gap-4">
                <input
                  type="number"
                  value={xpAdjustValue}
                  onChange={(e) => setXpAdjustValue(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-24 sm:w-28 px-4 py-3 rounded-xl bg-background-lighter border-2 border-gray-600 text-text-primary text-base font-semibold focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none min-h-[48px]"
                />
                <button type="submit" disabled={xpAdjusting || !xpAdjustValue.trim()} className="min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation border-2 border-transparent">
                  {xpAdjusting ? '…' : 'Apply'}
                </button>
                <button type="button" onClick={() => handleXpAdjust(50)} disabled={xpAdjusting} className="min-h-[48px] px-4 py-3 rounded-xl bg-background-lighter hover:bg-gray-700 border-2 border-gray-600 text-text-primary text-sm font-bold disabled:opacity-50 touch-manipulation">
                  +50
                </button>
                <button type="button" onClick={() => handleXpAdjust(-50)} disabled={xpAdjusting} className="min-h-[48px] px-4 py-3 rounded-xl bg-background-lighter hover:bg-gray-700 border-2 border-gray-600 text-text-primary text-sm font-bold disabled:opacity-50 touch-manipulation">
                  −50
                </button>
              </form>
              {xpAdjustMessage && (
                <p className="mt-4 text-sm font-bold text-primary bg-primary/10 border-2 border-primary/40 rounded-lg px-4 py-2 animate-scale-in">
                  {xpAdjustMessage}
                </p>
              )}
            </div>
          )}

          <div className="bg-background-light rounded-xl shadow-lg p-3 sm:p-4 animate-fade-in border-2 border-gray-700/60">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0 border-2 border-primary/30">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-base font-extrabold text-text-primary sm:text-lg tracking-tight">Your Submissions</h2>
                  <p className="text-xs sm:text-sm text-text-secondary font-medium">
                    {submissions.length === 0 ? 'No active submissions' : `${submissions.length} pending`}
                  </p>
                </div>
              </div>
              {getAverageScores() && (
                <details className="group/avg shrink-0">
                  <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#2D2F31] border border-[#6A707B] touch-manipulation hover:bg-[#323436] transition-all">
                    <span className="text-[8px] sm:text-[9px] text-[#9EDD4F] font-bold uppercase tracking-wider">Avg</span>
                    <span className="text-sm sm:text-base font-black text-[#9EDD4F] tabular-nums leading-none">
                      {((Number(getAverageScores()!.sound) + Number(getAverageScores()!.structure) + Number(getAverageScores()!.mix) + Number(getAverageScores()!.vibe)) / 4).toFixed(1)}
                    </span>
                    <svg className="w-3 h-3 text-[#9EDD4F] opacity-60 group-open/avg:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <div className="mt-2 pt-2 border-t border-[#6A707B]">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'S', fullLabel: 'Sound', score: getAverageScores()!.sound, bg: 'bg-[#1E2A4A]', border: 'border-[#6A707B]', text: 'text-[#64B5F6]' },
                        { label: 'St', fullLabel: 'Struct', score: getAverageScores()!.structure, bg: 'bg-[#1E4A2E]', border: 'border-[#6A707B]', text: 'text-[#66BB6A]' },
                        { label: 'M', fullLabel: 'Mix', score: getAverageScores()!.mix, bg: 'bg-[#4A1E3A]', border: 'border-[#6A707B]', text: 'text-[#F48FB1]' },
                        { label: 'V', fullLabel: 'Vibe', score: getAverageScores()!.vibe, bg: 'bg-[#4A3A1E]', border: 'border-[#6A707B]', text: 'text-[#FFD54F]' },
                      ].map(({ label, fullLabel, score, bg, border, text }) => (
                        <div key={label} className={`${bg} border ${border} rounded px-1.5 py-1 text-center`} title={fullLabel}>
                          <div className={`text-[7px] sm:text-[8px] ${text} font-bold uppercase mb-0.5 opacity-80`}>{label}</div>
                          <div className={`text-xs sm:text-sm font-black ${text} tabular-nums leading-none`}>
                            {score}<span className="text-[9px] opacity-60">/10</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
                <button
                onClick={fetchReviewedSubmissions}
                disabled={loadingReviewed}
                className="min-h-[48px] w-full sm:w-auto group relative flex items-center justify-center gap-2 px-4 py-3 bg-background-lighter hover:bg-primary/10 border-2 border-gray-600 hover:border-primary/40 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation text-sm font-bold"
              >
                {loadingReviewed ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs md:text-sm font-medium text-text-primary">Loading...</span>
                  </>
                ) : (
                  <>
                    <svg 
                      className={`w-4 h-4 text-primary transition-transform duration-200 ${showReviewed ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="text-[11px] sm:text-xs md:text-sm font-medium text-text-primary group-hover:text-primary transition-colors duration-200">
                      {showReviewed ? 'Hide' : 'Results'}
                    </span>
                    {reviewedSubmissions.length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded-full min-w-[20px] text-center">
                        {reviewedSubmissions.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          {submissions.length === 0 ? (
            <p className="text-sm font-medium text-text-secondary">No submissions yet. Submit your first demo!</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission, index) => (
                <div
                  key={submission.id}
                  className="border-2 rounded-xl p-4 hover:shadow-lg transition-all duration-200 animate-slide-in bg-background-lighter border-yellow-500/40"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        {submission.song_title && (
                          <h3 className="text-sm font-semibold text-text-primary break-words line-clamp-2 sm:text-sm md:text-base">
                            {submission.song_title}
                          </h3>
                        )}
                        {submission.artist_name && (
                          <p className="text-sm text-text-secondary break-words mt-0.5 line-clamp-1">
                            by {submission.artist_name}
                          </p>
                        )}
                      </div>
                      {submission.description && (
                        <p className="text-sm text-text-secondary mb-1 break-words whitespace-pre-wrap line-clamp-2">
                          {submission.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-text-muted">
                        <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                        {submission.session_number && <span>• #{submission.session_number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 sm:rounded-button sm:px-2 sm:py-1 sm:text-xs">
                        ⏳ Pending
                      </span>
                      <Link href={`/submit?edit=${submission.id}`} className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 sm:rounded-button sm:px-2 sm:py-1 sm:text-xs hover:bg-yellow-500/30 transition-colors touch-manipulation">
                        Edit
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <SoundCloudEmbed
                      id={submission.id}
                      embedHtml={embedData[submission.id]?.html ?? null}
                      embedError={!!embedData[submission.id]?.error}
                      soundcloudUrl={submission.soundcloud_url}
                      embedUrl={getEmbedUrl(submission.soundcloud_url)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Previous Reviewed Submissions Section */}
          {showReviewed && (
            <div className="relative bg-background-light rounded-xl shadow-xl p-2.5 sm:p-3 md:p-4 mt-4 border-2 border-primary/30 animate-fade-in overflow-hidden">
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2.5 sm:mb-3 pb-2.5 sm:pb-3">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="relative p-1 sm:p-1.5 bg-gradient-to-br from-primary/30 to-primary/20 rounded-lg border-2 border-primary/50 shadow-lg shadow-primary/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-lg animate-pulse opacity-50"></div>
                      <svg className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-text-primary flex items-center gap-1.5 sm:gap-2 tracking-tight drop-shadow-sm">
                        Results
                        <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold bg-gradient-to-r from-primary/30 to-primary/20 text-primary rounded-full border border-primary/50 shadow-md shadow-primary/10 backdrop-blur-sm whitespace-nowrap">{reviewedSubmissions.length}</span>
                      </h2>
                      <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5 font-medium">Reviewed from previous sessions</p>
                    </div>
                  </div>
                </div>
                {reviewedSubmissions.length > 0 ? (
                  <div className="space-y-2.5 sm:space-y-3">
                    {reviewedSubmissions.map((submission, index) => {
                      const review = submission.reviews?.[0]
                      const avgScore = review ? ((Number(review.sound_score) + Number(review.structure_score) + Number(review.mix_score) + Number(review.vibe_score)) / 4).toFixed(1) : null
                      
                      return (
                      <div
                        key={submission.id}
                        className="group relative border-2 rounded-xl p-2.5 sm:p-3 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 animate-slide-in bg-background-lighter border-primary/40 hover:border-primary/60 hover:-translate-y-0.5 overflow-hidden"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {/* Compact header with AVG, date, title and artist */}
                        <div className="relative z-10 mb-2">
                          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1">
                            {review && (
                              <div className="flex-shrink-0">
                                <div className="flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#2D2F31] border-2 border-[#6A707B]">
                                  {/* AVG display */}
                                  <div className="flex flex-col items-start leading-none">
                                    <div className="text-[7px] sm:text-[8px] text-[#9EDD4F] font-bold uppercase tracking-widest mb-0.5">Avg</div>
                                    <div className="text-base sm:text-lg md:text-xl font-black text-[#9EDD4F] tabular-nums leading-none">
                                      {avgScore}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[8px] sm:text-[9px] md:text-[10px] text-text-muted ml-auto">
                              <span className="flex items-center gap-0.5 sm:gap-1">
                                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {new Date(submission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              {submission.session_number && (
                                <span className="px-1 sm:px-1.5 py-0.5 rounded bg-background border border-gray-700/50 text-[8px] sm:text-[9px]">
                                  #{submission.session_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            {submission.song_title && (
                              <h3 className="text-xs sm:text-sm font-semibold text-text-primary break-words line-clamp-2 sm:line-clamp-1 group-hover:text-primary transition-all duration-300 drop-shadow-sm">
                                {submission.song_title}
                              </h3>
                            )}
                            {submission.artist_name && (
                              <span className="text-[10px] sm:text-xs text-text-secondary opacity-80 group-hover:opacity-100 transition-opacity">
                                by {submission.artist_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Prominent Scores Display */}
                        {review && (
                          <div className="relative z-10 mb-2 p-2 sm:p-2.5 md:p-3 bg-background-lighter rounded-xl border-2 border-primary/40 shadow-xl shadow-primary/5 group-hover:shadow-2xl group-hover:shadow-primary/10 transition-all duration-300">
                            
                            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                              {[
                                { label: 'Sound', score: review.sound_score, bg: 'bg-[#1E2A4A]', border: 'border-[#6A707B]', text: 'text-[#64B5F6]', icon: '🔊' },
                                { label: 'Struct', score: review.structure_score, bg: 'bg-[#1E4A2E]', border: 'border-[#6A707B]', text: 'text-[#66BB6A]', icon: '🏗️' },
                                { label: 'Mix', score: review.mix_score, bg: 'bg-[#4A1E3A]', border: 'border-[#6A707B]', text: 'text-[#F48FB1]', icon: '🎚️' },
                                { label: 'Vibe', score: review.vibe_score, bg: 'bg-[#4A3A1E]', border: 'border-[#6A707B]', text: 'text-[#FFD54F]', icon: '✨' },
                              ].map(({ label, score, bg, border, text, icon }) => (
                                <div 
                                  key={label} 
                                  className={`relative ${bg} border-2 ${border} rounded-lg p-1.5 sm:p-2 md:p-2.5 text-center overflow-hidden group/score hover:scale-105 transition-all duration-300`}
                                >
                                  {/* Score content */}
                                  <div className="relative z-10">
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                                      <span className="text-[9px] sm:text-[10px] opacity-70">{icon}</span>
                                      <p className={`text-[8px] sm:text-[9px] ${text} font-bold uppercase tracking-wider opacity-90`}>{label}</p>
                                    </div>
                                    <p className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-black ${text} tabular-nums leading-none`}>
                                      {score}<span className="text-xs sm:text-sm md:text-base lg:text-lg opacity-70">/10</span>
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compact description */}
                        {submission.description && (
                          <div className="relative z-10 mb-2 pl-1.5 sm:pl-2 border-l-2 border-primary/20">
                            <p className="text-[10px] sm:text-xs text-text-secondary break-words whitespace-pre-wrap line-clamp-2 italic opacity-80 group-hover:opacity-100 transition-opacity">
                              {submission.description}
                            </p>
                          </div>
                        )}

                        {/* SoundCloud embed */}
                        <div className="relative z-10 mt-2 rounded-lg overflow-hidden border border-gray-700/30 group-hover:border-primary/30 transition-colors duration-300">
                          <SoundCloudEmbed
                            id={`reviewed-${submission.id}`}
                            embedHtml={reviewedEmbedData[submission.id]?.html ?? null}
                            embedError={!!reviewedEmbedData[submission.id]?.error}
                            soundcloudUrl={submission.soundcloud_url}
                            embedUrl={getEmbedUrl(submission.soundcloud_url)}
                          />
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="relative z-10 text-center py-6 sm:py-8">
                    <div className="inline-flex p-2.5 sm:p-3 bg-gradient-to-br from-background-lighter to-background rounded-full mb-2.5 sm:mb-3 border border-gray-700/50 shadow-lg">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-text-secondary font-medium text-xs sm:text-sm">No reviewed submissions yet</p>
                    <p className="text-[10px] sm:text-xs text-text-muted mt-1">Your reviewed submissions will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

            </div>

          {/* Sidebar on lg: XP footer (above) + Queue */}
          <aside className="lg:w-80 xl:w-96 lg:shrink-0 lg:sticky lg:top-16 space-y-4 mt-4 lg:mt-0">
            <DashboardFooter
              xp={xp}
              xpUsedThisSession={xpUsedThisSession}
              unusedExternal={unusedExternal}
              externalXpThisSession={externalXpThisSession}
              timeXpActive={xpStatus?.time_xp_active ?? null}
              followingMikegtcoff={xpStatus?.following_mikegtcoff ?? null}
              carryoverCount={carryoverCount}
              xpLog={xpLog}
              loadingLog={loadingXpLog}
              onShowXpHelp={() => setShowXpHelpModal(true)}
            />
            <Queue
              currentUserId={user?.id}
              refetchTrigger={queueRefetchTrigger}
              onQueueLoaded={handleQueueLoaded}
            />
          </aside>
          </div>
        </div>
      </div>

      <XpHelpModal isOpen={showXpHelpModal} onClose={() => setShowXpHelpModal(false)} />
      <IndicatorsHelpModal
        isOpen={showIndicatorsHelpModal}
        onClose={() => setShowIndicatorsHelpModal(false)}
        followingMikegtcoff={xpStatus?.following_mikegtcoff ?? null}
        timeXpActive={xpStatus?.time_xp_active ?? null}
        externalXpThisSession={externalXpThisSession}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 safe-area-padding" aria-modal="true" role="dialog">
          <div className="bg-background-lighter border border-gray-700 rounded-xl shadow-xl max-w-md w-full p-5 sm:p-6 sm:rounded-lg">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Log out?</h3>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              You can sign in again with Twitch anytime.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-background border border-gray-600 text-text-primary text-base font-semibold hover:bg-gray-700 transition-colors touch-manipulation sm:w-auto sm:min-h-[44px] sm:rounded-button sm:py-2 sm:text-sm sm:font-medium"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={performLogout}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-base font-semibold transition-colors touch-manipulation sm:w-auto sm:min-h-[44px] sm:rounded-button sm:py-2 sm:text-sm sm:font-medium"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
