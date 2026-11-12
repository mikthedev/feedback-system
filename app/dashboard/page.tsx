'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Queue, { type QueueLoadedItem } from '../components/Queue'
import XpHelpModal, { getXpHelpDismissed } from '../components/XpHelpModal'
import IndicatorsHelpModal from '../components/IndicatorsHelpModal'
import DashboardFooter from '../components/DashboardFooter'
import SoundCloudEmbed from '../components/SoundCloudEmbed'
import ScoreBoard from '../components/ScoreBoard'
import TotmDashboardPanel from '../components/TotmDashboardPanel'
import TotmLeaderboardIcon, { TotmSkipIcon } from '../components/TotmLeaderboardIcon'
import HomeStreamSection from '../components/HomeStreamSection'
import MobileXpPane from '../components/MobileXpPane'
import { useLanguage } from '@/app/context/LanguageContext'

type DashPane = 'tracks' | 'queue' | 'vods' | 'xp'

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
  genre?: string | null
  status: string
  session_number?: number
  created_at: string
  audience_score?: number | null
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
  const { t } = useLanguage()
  const [user, setUser] = useState<User | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [reviewedSubmissions, setReviewedSubmissions] = useState<Submission[]>([])
  const [showReviewed, setShowReviewed] = useState(false)
  const [mobilePane, setMobilePane] = useState<DashPane>('tracks')
  const [loadingReviewed, setLoadingReviewed] = useState(false)
  const [showAvgMetrics, setShowAvgMetrics] = useState(false)
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
  const [xp, setXp] = useState<number>(0)
  const [xpUsedThisSession, setXpUsedThisSession] = useState<number>(0)
  const [externalXpThisSession, setExternalXpThisSession] = useState<number>(0)
  const [xpStatus, setXpStatus] = useState<{
    time_xp_active: boolean
    following_mikegtcoff: boolean | null
  } | null>(null)
  const [xpLog, setXpLog] = useState<Array<{ id: string; amount: number; source: string; description?: string; created_at: string }>>([])
  const [loadingXpLog, setLoadingXpLog] = useState(false)
  const [carryoverCount, setCarryoverCount] = useState(0)
  const [queueRefetchTrigger, setQueueRefetchTrigger] = useState(0)
  const [useXpMessage, setUseXpMessage] = useState<string | null>(null)
  const [useXpBlocked, setUseXpBlocked] = useState(false)
  const [useXpLoading, setUseXpLoading] = useState(false)
  const [useXpClicking, setUseXpClicking] = useState(false)
  const [useXpAllowed, setUseXpAllowed] = useState(false)
  const [useXpReason, setUseXpReason] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [profileImageFailed, setProfileImageFailed] = useState(false)
  const profileImageRequestedRef = useRef(false)
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const lastMyPositionsRef = useRef<Record<string, number>>({})
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set())
  const [totmAvailableSkips, setTotmAvailableSkips] = useState(0)
  const [canSubmit, setCanSubmit] = useState(true)
  const [submitBlockReason, setSubmitBlockReason] = useState<
    'closed' | 'carryover_cooldown' | 'session_limit_closed' | 'session_limit_wait' | null
  >(null)
  const [submitBlockMinutes, setSubmitBlockMinutes] = useState<number | null>(null)
  const [eligibilityHasReviewed, setEligibilityHasReviewed] = useState(false)

  const DESCRIPTION_COLLAPSE_THRESHOLD = 120
  const toggleDescriptionExpanded = (id: string) => {
    setExpandedDescriptionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
          fetchSubmitEligibility()
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

  const fetchSubmitEligibility = async () => {
    try {
      const res = await fetch('/api/submissions/eligibility', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setCanSubmit(!!data.can_submit)
      setSubmitBlockReason(
        data.reason === 'closed' ||
          data.reason === 'carryover_cooldown' ||
          data.reason === 'session_limit_closed' ||
          data.reason === 'session_limit_wait'
          ? data.reason
          : null
      )
      setSubmitBlockMinutes(
        typeof data.minutes_remaining === 'number' ? data.minutes_remaining : null
      )
      setEligibilityHasReviewed(!!data.has_reviewed)
    } catch {
      /* ignore */
    }
  }

  const submitBlockMessage = (() => {
    if (canSubmit || !submitBlockReason) return null
    // Closed session is already covered by Status & alerts — don't duplicate it here.
    switch (submitBlockReason) {
      case 'closed':
        return null
      case 'carryover_cooldown':
        return t('dashboard.submitBlockedCarryover')
      case 'session_limit_closed':
        return t('dashboard.submitBlockedSessionClosed')
      case 'session_limit_wait':
        return eligibilityHasReviewed
          ? t('dashboard.submitBlockedReviewed')
          : t('dashboard.submitBlockedWait')
      default:
        return null
    }
  })()

  /** Pending tab only while user has pending tracks or can submit a new one. */
  const showPendingTab = submissions.length > 0 || canSubmit
  const viewingResults = showReviewed || !showPendingTab
  const showWelcomeOnMobile = mobilePane === 'tracks'

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

  const fetchCanMove = async () => {
    try {
      const res = await fetch('/api/xp/can-move', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setUseXpAllowed(!!data.allowed)
      setUseXpReason(typeof data.reason === 'string' ? data.reason : '')
    } catch {
      setUseXpAllowed(false)
      setUseXpReason('')
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

  const fetchReviewedSubmissions = async (mode: 'toggle' | 'show' = 'toggle') => {
    if (mode === 'toggle' && showReviewed) {
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

  // Extract accent color from profile picture
  useEffect(() => {
    const imgUrl = profileImageUrl ?? user?.profile_image_url
    if (!imgUrl || typeof imgUrl !== 'string' || profileImageFailed) {
      setAccentColor(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(size / 4, size / 4, size / 2, size / 2)
        const pixels = data.data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < pixels.length; i += 4) {
          r += pixels[i]!
          g += pixels[i + 1]!
          b += pixels[i + 2]!
          n++
        }
        if (n > 0) {
          r = Math.round(r / n)
          g = Math.round(g / n)
          b = Math.round(b / n)
          const gray = (r + g + b) / 3
          const boost = 1.4
          r = Math.min(255, Math.round(gray + (r - gray) * boost))
          g = Math.min(255, Math.round(gray + (g - gray) * boost))
          b = Math.min(255, Math.round(gray + (b - gray) * boost))
          setAccentColor(`rgb(${r},${g},${b})`)
        }
      } catch {
        setAccentColor(null)
      }
    }
    img.onerror = () => setAccentColor(null)
    img.src = imgUrl
  }, [profileImageUrl, user?.profile_image_url, profileImageFailed])

  useEffect(() => {
    fetchUser()
    fetchSubmissions()
    fetchSubmissionsStatus()
    fetchReviewedList()
    fetchSubmitEligibility()
    fetchXp()
    fetchXpStatus()
    fetchXpLog()
    fetchCarryoverCount()
    fetchCanMove()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch
  }, [])

  // Poll submission status; refetch submissions when open/closed changes (e.g. MikeGTC toggles)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubmissionsStatus()
      fetchSubmitEligibility()
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  // Poll XP status (follow, time XP) every 30s
  useEffect(() => {
    const interval = setInterval(fetchXpStatus, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  // When pending is locked, force Results view inside Submissions
  useEffect(() => {
    if (!showPendingTab) {
      setShowReviewed(true)
      if (reviewedSubmissions.length === 0) void fetchReviewedSubmissions('show')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [showPendingTab])

  // Refetch submissions, reviewed list, and XP when page becomes visible (e.g. return from submit)
  useEffect(() => {
    const onFocus = () => {
      fetchSubmissions()
      fetchSubmissionsStatus()
      fetchReviewedList()
      fetchSubmitEligibility()
      fetchXp()
      fetchXpStatus()
      fetchXpLog()
      fetchCarryoverCount()
      fetchCanMove()
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

  const handleUseXp = async () => {
    setUseXpMessage(null)
    setUseXpBlocked(false)
    setUseXpClicking(true)
    setTimeout(() => setUseXpClicking(false), 450)
    setUseXpLoading(true)
    try {
      const res = await fetch('/api/xp/use', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const raw = data?.error || data?.message || t('dashboard.useXpFailed')
        setUseXpMessage(
          raw === 'NO_OPEN_SESSION' || /no open session/i.test(String(raw))
            ? t('xp.noOpenSession')
            : raw
        )
        setUseXpBlocked(true)
        return
      }
      const moved = data.movesApplied > 0
      setUseXpBlocked(!moved)
      {
        const raw = data.message ?? (moved ? t('dashboard.done') : '')
        setUseXpMessage(
          raw === 'NO_OPEN_SESSION' || /no open session/i.test(String(raw))
            ? t('xp.noOpenSession')
            : raw
        )
      }
      fetchXp()
      fetchXpLog()
      fetchCanMove()
      if (moved) setQueueRefetchTrigger((t) => t + 1)
    } catch (e) {
      setUseXpMessage(t('common.somethingWentWrong'))
      setUseXpBlocked(true)
    } finally {
      setUseXpLoading(false)
    }
  }

  useEffect(() => {
    if (!useXpMessage) return
    const t = setTimeout(() => setUseXpMessage(null), 6000)
    return () => clearTimeout(t)
  }, [useXpMessage])

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
        <div className="text-xl text-text-primary">{t('common.loading')}</div>
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

  const showPane = (pane: DashPane) => (mobilePane === pane ? 'block' : 'hidden lg:block')

  return (
    <div className="bg-background animate-page-transition">{/* Floating Status Banner - compact */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out pt-[env(safe-area-inset-top)] px-2.5 sm:px-4 md:px-5 ${getBannerClasses()} ${getBannerAnimation()}`}
      >
        <div className="max-w-6xl mx-auto pt-1.5 pb-1.5 sm:pt-2 sm:pb-2">
          <div
            className={`rounded-lg px-3 py-1.5 sm:py-2 shadow-md backdrop-blur-sm border flex items-center justify-center ${
              submissionsOpen
                ? 'bg-primary/20 backdrop-blur-md text-primary border-primary/30'
                : 'bg-red-500/20 backdrop-blur-md text-red-400 border-red-500/30'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider sm:text-sm">
              {submissionsOpen ? t('dashboard.submissionOpen') : t('dashboard.submissionClosed')}
            </span>
          </div>
        </div>
      </div>

      {/* Main: top padding clears fixed banner; same px so banner and content align in width */}
      <div className="pt-11 sm:pt-12 md:pt-14 px-2.5 sm:px-4 md:px-5 pb-24 lg:pb-5">
        <div className="max-w-6xl mx-auto space-y-2 sm:space-y-4">
          <div className="hidden lg:block">
          <DashboardFooter
            xp={xp}
            xpUsedThisSession={xpUsedThisSession}
            usedCap={user?.role === 'tester' ? null : 300}
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
          </div>

          <div className="lg:flex lg:gap-5 xl:gap-6 lg:items-start">
            {/* Main column: welcome, submissions, reviewed — even space-y-4 */}
            <div className="lg:flex-1 lg:min-w-0 space-y-3 sm:space-y-4">
          {/* Welcome card — on mobile only with Submissions pane */}
          <div className={`${showWelcomeOnMobile ? 'block' : 'hidden lg:block'} bg-background-light rounded-xl sm:rounded-2xl shadow-lg p-3.5 sm:p-6 animate-fade-in border-2 border-gray-700/60 overflow-hidden relative`}>
            <div
              className="absolute top-0 left-0 right-0 h-0.5 opacity-70"
              style={{
                background: `linear-gradient(to right, transparent, ${accentColor ?? 'rgba(202,247,111,0.5)'}, transparent)`,
              }}
              aria-hidden
            />

            {/* Identity */}
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {(profileImageUrl ?? user.profile_image_url) && !profileImageFailed ? (
                  <img
                    src={profileImageUrl ?? user.profile_image_url ?? ''}
                    alt=""
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-full border-2 border-primary/30 bg-background object-cover"
                    onError={() => setProfileImageFailed(true)}
                  />
                ) : (
                  <div className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-full border-2 border-primary/30 bg-background-lighter flex items-center justify-center text-primary text-lg sm:text-2xl font-black" aria-hidden>
                    {(user.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-text-primary tracking-tight truncate leading-tight">
                    {t('dashboard.welcome')}{' '}
                    <span className="text-primary">{user.display_name}</span>
                  </h1>
                  {user.role === 'curator' ? (
                    <p className="text-xs sm:text-sm text-primary font-semibold mt-0.5 sm:mt-1">{t('dashboard.mikegtcPanel')}</p>
                  ) : (
                    <p className="text-xs sm:text-sm text-text-secondary mt-0.5 sm:mt-1">{t('dashboard.submitAndTrack')}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openLogoutConfirm}
                className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-background hover:bg-gray-700/60 text-text-muted hover:text-text-primary border border-gray-600/60 transition-all duration-200 active:scale-[0.97]"
                title={t('common.logOut')}
                aria-label={t('common.logOut')}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>

            {useXpMessage && (
              <p className={`mb-4 text-xs font-semibold rounded-lg px-3 py-2 animate-scale-in border ${
                useXpBlocked ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-primary bg-primary/10 border-primary/30'
              }`}>
                {useXpMessage}
              </p>
            )}

            {/* Actions */}
            <div className={`grid gap-2.5 sm:gap-3.5 mb-4 sm:mb-5 ${user.role === 'curator' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
              <Link
                href="/submit"
                aria-label={
                  totmAvailableSkips > 0
                    ? `${t('dashboard.submitDemo')} — ${t('totm.skipsAvailableShort').replace('{n}', String(totmAvailableSkips))}`
                    : t('dashboard.submitDemo')
                }
                className="relative flex h-10 sm:h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-primary px-3 sm:px-4 text-background font-bold text-xs sm:text-sm transition-all hover:bg-primary-hover active:scale-[0.99] touch-manipulation"
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${totmAvailableSkips > 0 ? 'animate-totm-plus-shimmer' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="truncate">{t('dashboard.submitDemo')}</span>
                {totmAvailableSkips > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-background text-primary border border-primary"
                    title={t('totm.skipsAvailableShort').replace('{n}', String(totmAvailableSkips))}
                  >
                    <TotmSkipIcon className="h-2.5 w-2.5" />
                  </span>
                )}
              </Link>
              <Link
                href="/carryover"
                aria-label={t('dashboard.carryover')}
                className="relative flex h-10 sm:h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-gray-600/55 bg-background-lighter px-3 sm:px-4 text-text-primary font-bold text-xs sm:text-sm transition-all hover:border-primary/45 hover:bg-primary/10 active:scale-[0.99] touch-manipulation"
              >
                <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="truncate">
                  {t('dashboard.carryover')}
                  {carryoverCount > 0 ? ` (${carryoverCount})` : ''}
                </span>
              </Link>
              {user.role === 'curator' && (
                <Link
                  href="/curator"
                  aria-label="MikeGTC"
                  className="col-span-2 sm:col-span-1 flex h-10 sm:h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-gray-600/55 bg-background-lighter px-3 sm:px-4 text-text-primary font-bold text-xs sm:text-sm transition-all hover:border-primary/45 hover:bg-primary/10 active:scale-[0.99] touch-manipulation"
                >
                  <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="truncate">MikeGTC</span>
                </Link>
              )}
            </div>

            {/* XP panel: stats + battery + Use XP */}
            <div className="rounded-xl border border-gray-700/50 bg-background/40 p-3.5 sm:p-4">
              <div className="flex items-end justify-between gap-3 mb-2.5">
                <div className="flex items-baseline gap-5 min-w-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('xp.stored')}</p>
                    <p className={`text-xl font-black text-primary tabular-nums leading-none mt-0.5 ${xp >= 100 ? 'animate-xp-number-pulse' : ''}`}>
                      {xp}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('xp.used')}</p>
                    <p className="text-xl font-black text-text-primary tabular-nums leading-none mt-0.5">
                      {xpUsedThisSession}
                      <span className="text-xs font-semibold text-text-muted">
                        {user.role === 'tester' ? ` · ${t('common.noLimit')}` : '/300'}
                      </span>
                    </p>
                  </div>
                </div>
                {xp < 9999 && (() => {
                  const charge = xpInBlock === 0 && xp > 0 ? 100 : xpInBlock
                  return (
                    <span className="text-[10px] font-bold text-primary tabular-nums shrink-0">{charge}/100</span>
                  )
                })()}
              </div>

              {xp < 9999 && (() => {
                const charge = xpInBlock === 0 && xp > 0 ? 100 : xpInBlock
                return (
                  <div className="mb-3 min-w-0">
                    <div
                      className={`xp-battery h-4 w-full ${useXpAllowed ? 'xp-battery-ready' : ''}`}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={charge}
                    >
                      {charge > 0 && (
                        <div
                          className="xp-battery-fill"
                          style={{ width: `max(0px, calc(${charge}% - 4px))` }}
                        />
                      )}
                      <div className="xp-battery-cells" aria-hidden>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <span key={i} />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <button
                type="button"
                onClick={handleUseXp}
                disabled={!useXpAllowed || useXpLoading}
                title={
                  useXpReason === 'NO_OPEN_SESSION' || /no open session/i.test(useXpReason)
                    ? t('xp.noOpenSession')
                    : useXpReason || t('dashboard.spend100XpPosition')
                }
                className={`group relative w-full h-10 sm:h-10 overflow-hidden rounded-xl font-bold text-sm touch-manipulation transition-all duration-200 ${
                  useXpAllowed
                    ? 'bg-primary text-background shadow-md shadow-primary/20 hover:bg-primary-hover hover:shadow-primary/30 active:scale-[0.99]'
                    : 'bg-background-lighter text-text-muted border border-gray-700/60 cursor-not-allowed'
                } ${useXpClicking ? 'animate-use-xp-click' : ''} ${useXpLoading ? 'opacity-70' : ''}`}
              >
                {useXpAllowed && (
                  <span
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    aria-hidden
                  />
                )}
                <span className="relative inline-flex items-center justify-center gap-1.5">
                  <svg className={`w-4 h-4 shrink-0 ${useXpAllowed ? '' : 'opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {useXpLoading ? '…' : t('dashboard.useXp')}
                </span>
              </button>
            </div>
          </div>

          {/* Lab tools: tester opens a dedicated page so it doesn’t crowd the dashboard */}
          {user.role === 'tester' && (
            <Link
              href="/lab"
              className={`${showPane('xp')} w-full min-h-[44px] sm:min-h-[48px] flex items-center justify-between gap-2 rounded-lg sm:rounded-xl bg-amber-500/[0.08] border-2 border-amber-500/35 px-3 sm:px-4 text-amber-400 font-bold text-xs sm:text-sm hover:bg-amber-500/15 transition-colors touch-manipulation`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="truncate">{t('lab.title')}</span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-amber-400/80">{t('lab.open')}</span>
            </Link>
          )}

          <div className={`${showPane('tracks')} bg-background-light rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-5 animate-fade-in border-2 border-gray-700/60`}>
            <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 bg-primary/10 rounded-xl border-2 border-primary/30 shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-text-primary tracking-tight truncate">
                  <span className="sm:hidden">{t('dashboard.submissions')}</span>
                  <span className="hidden sm:inline">{t('dashboard.yourSubmissions')}</span>
                </h2>
              </div>
              {getAverageScores() && (
                <button
                  onClick={() => setShowAvgMetrics(!showAvgMetrics)}
                  className={`min-h-[36px] flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg touch-manipulation active:scale-[0.98] transition-all duration-200 shrink-0 ${
                    showAvgMetrics
                      ? 'bg-primary/15 border-2 border-primary/45'
                      : 'bg-background-lighter hover:bg-primary/10 border-2 border-gray-600/60 hover:border-primary/40'
                  }`}
                >
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Avg</span>
                  <span className="text-xs font-black text-primary tabular-nums">
                    {((Number(getAverageScores()!.sound) + Number(getAverageScores()!.structure) + Number(getAverageScores()!.mix) + Number(getAverageScores()!.vibe)) / 4).toFixed(1)}
                  </span>
                </button>
              )}
            </div>

            {/* Pending / Results switcher — Pending hidden until user can submit again */}
            {showPendingTab ? (
              <div className="mb-3 sm:mb-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-background border-2 border-gray-700/50">
                <button
                  type="button"
                onClick={() => {
                  setShowReviewed(false)
                }}
                  className={`min-h-[40px] rounded-lg px-2.5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 touch-manipulation ${
                    !viewingResults
                      ? 'bg-primary/15 text-primary border border-primary/35 shadow-sm'
                      : 'text-text-secondary hover:text-text-primary border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {t('common.pending')}
                    {submissions.length > 0 && (
                      <span className={`tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        !viewingResults
                          ? 'bg-primary/20 text-primary'
                          : 'bg-background-lighter text-text-muted'
                      }`}>
                        {submissions.length}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void fetchReviewedSubmissions('show')}
                  disabled={loadingReviewed}
                  className={`min-h-[40px] rounded-lg px-2.5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 touch-manipulation disabled:opacity-60 ${
                    viewingResults
                      ? 'bg-primary/15 text-primary border border-primary/35 shadow-sm'
                      : 'text-text-secondary hover:text-text-primary border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {loadingReviewed ? t('dashboard.loading') : t('dashboard.results')}
                    {!loadingReviewed && reviewedSubmissions.length > 0 && (
                      <span className={`tabular-nums text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        viewingResults
                          ? 'bg-primary/20 text-primary'
                          : 'bg-background-lighter text-text-muted'
                      }`}>
                        {reviewedSubmissions.length}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            ) : submitBlockMessage ? (
              <div className="mb-3 sm:mb-4 rounded-xl border border-primary/30 bg-primary/[0.08] px-4 py-4 text-center">
                <p className="text-sm font-semibold text-text-primary leading-snug max-w-md mx-auto">
                  {submitBlockMessage}
                </p>
                {submitBlockMinutes != null && submitBlockMinutes > 0 && (
                  <p className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-background/50 px-3 py-1.5 text-[11px] font-bold text-primary tabular-nums">
                    <svg className="h-3.5 w-3.5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('dashboard.submitNextIn')} {submitBlockMinutes} min
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-3 sm:mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {t('dashboard.results')}
                </p>
              </div>
            )}

            {getAverageScores() && showAvgMetrics && (
              <div className="mb-3">
                <ScoreBoard
                  scores={getAverageScores()!}
                  averageLabel={t('dashboard.averageRatingLabel')}
                />
              </div>
            )}

            {!viewingResults ? (
              submissions.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-700/50 bg-background/40 px-4 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-600/50 bg-background-lighter text-text-muted">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-text-secondary">
                    {submitBlockMessage || t('dashboard.noSubmissions')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {submissions.map((submission, index) => (
                    <div
                      key={submission.id}
                      className="border-2 rounded-xl p-3 sm:p-4 hover:border-primary/40 transition-all duration-200 animate-slide-in bg-background-lighter border-gray-700/50"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex justify-between items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            {submission.song_title && (
                              <h3 className="text-sm font-bold text-text-primary break-words line-clamp-2">
                                {submission.song_title}
                              </h3>
                            )}
                            {submission.artist_name && (
                              <p className="text-xs text-text-secondary break-words mt-0.5 line-clamp-1 font-medium">
                                {t('dashboard.by')} {submission.artist_name}
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-text-muted truncate sm:hidden">
                            {new Date(submission.created_at).toLocaleDateString()}
                            {submission.session_number != null ? ` · #${submission.session_number}` : ''}
                            {submission.genre ? ` · ${(submission.genre.match(/\(([^)]+)\)\s*$/) ?? [null, submission.genre])[1]}` : ''}
                          </p>
                          <div className="hidden sm:flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-lg border border-gray-700/50 bg-background px-2.5 py-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Date</span>
                              <span className="text-xs font-semibold text-text-primary">{new Date(submission.created_at).toLocaleDateString()}</span>
                            </div>
                            {submission.session_number != null && (
                              <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Session</span>
                                <span className="text-xs font-bold text-primary tabular-nums">#{submission.session_number}</span>
                              </div>
                            )}
                            {submission.genre && (
                              <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold border border-primary/30">
                                {(submission.genre?.match(/\(([^)]+)\)\s*$/) ?? [null, submission.genre])[1]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="hidden sm:inline-block px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-background border border-gray-600/70 text-text-secondary">
                            {t('common.pending')}
                          </span>
                          <Link href={`/submit?edit=${submission.id}`} className="px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary/60 text-primary transition-colors touch-manipulation">
                            {t('common.edit')}
                          </Link>
                        </div>
                      </div>
                      {submission.description && (() => {
                        const isLong = submission.description.length > DESCRIPTION_COLLAPSE_THRESHOLD
                        const isExpanded = expandedDescriptionIds.has(submission.id)
                        const showToggle = isLong
                        const showFull = !showToggle || isExpanded
                        return (
                          <div className="mb-2 sm:mb-3 p-2.5 sm:p-3 bg-background rounded-xl border border-gray-700/50">
                            <div className="text-[8px] text-text-secondary font-bold uppercase tracking-wider mb-1.5 opacity-90">{t('common.description')}</div>
                            <p className={`text-xs sm:text-sm text-text-secondary break-words whitespace-pre-wrap leading-relaxed ${showFull ? '' : 'line-clamp-2'}`}>
                              {submission.description}
                            </p>
                            {showToggle && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); toggleDescriptionExpanded(submission.id) }}
                                className="mt-1.5 sm:mt-2 text-xs font-bold text-primary hover:underline touch-manipulation min-h-[40px] sm:min-h-0 flex items-center"
                              >
                                {isExpanded ? t('common.hide') : t('common.showMore')}
                              </button>
                            )}
                          </div>
                        )
                      })()}
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
              )
            ) : loadingReviewed ? (
              <div className="rounded-xl border border-gray-700/40 bg-background/40 px-4 py-10 text-center">
                <p className="text-sm font-medium text-text-secondary">{t('dashboard.loading')}</p>
              </div>
            ) : reviewedSubmissions.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {reviewedSubmissions.map((submission, index) => {
                  const review = submission.reviews?.[0]
                  return (
                    <div
                      key={submission.id}
                      className="border-2 rounded-xl p-3 sm:p-4 hover:border-primary/40 transition-all duration-200 animate-slide-in bg-background-lighter border-gray-700/50"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            {submission.song_title && (
                              <h3 className="text-sm font-bold text-text-primary break-words line-clamp-2">
                                {submission.song_title}
                              </h3>
                            )}
                            {submission.artist_name && (
                              <p className="text-xs text-text-secondary break-words mt-0.5 line-clamp-1 font-medium">
                                {t('dashboard.by')} {submission.artist_name}
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-text-muted truncate sm:hidden">
                            {new Date(submission.created_at).toLocaleDateString()}
                            {submission.session_number != null ? ` · #${submission.session_number}` : ''}
                            {submission.genre ? ` · ${(submission.genre.match(/\(([^)]+)\)\s*$/) ?? [null, submission.genre])[1]}` : ''}
                          </p>
                          <div className="hidden sm:flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-lg border border-gray-700/50 bg-background px-2.5 py-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Date</span>
                              <span className="text-xs font-semibold text-text-primary">{new Date(submission.created_at).toLocaleDateString()}</span>
                            </div>
                            {submission.session_number != null && (
                              <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Session</span>
                                <span className="text-xs font-bold text-primary tabular-nums">#{submission.session_number}</span>
                              </div>
                            )}
                            {submission.genre && (
                              <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold border border-primary/30">
                                {(submission.genre?.match(/\(([^)]+)\)\s*$/) ?? [null, submission.genre])[1]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {review && (
                        <div className="mb-2">
                          <ScoreBoard
                            scores={{
                              sound: review.sound_score,
                              structure: review.structure_score,
                              mix: review.mix_score,
                              vibe: review.vibe_score,
                            }}
                            averageLabel={t('dashboard.averageRatingLabel')}
                            audienceLabel={t('dashboard.audienceRatingLabel')}
                            audience={submission.audience_score ?? 0}
                          />
                        </div>
                      )}
                      {submission.description && (
                        <details className="mb-2 rounded-xl border border-gray-700/50 bg-background px-2.5 py-1.5">
                          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            {t('common.description')}
                          </summary>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                            {submission.description}
                          </p>
                        </details>
                      )}

                      <div className="mt-2 sm:mt-3 rounded-lg overflow-hidden border border-gray-700/30">
                        <SoundCloudEmbed
                          id={`reviewed-${submission.id}`}
                          embedHtml={reviewedEmbedData[submission.id]?.html ?? null}
                          embedError={!!reviewedEmbedData[submission.id]?.error}
                          soundcloudUrl={submission.soundcloud_url}
                          embedUrl={getEmbedUrl(submission.soundcloud_url)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-700/50 bg-background/40 px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-600/50 bg-background-lighter text-text-muted">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-text-secondary">{t('dashboard.noReviewedYet')}</p>
                <p className="mt-1 text-xs text-text-muted">{t('dashboard.yourReviewedSubmissions')}</p>
              </div>
            )}
          </div>

          <div className={showPane('vods')}>
            <HomeStreamSection />
          </div>

            </div>

          {/* Sidebar: TOTM+Queue; desktop XP cards; phone uses dedicated XP pane */}
          <aside className="flex flex-col gap-3 sm:gap-4 mt-0 lg:mt-0 lg:w-80 xl:w-96 lg:shrink-0 lg:sticky lg:top-16">
            <div className={`${showPane('queue')} order-1 space-y-2.5 sm:space-y-2`}>
              <Link
                href="/totm"
                className="w-full h-11 sm:h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/10 border-2 border-primary/40 text-primary font-bold text-sm hover:bg-primary/20 hover:border-primary/50 transition-colors touch-manipulation"
              >
                <TotmLeaderboardIcon className="h-[18px] w-[18px] shrink-0" />
                <span>{t('totm.title')}</span>
              </Link>
              <TotmDashboardPanel onAvailableSkipsChange={setTotmAvailableSkips} />
              <div className="bg-background-light rounded-xl sm:rounded-2xl shadow-lg border-2 border-gray-700/60 overflow-hidden animate-fade-in w-full p-3 sm:p-4">
                <Queue
                  embedded
                  currentUserId={user?.id}
                  refetchTrigger={queueRefetchTrigger}
                  onQueueLoaded={handleQueueLoaded}
                />
              </div>
            </div>

            <div className="hidden lg:block order-2 space-y-3">
              <DashboardFooter
                xp={xp}
                xpUsedThisSession={xpUsedThisSession}
                usedCap={user?.role === 'tester' ? null : 300}
                externalXpThisSession={externalXpThisSession}
                timeXpActive={xpStatus?.time_xp_active ?? null}
                followingMikegtcoff={xpStatus?.following_mikegtcoff ?? null}
                carryoverCount={carryoverCount}
                xpLog={xpLog}
                loadingLog={loadingXpLog}
                onShowXpHelp={() => setShowXpHelpModal(true)}
                onShowIndicatorsHelp={() => setShowIndicatorsHelpModal(true)}
                useXpAllowed={useXpAllowed}
                useXpReason={useXpReason}
                panel="status"
              />
              <DashboardFooter
                xp={xp}
                xpUsedThisSession={xpUsedThisSession}
                usedCap={user?.role === 'tester' ? null : 300}
                externalXpThisSession={externalXpThisSession}
                timeXpActive={xpStatus?.time_xp_active ?? null}
                followingMikegtcoff={xpStatus?.following_mikegtcoff ?? null}
                carryoverCount={carryoverCount}
                xpLog={xpLog}
                loadingLog={loadingXpLog}
                onShowXpHelp={() => setShowXpHelpModal(true)}
                panel="tools"
              />
            </div>
          </aside>
          </div>

          {/* Phone XP pane — built for mobile */}
          <div className={`${mobilePane === 'xp' ? 'block' : 'hidden'} lg:hidden`}>
            <MobileXpPane
              xp={xp}
              xpUsedThisSession={xpUsedThisSession}
              usedCap={user?.role === 'tester' ? null : 300}
              useXpAllowed={useXpAllowed}
              useXpReason={useXpReason}
              useXpLoading={useXpLoading}
              useXpClicking={useXpClicking}
              onUseXp={handleUseXp}
              onShowXpHelp={() => setShowXpHelpModal(true)}
              xpLog={xpLog}
              loadingLog={loadingXpLog}
            />
          </div>

          {/* Quiet legal links — desktop only (kept off the email footer) */}
          <div className="hidden lg:flex pt-2 pb-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
            <Link href="/terms" className="hover:text-primary transition-colors">
              {t('home.termsOfService')}
            </Link>
            <span className="text-gray-700" aria-hidden>·</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              {t('home.privacyPolicy')}
            </Link>
          </div>
        </div>
      </div>

      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-700/60 bg-background-light/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
        aria-label="Sections"
      >
        <div className="grid grid-cols-4 px-1 pt-1">
          {([
            { id: 'tracks' as const, label: t('dashboard.submissions'), icon: 'tracks' as const },
            { id: 'queue' as const, label: t('queue.title'), icon: 'queue' as const },
            { id: 'vods' as const, label: t('home.vodsNav'), icon: 'vods' as const },
            { id: 'xp' as const, label: 'XP', icon: 'xp' as const },
          ]).map((item) => {
            const active = mobilePane === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMobilePane(item.id)
                  if (item.id === 'tracks' && !showPendingTab) {
                    void fetchReviewedSubmissions('show')
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-bold leading-none touch-manipulation rounded-lg transition-colors ${
                  active
                    ? 'bg-primary/12 text-primary'
                    : 'text-text-muted'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      item.icon === 'tracks'
                        ? 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                        : item.icon === 'queue'
                          ? 'M4 6h16M4 12h16M4 18h10'
                          : item.icon === 'vods'
                            ? 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            : 'M13 10V3L4 14h7v7l9-11h-7z'
                    }
                  />
                </svg>
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

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
            <h3 className="text-lg font-semibold text-text-primary mb-2">{t('common.logOutConfirm')}</h3>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              {t('common.logOutConfirmDesc')}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-background border border-gray-600 text-text-primary text-base font-semibold hover:bg-gray-700 transition-colors touch-manipulation sm:w-auto sm:min-h-[44px] sm:rounded-button sm:py-2 sm:text-sm sm:font-medium"
              >
                {t('common.stay')}
              </button>
              <button
                type="button"
                onClick={performLogout}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-base font-semibold transition-colors touch-manipulation sm:w-auto sm:min-h-[44px] sm:rounded-button sm:py-2 sm:text-sm sm:font-medium"
              >
                {t('common.logOut')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
