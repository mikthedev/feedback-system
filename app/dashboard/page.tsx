'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Queue, { type QueueLoadedItem } from '../components/Queue'
import XpHelpModal, { getXpHelpDismissed } from '../components/XpHelpModal'
import IndicatorsHelpModal from '../components/IndicatorsHelpModal'
import DashboardFooter from '../components/DashboardFooter'
import SoundCloudEmbed from '../components/SoundCloudEmbed'
import { useLanguage } from '@/app/context/LanguageContext'

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
  const [xpAdjustValue, setXpAdjustValue] = useState('')
  const [xpAdjusting, setXpAdjusting] = useState(false)
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
  const [xpAdjustMessage, setXpAdjustMessage] = useState<string | null>(null)
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
  const [grantUsers, setGrantUsers] = useState<Array<{ id: string; display_name: string }>>([])
  const [grantTargetId, setGrantTargetId] = useState<string>('self')
  const [grantAmount, setGrantAmount] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantMessage, setGrantMessage] = useState<string | null>(null)

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

  const fetchGrantUsers = async () => {
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setGrantUsers(data.users ?? [])
    } catch {
      setGrantUsers([])
    }
  }

  const handleGrantXp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.role !== 'curator') return
    setGrantMessage(null)
    setGrantLoading(true)
    try {
      const amount = parseInt(grantAmount, 10)
      if (Number.isNaN(amount) || amount === 0) {
        setGrantMessage(t('dashboard.grantEnterAmount'))
        return
      }
      const res = await fetch('/api/xp/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: grantTargetId === 'self' || !grantTargetId ? undefined : grantTargetId,
          amount,
        }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGrantMessage(data?.error ?? t('dashboard.grantFailed'))
        return
      }
      setGrantMessage(data.message ?? t('dashboard.done'))
      setGrantAmount('')
      if (grantTargetId === 'self' || !grantTargetId) {
        fetchXp()
        setUser((u) => (u ? { ...u, xp: data.new_total } : null))
        setXp(data.new_total)
      }
    } catch (err) {
      setGrantMessage(t('common.somethingWentWrong'))
    } finally {
      setGrantLoading(false)
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
    fetchXp()
    fetchXpStatus()
    fetchXpLog()
    fetchCarryoverCount()
    fetchCanMove()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch
  }, [])

  // Poll submission status; refetch submissions when open/closed changes (e.g. MikeGTC toggles)
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
      fetchCanMove()
    }
    const handler = () => document.visibilityState === 'visible' && onFocus()
    window.addEventListener('visibilitychange', handler)
    return () => window.removeEventListener('visibilitychange', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [])

  useEffect(() => {
    if (user?.role === 'curator') fetchGrantUsers()
  }, [user?.role])

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
        throw new Error(data?.error || t('dashboard.adjustXpFailed'))
      }
      const data = await res.json()
      const next = typeof data.xp === 'number' ? data.xp : parseInt(String(data.xp || 0), 10) || 0
      setXp(Math.max(0, next))
      setUser((u) => (u ? { ...u, xp: next } : null))
      setXpAdjustValue('')
      setXpAdjustMessage(t('dashboard.xpUpdatedUseXp'))
      fetchXp()
      fetchCanMove()
    } catch (e) {
      console.error('XP adjust error:', e)
      alert(e instanceof Error ? e.message : t('dashboard.adjustXpFailed'))
    } finally {
      setXpAdjusting(false)
    }
  }

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
        setUseXpMessage(data?.error || t('dashboard.useXpFailed'))
        setUseXpBlocked(true)
        return
      }
      const moved = data.movesApplied > 0
      setUseXpBlocked(!moved)
      setUseXpMessage(data.message ?? (moved ? t('dashboard.done') : ''))
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

  useEffect(() => {
    if (!grantMessage) return
    const t = setTimeout(() => setGrantMessage(null), 5000)
    return () => clearTimeout(t)
  }, [grantMessage])

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

  return (
    <div className="bg-background animate-page-transition">{/* Floating Status Banner - compact */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out pt-[env(safe-area-inset-top)] px-3 sm:px-4 md:px-5 ${getBannerClasses()} ${getBannerAnimation()}`}
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
      <div className="pt-11 sm:pt-12 md:pt-14 px-3 sm:px-4 md:px-5 pb-4 sm:pb-5">
        <div className="max-w-6xl mx-auto space-y-4">
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

          <div className="lg:flex lg:gap-6 lg:items-start">
            {/* Main column: welcome, submissions, reviewed — even space-y-4 */}
            <div className="lg:flex-1 lg:min-w-0 space-y-4">
          {/* Welcome card */}
          <div className="bg-background-light rounded-2xl shadow-lg p-5 sm:p-6 animate-fade-in border-2 border-gray-700/60 overflow-hidden relative">
            <div
              className="absolute top-0 left-0 right-0 h-1 opacity-70"
              style={{
                background: `linear-gradient(to right, transparent, ${accentColor ?? 'rgba(202,247,111,0.5)'}, transparent)`,
              }}
              aria-hidden
            />
            <div className="flex flex-col gap-5 sm:gap-6">
              {/* Header: avatar, greeting, logout */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {(profileImageUrl ?? user.profile_image_url) && !profileImageFailed ? (
                    <img
                      src={profileImageUrl ?? user.profile_image_url ?? ''}
                      alt=""
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full border-2 border-primary/30 bg-background object-cover shadow-lg"
                      onError={() => setProfileImageFailed(true)}
                    />
                  ) : (
                    <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full border-2 border-primary/30 bg-background-lighter flex items-center justify-center text-primary text-xl sm:text-2xl font-black" aria-hidden>
                      {(user.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-extrabold text-text-primary tracking-tight">
                      {t('dashboard.welcome')}{' '}
                      <span className="text-primary">{user.display_name}</span>
                    </h1>
                    {user.role === 'curator' ? (
                      <p className="text-sm text-primary font-semibold mt-0.5">{t('dashboard.mikegtcPanel')}</p>
                    ) : (
                      <p className="text-sm text-text-secondary mt-0.5">{t('dashboard.submitAndTrack')}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openLogoutConfirm}
                  className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl bg-background/80 hover:bg-gray-700/60 text-text-muted hover:text-text-primary border border-gray-600/60 transition-all duration-200 active:scale-[0.97]"
                  title={t('common.logOut')}
                  aria-label={t('common.logOut')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>

              {useXpMessage && (
                <p className={`text-sm font-semibold rounded-lg px-4 py-3 animate-scale-in border ${
                  useXpBlocked ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-primary bg-primary/10 border-primary/30'
                }`}>
                  {useXpMessage}
                </p>
              )}

              {/* Quick actions + XP */}
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">{t('dashboard.quickActions')}</p>
                {/* Mobile: Submit Demo | Carryover same length, XP full width below. Desktop: flex row */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch gap-3 w-full">
                  {/* Row 1 on mobile: Submit Demo + Carryover (equal width). On desktop: inline with XP */}
                  <div className="grid grid-cols-2 sm:contents gap-3">
                    <Link
                      href="/submit"
                      className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border-2 border-primary/40 font-bold text-sm transition-all active:scale-[0.98] sm:shrink-0"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      {t('dashboard.submitDemo')}
                    </Link>
                    <Link
                      href="/carryover"
                      className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border-2 border-primary/40 font-bold text-sm transition-all active:scale-[0.98] sm:shrink-0"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {t('dashboard.carryover')} {carryoverCount > 0 ? `(${carryoverCount})` : ''}
                    </Link>
                  </div>
                  {user.role === 'curator' && (
                    <Link
                      href="/curator"
                      className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border-2 border-primary/40 font-bold text-sm transition-all active:scale-[0.98] sm:shrink-0 w-full sm:w-auto"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      MikeGTC
                    </Link>
                  )}
                  {/* XP bar — progress reaches to Use XP button; on mobile full width */}
                  <div className="flex items-stretch rounded-xl overflow-hidden border-2 border-primary bg-primary/25 min-h-[48px] w-full sm:flex-1 sm:min-w-[200px]" title={!useXpAllowed && useXpReason ? useXpReason : t('dashboard.spend100Xp')}>
                    <div className="flex items-center gap-2 pl-3 pr-2 py-2 min-w-0 flex-1 w-full">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider shrink-0">XP</span>
                      <span className={`text-base font-black text-primary tabular-nums shrink-0 ${xp >= 100 ? 'animate-xp-number-pulse' : ''}`}>{xp}</span>
                      {xpInBlock > 0 && xp < 9999 && (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="h-2.5 bg-background/60 rounded-full overflow-hidden flex-1 min-w-0 border-2 border-primary/40">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xpInBlock}%` }} />
                          </div>
                          <span className="text-[10px] text-primary/90 tabular-nums font-bold shrink-0">{xpToNext} to +1</span>
                        </div>
                      )}
                    </div>
                    <div className="w-px bg-primary/50 self-stretch shrink-0" aria-hidden />
                    <button
                      type="button"
                      onClick={handleUseXp}
                      disabled={!useXpAllowed || useXpLoading}
                      title={useXpReason || t('dashboard.spend100XpPosition')}
                      className={`shrink-0 min-w-[80px] min-h-[48px] px-3 font-bold text-xs text-background bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors flex items-center justify-center ${useXpClicking ? 'animate-use-xp-click' : 'button-press'}`}
                    >
                      {useXpLoading ? '…' : t('dashboard.useXp')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Curator: Grant XP to any user or self */}
          {user.role === 'curator' && (
            <div className="bg-primary/5 rounded-xl shadow-lg p-4 border-2 border-primary/40 animate-fade-in">
              <h2 className="text-base font-extrabold text-text-primary mb-1">{t('dashboard.grantXp')}</h2>
              <p className="text-sm text-text-secondary mb-4 font-medium">{t('dashboard.grantXpDesc')}</p>
              <form onSubmit={handleGrantXp} className="flex flex-wrap items-center gap-3 sm:gap-4">
                <select
                  value={grantTargetId}
                  onChange={(e) => setGrantTargetId(e.target.value)}
                  className="min-h-[48px] px-4 py-2 rounded-xl bg-background-lighter border-2 border-gray-600 text-text-primary text-sm font-medium focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                >
                  <option value="self">{t('dashboard.myself')}</option>
                  {grantUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-24 sm:w-28 px-4 py-3 rounded-xl bg-background-lighter border-2 border-gray-600 text-text-primary text-base font-semibold focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none min-h-[48px]"
                />
                <button type="submit" disabled={grantLoading || !grantAmount.trim()} className="min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation border-2 border-transparent">
                  {grantLoading ? '…' : t('common.apply')}
                </button>
              </form>
              {grantMessage && (
                <p className="mt-3 text-sm font-bold text-primary bg-primary/10 border-2 border-primary/40 rounded-lg px-4 py-2 animate-scale-in">
                  {grantMessage}
                </p>
              )}
            </div>
          )}

          {/* Tester panel */}
          {user.role === 'tester' && (
            <div className="bg-amber-500/5 rounded-xl shadow-lg p-4 border-2 border-amber-500/40 animate-fade-in">
              <h2 className="text-base font-extrabold text-text-primary mb-1">{t('dashboard.adjustXp')}</h2>
              <p className="text-sm text-text-secondary mb-4 font-medium">{t('dashboard.adjustXpDesc')}</p>
              <form onSubmit={handleXpAdjustSubmit} className="flex flex-wrap items-center gap-4">
                <input
                  type="number"
                  value={xpAdjustValue}
                  onChange={(e) => setXpAdjustValue(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-24 sm:w-28 px-4 py-3 rounded-xl bg-background-lighter border-2 border-gray-600 text-text-primary text-base font-semibold focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none min-h-[48px]"
                />
                <button type="submit" disabled={xpAdjusting || !xpAdjustValue.trim()} className="min-h-[48px] px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-background text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation border-2 border-transparent">
                  {xpAdjusting ? '…' : t('common.apply')}
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

          <div className="bg-background-light rounded-xl shadow-lg p-4 animate-fade-in border-2 border-gray-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg border-2 border-primary/30 shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <h2 className="text-base font-extrabold text-text-primary tracking-tight truncate">{t('dashboard.yourSubmissions')}</h2>
                  {submissions.length > 0 && (
                    <span className="text-sm font-bold text-text-secondary bg-background-lighter px-3 py-1 rounded-full border-2 border-gray-600 shrink-0">
                      {submissions.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getAverageScores() && (
                  <button
                    onClick={() => setShowAvgMetrics(!showAvgMetrics)}
                    className={`min-h-[40px] flex items-center justify-center gap-1 px-2 py-2 rounded-lg touch-manipulation active:scale-[0.98] transition-all duration-200 ${
                      showAvgMetrics 
                        ? 'bg-background-lighter hover:bg-primary/10 border-2 border-gray-600 hover:border-primary/40' 
                        : 'bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary/60'
                    }`}
                  >
                    <span className="text-xs text-primary font-bold uppercase tracking-wider">Avg</span>
                    <span className="text-xs font-black text-primary tabular-nums">
                      {((Number(getAverageScores()!.sound) + Number(getAverageScores()!.structure) + Number(getAverageScores()!.mix) + Number(getAverageScores()!.vibe)) / 4).toFixed(1)}
                    </span>
                  </button>
                )}
                <button
                  onClick={fetchReviewedSubmissions}
                  disabled={loadingReviewed}
                  className="min-h-[40px] flex items-center justify-center gap-2 px-4 py-2 bg-background-lighter hover:bg-primary/10 border-2 border-gray-600 hover:border-primary/40 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation text-sm font-bold"
                >
                  {loadingReviewed ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs font-medium text-text-primary">{t('dashboard.loading')}</span>
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
                      <span className="text-xs font-medium text-text-primary group-hover:text-primary transition-colors duration-200">
                        {showReviewed ? t('common.hide') : t('dashboard.results')}
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
            </div>
            {getAverageScores() && showAvgMetrics && (
              <div className="mb-4 hidden md:grid grid-cols-4 gap-2">
                {[
                  { label: 'Sound', score: getAverageScores()!.sound, bg: 'bg-[#1E2A4A]', border: 'border-[#6A707B]', text: 'text-[#64B5F6]' },
                  { label: 'Structure', score: getAverageScores()!.structure, bg: 'bg-[#1E4A2E]', border: 'border-[#6A707B]', text: 'text-[#66BB6A]' },
                  { label: 'Mix', score: getAverageScores()!.mix, bg: 'bg-[#4A1E3A]', border: 'border-[#6A707B]', text: 'text-[#F48FB1]' },
                  { label: 'Vibe', score: getAverageScores()!.vibe, bg: 'bg-[#4A3A1E]', border: 'border-[#6A707B]', text: 'text-[#FFD54F]' },
                ].map(({ label, score, bg, border, text }) => (
                  <div 
                    key={label} 
                    className={`${bg} border-2 ${border} rounded-lg px-2 py-2 text-center flex flex-col items-center justify-center min-h-[56px]`}
                    title={label}
                  >
                    <div className={`text-[8px] ${text} font-bold uppercase mb-1 opacity-90 leading-none`}>{label}</div>
                    <div className={`text-base font-black ${text} tabular-nums leading-none flex items-baseline justify-center gap-0.5`}>
                      <span>{score}</span>
                      <span className="text-xs opacity-70 leading-none">/10</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          {submissions.length === 0 ? (
            <p className="text-sm font-medium text-text-secondary py-4">{t('dashboard.noSubmissions')}</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission, index) => (
                <div
                  key={submission.id}
                  className="border-2 rounded-xl p-4 hover:shadow-lg hover:border-primary/40 transition-all duration-200 animate-slide-in bg-background-lighter border-gray-700/50"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg border border-gray-800/50 bg-background-lighter px-2.5 py-1">
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
                      <span className="hidden sm:inline-block px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-background border-2 border-gray-600 text-text-secondary">
                        {t('common.pending')}
                      </span>
                      <Link href={`/submit?edit=${submission.id}`} className="px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary/60 text-primary transition-colors touch-manipulation">
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
                      <div className="mb-3 p-3 bg-background rounded-xl border-2 border-gray-700/50">
                        <div className="text-[8px] text-text-secondary font-bold uppercase tracking-wider mb-1.5 opacity-90">{t('common.description')}</div>
                        <p className={`text-sm text-text-secondary break-words whitespace-pre-wrap leading-relaxed ${showFull ? '' : 'line-clamp-2'}`}>
                          {submission.description}
                        </p>
                        {showToggle && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); toggleDescriptionExpanded(submission.id) }}
                            className="mt-2 text-xs font-bold text-primary hover:underline touch-manipulation"
                          >
                            {isExpanded ? t('common.hide') : t('common.showMore')}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  <div className="mt-3">
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
            <div className="bg-background-light rounded-xl shadow-lg p-4 animate-fade-in border-2 border-gray-700/60">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg border-2 border-primary/30 shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <h2 className="text-base font-extrabold text-text-primary tracking-tight">{t('dashboard.results')}</h2>
                  {reviewedSubmissions.length > 0 && (
                    <span className="text-sm font-bold text-text-secondary bg-background-lighter px-3 py-1 rounded-full border-2 border-gray-600">
                      {reviewedSubmissions.length}
                    </span>
                  )}
                </div>
              </div>
              {reviewedSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {reviewedSubmissions.map((submission, index) => {
                    const review = submission.reviews?.[0]
                    const avgScore = review ? ((Number(review.sound_score) + Number(review.structure_score) + Number(review.mix_score) + Number(review.vibe_score)) / 4).toFixed(1) : null
                    const audienceRating = submission.audience_score !== null && submission.audience_score !== undefined ? Number(submission.audience_score).toFixed(1) : '0.0'
                    
                    return (
                    <div
                      key={submission.id}
                      className="border-2 rounded-xl p-4 hover:shadow-lg hover:border-primary/40 transition-all duration-200 animate-slide-in bg-background-lighter border-gray-700/50"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Header with title, artist, date */}
                      <div className="flex items-start justify-between gap-3 mb-3">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-lg border border-gray-800/50 bg-background-lighter px-2.5 py-1">
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

                      {/* Description - Special field like scores if text exists */}
                      {submission.description && (() => {
                        const isLong = submission.description.length > DESCRIPTION_COLLAPSE_THRESHOLD
                        const isExpanded = expandedDescriptionIds.has(submission.id)
                        const showToggle = isLong
                        const showFull = !showToggle || isExpanded
                        return (
                          <div className="mb-3 p-3 bg-background rounded-xl border-2 border-gray-700/50">
                            <div className="mb-1.5">
                              <div className="text-[8px] text-text-secondary font-bold uppercase tracking-wider mb-1 opacity-90">{t('common.description')}</div>
                            </div>
                            <p className={`text-sm text-text-secondary break-words whitespace-pre-wrap leading-relaxed ${showFull ? '' : 'line-clamp-2'}`}>
                              {submission.description}
                            </p>
                            {showToggle && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); toggleDescriptionExpanded(submission.id) }}
                                className="mt-2 text-xs font-bold text-primary hover:underline touch-manipulation"
                              >
                                {isExpanded ? t('common.hide') : t('common.showMore')}
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* Scores Display */}
                      {review && (
                        <div className="mb-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: 'Sound', score: review.sound_score, bg: 'bg-[#1E2A4A]', border: 'border-[#6A707B]', text: 'text-[#64B5F6]' },
                              { label: 'Structure', score: review.structure_score, bg: 'bg-[#1E4A2E]', border: 'border-[#6A707B]', text: 'text-[#66BB6A]' },
                              { label: 'Mix', score: review.mix_score, bg: 'bg-[#4A1E3A]', border: 'border-[#6A707B]', text: 'text-[#F48FB1]' },
                              { label: 'Vibe', score: review.vibe_score, bg: 'bg-[#4A3A1E]', border: 'border-[#6A707B]', text: 'text-[#FFD54F]' },
                            ].map(({ label, score, bg, border, text }) => (
                              <div 
                                key={label} 
                                className={`${bg} border-2 ${border} rounded-lg px-2 py-2 text-center flex flex-col items-center justify-center min-h-[56px]`}
                                title={label}
                              >
                                <div className={`text-[8px] ${text} font-bold uppercase mb-1 opacity-90 leading-none`}>{label}</div>
                                <div className={`text-base font-black ${text} tabular-nums leading-none flex items-baseline justify-center gap-0.5`}>
                                  <span>{score}</span>
                                  <span className="text-xs opacity-70 leading-none">/10</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SoundCloud embed */}
                      <div className="mt-3 rounded-lg overflow-hidden border border-gray-700/30">
                        <SoundCloudEmbed
                          id={`reviewed-${submission.id}`}
                          embedHtml={reviewedEmbedData[submission.id]?.html ?? null}
                          embedError={!!reviewedEmbedData[submission.id]?.error}
                          soundcloudUrl={submission.soundcloud_url}
                          embedUrl={getEmbedUrl(submission.soundcloud_url)}
                        />
                      </div>

                      {/* Rating Display - Below embed */}
                      {avgScore && (
                        <div className="mt-3">
                          <div className="flex flex-row gap-2">
                            <div className="flex-1 min-w-0 bg-primary/5 rounded-lg p-2 border border-primary/20">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></div>
                                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider truncate">{t('dashboard.averageRatingLabel')}</span>
                                  </div>
                                  <div className="flex items-baseline gap-1 mb-0.5">
                                    <span className="text-lg font-black text-primary tabular-nums">{avgScore}</span>
                                    <span className="text-[10px] text-text-secondary font-semibold opacity-60">/ 10</span>
                                  </div>
                                  <p className="text-[9px] text-text-secondary font-medium leading-tight">
                                    {t('dashboard.averageRating')}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 bg-[#FFD54F]/5 rounded-lg p-2 border border-[#FFD54F]/20">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFD54F] flex-shrink-0"></div>
                                    <span className="text-[9px] text-[#FFD54F] font-bold uppercase tracking-wider truncate">{t('dashboard.audienceRatingLabel')}</span>
                                  </div>
                                  <div className="flex items-baseline gap-1 mb-0.5">
                                    <span className="text-lg font-black text-[#FFD54F] tabular-nums">{audienceRating}</span>
                                    <span className="text-[10px] text-text-secondary font-semibold opacity-60">/ 10</span>
                                  </div>
                                  <p className="text-[9px] text-text-secondary font-medium leading-tight">
                                    {t('dashboard.audienceRating')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex p-3 bg-background-lighter rounded-full mb-3 border-2 border-gray-600">
                    <svg className="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary font-medium text-sm">{t('dashboard.noReviewedYet')}</p>
                  <p className="text-xs text-text-muted mt-1">{t('dashboard.yourReviewedSubmissions')}</p>
                </div>
              )}
            </div>
          )}

            </div>

          {/* Sidebar: on phone Queue above XP footer; on lg XP footer above Queue */}
          <aside className="flex flex-col gap-4 mt-4 lg:mt-0 lg:w-80 xl:w-96 lg:shrink-0 lg:sticky lg:top-16">
            <div className="order-1 lg:order-2">
              <Queue
                currentUserId={user?.id}
                refetchTrigger={queueRefetchTrigger}
                onQueueLoaded={handleQueueLoaded}
              />
            </div>
            <div className="order-2 lg:order-1">
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
                useXpAllowed={useXpAllowed}
                useXpReason={useXpReason}
              />
            </div>
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
