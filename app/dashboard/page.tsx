'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Queue, { type QueueLoadedItem } from '../components/Queue'
import Carryover from '../components/Carryover'
import XpHelpModal, { getXpHelpDismissed } from '../components/XpHelpModal'
import DashboardFooter from '../components/DashboardFooter'

interface User {
  id: string
  display_name: string
  role: string
  xp?: number
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
      const u = data.user as { xp?: unknown }
      if (typeof u?.xp === 'number') setXp(u.xp)
      else if (typeof u?.xp === 'string') {
        const n = parseInt(u.xp, 10)
        if (!Number.isNaN(n)) setXp(Math.max(0, n))
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
          {/* Small indicators on top — one compact row */}
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
            compactTop
          />

          <div className="bg-background-light rounded-xl shadow-lg p-4 md:p-5 animate-fade-in border border-gray-800/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
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
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-button bg-primary/10 border border-primary/30 animate-xp-pulse"
                    title="Your XP — use it to move up the queue"
                  >
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">XP</span>
                    <span className="text-base font-bold text-primary tabular-nums">{xp}</span>
                    {xpInBlock > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 ml-1">
                        <div className="w-12 h-1.5 bg-background-lighter rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${xpInBlock}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted tabular-nums">{xpToNext} to +1</span>
                      </div>
                    )}
                  </div>
                  {xp >= 100 && xpUsedThisSession < 300 && (
                    <button
                      type="button"
                      onClick={handleUseXp}
                      disabled={useXpLoading}
                      className="px-3 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-background text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] button-press"
                    >
                      {useXpLoading ? '…' : 'Use my XP'}
                    </button>
                  )}
                </div>
                {useXpMessage && (
                  <p className="w-full text-sm font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mt-1 animate-scale-in">
                    {useXpMessage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                {/* Average ratings — compact: collapse into details or single line */}
                {getAverageScores() && (
                  <details className="group/avg order-first md:order-none">
                    <summary className="list-none cursor-pointer text-xs text-text-muted hover:text-text-primary font-medium inline-flex items-center gap-1">
                      Avg <span className="text-primary font-bold">{((Number(getAverageScores()!.sound) + Number(getAverageScores()!.structure) + Number(getAverageScores()!.mix) + Number(getAverageScores()!.vibe)) / 4).toFixed(1)}</span>/10
                      <svg className="w-3 h-3 opacity-70 group-open/avg:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {[
                        { label: 'S', score: getAverageScores()!.sound, color: 'text-blue-400' },
                        { label: 'St', score: getAverageScores()!.structure, color: 'text-purple-400' },
                        { label: 'M', score: getAverageScores()!.mix, color: 'text-pink-400' },
                        { label: 'V', score: getAverageScores()!.vibe, color: 'text-orange-400' },
                      ].map(({ label, score, color }) => (
                        <span key={label} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${color} bg-background-lighter border border-gray-700/50`} title={label === 'S' ? 'Sound' : label === 'St' ? 'Structure' : label === 'M' ? 'Mix' : 'Vibe'}>{label} {score}</span>
                      ))}
                    </div>
                  </details>
                )}
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
                  onClick={openLogoutConfirm}
                  className="bg-background-lighter hover:bg-gray-800 text-text-primary px-3 py-1.5 rounded-button transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] button-press text-xs md:text-sm font-medium border border-gray-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Tester panel: add/remove XP */}
          {user.role === 'tester' && (
            <div className="bg-amber-500/5 rounded-xl shadow-lg p-4 md:p-5 border border-amber-500/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 uppercase tracking-wider">Tester</span>
                <h2 className="text-base font-bold text-text-primary">Adjust XP</h2>
              </div>
              <p className="text-xs text-text-secondary mb-3">Manually add or remove XP. Then click &quot;Use my XP&quot; to apply and move up the queue. No automatic usage.</p>
              <form onSubmit={handleXpAdjustSubmit} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  value={xpAdjustValue}
                  onChange={(e) => setXpAdjustValue(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-28 px-3 py-2 rounded-button bg-background-lighter border border-gray-700 text-text-primary text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                />
                <button
                  type="submit"
                  disabled={xpAdjusting || !xpAdjustValue.trim()}
                  className="px-3 py-2 rounded-button bg-primary hover:bg-primary-hover text-background text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {xpAdjusting ? '…' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => handleXpAdjust(50)}
                  disabled={xpAdjusting}
                  className="px-3 py-2 rounded-button bg-background-lighter hover:bg-gray-700 border border-gray-600 text-text-primary text-sm font-medium disabled:opacity-50"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => handleXpAdjust(-50)}
                  disabled={xpAdjusting}
                  className="px-3 py-2 rounded-button bg-background-lighter hover:bg-gray-700 border border-gray-600 text-text-primary text-sm font-medium disabled:opacity-50"
                >
                  −50
                </button>
              </form>
              {xpAdjustMessage && (
                <p className="mt-3 text-sm font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 animate-scale-in">
                  {xpAdjustMessage}
                </p>
              )}
            </div>
          )}

          <div className="bg-background-light rounded-xl shadow-lg p-4 md:p-5 animate-fade-in border border-gray-800/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-text-primary">Your Submissions</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {submissions.length === 0 
                      ? 'No active submissions' 
                      : `${submissions.length} pending submission${submissions.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={fetchReviewedSubmissions}
                disabled={loadingReviewed}
                className="group relative flex items-center gap-2 px-4 py-2 bg-background-lighter hover:bg-primary/10 border border-gray-700 hover:border-primary/30 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press"
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
                    <span className="text-xs md:text-sm font-medium text-text-primary group-hover:text-primary transition-colors duration-200">
                      {showReviewed ? 'Hide Results' : 'View Results'}
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
            <p className="text-text-secondary">No submissions yet. Submit your first demo!</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission, index) => (
                <div
                  key={submission.id}
                  className="border rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-200 animate-slide-in bg-background-lighter border-yellow-500/30"
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
                      <span className="px-3 py-1.5 rounded-button text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        ⏳ Pending
                      </span>
                      <Link
                        href={`/submit?edit=${submission.id}`}
                        className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap transition-colors duration-200 underline underline-offset-2"
                      >
                        Edit
                      </Link>
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
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Previous Reviewed Submissions Section */}
          {showReviewed && (
            <div className="bg-gradient-to-br from-background-light to-background-lighter rounded-xl shadow-lg p-4 md:p-5 mt-4 border border-primary/20 animate-fade-in">
                {/* Header with Statistics */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/20 rounded-lg">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-text-primary flex items-center gap-2">
                        Previous Submission Results
                        <span className="px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded-full">
                          {reviewedSubmissions.length}
                        </span>
                      </h2>
                      <p className="text-xs text-text-secondary mt-1">
                        Your reviewed submissions from previous sessions
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reviewed Submissions List */}
                {reviewedSubmissions.length > 0 ? (
                  <div className="space-y-4">
                    {reviewedSubmissions.map((submission, index) => (
                      <div
                        key={submission.id}
                        className="group border rounded-xl p-4 md:p-5 hover:shadow-xl transition-all duration-300 animate-slide-in bg-background-lighter border-primary/30 hover:border-primary/50 hover:bg-background-light"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex justify-between items-start mb-3 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3 mb-2">
                              <div className="p-1.5 bg-primary/10 rounded-lg mt-0.5 flex-shrink-0">
                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                {submission.song_title && (
                                  <h3 className="text-base md:text-lg font-semibold text-text-primary break-words group-hover:text-primary transition-colors duration-200">
                                    {submission.song_title}
                                  </h3>
                                )}
                                {submission.artist_name && (
                                  <p className="text-sm text-text-secondary break-words mt-1">
                                    by {submission.artist_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            {submission.description && (
                              <p className="text-sm text-text-secondary mb-3 break-words whitespace-pre-wrap line-clamp-2">
                                {submission.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(submission.created_at).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              {submission.session_number && (
                                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  Session #{submission.session_number}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className="px-3 py-1.5 rounded-button text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 shadow-md bg-primary text-background flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Reviewed
                            </span>
                          </div>
                        </div>
                        
                        {/* Review Scores - Prominent Display */}
                        {submission.reviews && submission.reviews.length > 0 && (
                          <div className="mb-4 p-4 bg-gradient-to-br from-background-light to-background-lighter rounded-lg border border-primary/20">
                            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Review Scores
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'Sound', score: submission.reviews[0].sound_score, bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', icon: '🔊' },
                                { label: 'Structure', score: submission.reviews[0].structure_score, bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', icon: '🏗️' },
                                { label: 'Mix', score: submission.reviews[0].mix_score, bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', icon: '🎚️' },
                                { label: 'Vibe', score: submission.reviews[0].vibe_score, bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', icon: '✨' },
                              ].map(({ label, score, bg, border, text, icon }) => (
                                <div key={label} className={`${bg} border ${border} rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden min-w-0 box-border`}>
                                  <div className="flex items-center justify-between mb-1 gap-1">
                                    <p className={`text-xs ${text} font-medium truncate min-w-0`}>{label}</p>
                                    <span className="text-xs opacity-70 flex-shrink-0">{icon}</span>
                                  </div>
                                  <p className={`text-xl md:text-2xl font-bold ${text} break-words pl-0.5 pr-1`}>
                                    {score}<span className="text-sm opacity-70">/10</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* SoundCloud Embed */}
                        <div className="mt-4">
                          {reviewedEmbedData[submission.id]?.html ? (
                            <div 
                              className="soundcloud-embed w-full rounded-lg overflow-hidden"
                              style={{ maxWidth: '100%', overflow: 'hidden' }}
                              dangerouslySetInnerHTML={{ __html: reviewedEmbedData[submission.id].html || '' }}
                            />
                          ) : reviewedEmbedData[submission.id]?.error ? (
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 bg-background-lighter rounded-full mb-4">
                      <svg className="w-12 h-12 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-text-secondary font-medium">No reviewed submissions yet</p>
                    <p className="text-xs text-text-muted mt-1">Your reviewed submissions will appear here</p>
                  </div>
                )}
              </div>
          )}

          {/* Queue and Carryover - side by side, symmetrically centered under Your Submissions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch max-w-2xl mx-auto">
            <Queue
              currentUserId={user?.id}
              refetchTrigger={queueRefetchTrigger}
              onQueueLoaded={handleQueueLoaded}
            />
            <Carryover />
          </div>

          {/* Dashboard footer: XP summary + How XP works + expandable XP log */}
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
        </div>
      </div>

      <XpHelpModal isOpen={showXpHelpModal} onClose={() => setShowXpHelpModal(false)} />

      {/* Logout confirmation: ensure user can re-login with Twitch, offer to save account (stay logged in) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" aria-modal="true" role="dialog">
          <div className="bg-background-lighter border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Log out?</h3>
            <p className="text-text-secondary text-sm mb-4">
              You can sign in again with Twitch anytime. Do you want to save your current account before logging out?
            </p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-button bg-background border border-gray-600 text-text-primary text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Stay logged in
              </button>
              <button
                type="button"
                onClick={performLogout}
                className="px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-background text-sm font-medium transition-colors"
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
