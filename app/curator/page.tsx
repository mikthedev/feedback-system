'use client'

import { useState, useEffect, memo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import XpHelpModal from '../components/XpHelpModal'
import SessionPreviewModal from '../components/SessionPreviewModal'
import { useLanguage } from '@/app/context/LanguageContext'
import { playKnobTick, preloadKnobSound } from '@/lib/knob-sound'

// Memoized embed component to prevent re-renders when scores change
const SoundCloudEmbed = memo(({ 
  embedData, 
  soundcloudUrl, 
  getEmbedUrl,
  submissionId
}: { 
  embedData: EmbedData | null
  soundcloudUrl: string
  getEmbedUrl: (url: string) => string
  submissionId: string
}) => {
  // Use submissionId as key to prevent unnecessary re-renders
  const embedUrl = getEmbedUrl(soundcloudUrl)
  
  return (
    <div className="mb-4" key={submissionId}>
      {embedData?.html ? (
        <div 
          className="soundcloud-embed w-full"
          style={{ maxWidth: '100%', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: embedData.html }}
        />
      ) : embedData?.error ? (
        <div className="p-4 bg-background-lighter rounded-lg border border-gray-800/50">
          <p className="text-sm text-text-secondary mb-2">
            Unable to embed this track. 
            <a 
              href={soundcloudUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline underline-offset-2 ml-1 transition-colors duration-200"
            >
              Open in SoundCloud
            </a>
          </p>
          <iframe
            key={`embed-${submissionId}`}
            width="100%"
            height="166"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={embedUrl}
            className="rounded"
            title="SoundCloud Player"
          ></iframe>
        </div>
      ) : (
        <iframe
          key={`embed-${submissionId}`}
          width="100%"
          height="166"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          className="rounded"
          title="SoundCloud Player"
        ></iframe>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Only re-render if submissionId or soundcloudUrl changes, not if scores change
  return prevProps.submissionId === nextProps.submissionId && 
         prevProps.soundcloudUrl === nextProps.soundcloudUrl &&
         prevProps.embedData?.html === nextProps.embedData?.html
})

SoundCloudEmbed.displayName = 'SoundCloudEmbed'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function useCountUp(target: number, fullDurationMs: number, animEpoch: number): number {
  const [v, setV] = useState(0)
  const prevEpochRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    const epochBumped = prevEpochRef.current !== animEpoch
    prevEpochRef.current = animEpoch
    const from = epochBumped ? 0 : fromRef.current
    const duration = epochBumped ? fullDurationMs : Math.min(420, fullDurationMs)

    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      const next = from + (target - from) * eased
      setV(next)
      if (p < 1) {
        raf = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, fullDurationMs, animEpoch])
  return v
}

function AnimatedAudienceAvg({ value, epoch }: { value: number; epoch: number }) {
  const v = useCountUp(value, 1000, epoch)
  return <span className="inline-block tabular-nums">{v.toFixed(1)}</span>
}

function AnimatedAudienceCount({ value, epoch }: { value: number; epoch: number }) {
  const v = useCountUp(value, 900, epoch)
  return <span className="inline-block tabular-nums">{Math.round(v)}</span>
}

interface Submission {
  id: string
  user_id: string
  soundcloud_url: string
  description?: string
  artist_name?: string
  song_title?: string
  genre?: string | null
  status: string
  session_number?: number
  created_at: string
  users: {
    display_name: string
    twitch_id: string
    profile_image_url?: string | null
  }
  moves_used_this_session?: number
}

interface EmbedData {
  html?: string
  error?: string
  thumbnail_url?: string
}

interface SubmissionArtwork {
  [key: string]: string | null
}

interface SoundCloudMetadata {
  title?: string
  author_name?: string
}

export default function CuratorPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [scores, setScores] = useState({
    sound_score: '0',
    structure_score: '0',
    mix_score: '0',
    vibe_score: '0',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string | boolean>(false)
  const [submissionsOpen, setSubmissionsOpen] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [clearingXp, setClearingXp] = useState(false)
  const [embedData, setEmbedData] = useState<EmbedData | null>(null)
  const [submissionArtworks, setSubmissionArtworks] = useState<SubmissionArtwork>({})
  const [submissionSoundCloudMetadata, setSubmissionSoundCloudMetadata] = useState<Record<string, SoundCloudMetadata>>({})
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionsToDelete, setSessionsToDelete] = useState<number[]>([])
  const [previewSessionNumber, setPreviewSessionNumber] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showXpHelpModal, setShowXpHelpModal] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [showRatingSliders, setShowRatingSliders] = useState(false)
  const [closingRatingOverlay, setClosingRatingOverlay] = useState(false)
  const [showSubmitterIntro, setShowSubmitterIntro] = useState(false)
  const [closingSubmitterIntro, setClosingSubmitterIntro] = useState(false)
  const [introKey, setIntroKey] = useState(0)
  const [handoff, setHandoff] = useState<{
    phase: 'leaving' | 'between' | 'entering'
    fromName: string
    toName: string
    toAvatar: string | null
  } | null>(null)
  const handoffLockRef = useRef(false)
  const [queueCleared, setQueueCleared] = useState(false)
  const queueClearedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerQueueCleared = () => {
    setQueueCleared(true)
    if (queueClearedTimerRef.current) clearTimeout(queueClearedTimerRef.current)
    queueClearedTimerRef.current = setTimeout(() => setQueueCleared(false), 5200)
  }
  const [showSubmitters, setShowSubmitters] = useState(false)
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null)
  const [grantingXpForUserId, setGrantingXpForUserId] = useState<string | null>(null)
  const prevQueuePositionsRef = useRef<Record<string, number>>({})
  const isFirstQueueRenderRef = useRef(true)
  const [xp, setXp] = useState(0)
  const [useXpAllowed, setUseXpAllowed] = useState(false)
  const [useXpReason, setUseXpReason] = useState('')
  const [useXpLoading, setUseXpLoading] = useState(false)
  const [overlayAudience, setOverlayAudience] = useState<{
    vote_count: number
    average: number | null
  }>({ vote_count: 0, average: null })
  const [ratingAnimEpoch, setRatingAnimEpoch] = useState(0)

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
    } catch { /* ignore */ }
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

  const handleUseXp = async () => {
    setUseXpLoading(true)
    try {
      const res = await fetch('/api/xp/use', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (data.movesApplied > 0) {
        fetchXp()
        fetchCanMove()
        fetchPendingSubmissions()
      }
    } catch { /* ignore */ }
    finally {
      setUseXpLoading(false)
    }
  }

  const fetchSubmissionsStatus = async () => {
    try {
      const response = await fetch('/api/settings/submissions', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSubmissionsOpen(data.submissions_open ?? true)
      }
    } catch (error) {
      console.error('Error fetching submissions status:', error)
    }
  }

  const fetchSessions = async () => {
    setLoadingSessions(true)
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleDeleteSessions = async (sessionNumbers?: number[], deleteAll?: boolean) => {
    if (!showDeleteConfirm) {
      // Show confirmation
      if (deleteAll) {
        setSessionsToDelete([])
        setShowDeleteConfirm(true)
      } else if (sessionNumbers && sessionNumbers.length > 0) {
        setSessionsToDelete(sessionNumbers)
        setShowDeleteConfirm(true)
      }
      return
    }

    // Actually delete
    setDeleting(true)
    setError('')
    
    try {
      const response = await fetch('/api/sessions/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_numbers: sessionsToDelete.length > 0 ? sessionsToDelete : sessionNumbers,
          delete_all: deleteAll || false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to delete sessions')
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      setSuccess(data.message || 'Sessions deleted successfully!')
      setShowDeleteConfirm(false)
      setSessionsToDelete([])
      
      // Refresh sessions and submissions
      fetchSessions()
      fetchPendingSubmissions()
      
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setError('An error occurred while deleting sessions.')
    } finally {
      setDeleting(false)
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
      if (data.user.role !== 'curator') {
        router.push('/dashboard')
        return
      }
      setUser(data.user)
    } catch (error) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingSubmissions = async (): Promise<Submission[]> => {
    try {
      const response = await fetch('/api/submissions/pending', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const list: Submission[] = data.submissions || []
        setSubmissions(list)

        const artworkPromises = list.map(async (submission: Submission) => {
          try {
            const embedResponse = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(submission.soundcloud_url)}`)
            if (embedResponse.ok) {
              const embedResult = await embedResponse.json()
              // SoundCloud oEmbed returns title (e.g. "Flickermood by Forss" or "Artist - Track") and sometimes author_name
              let title = embedResult.title?.trim()
              let author_name = embedResult.author_name?.trim()
              if (title) {
                if (title.includes(' by ') && !author_name) {
                  const parts = title.split(' by ').map((s: string) => s.trim()).filter(Boolean)
                  if (parts.length >= 2) {
                    author_name = parts[parts.length - 1]
                    title = parts.slice(0, -1).join(' by ')
                  }
                } else if (title.includes(' - ')) {
                  const parts = title.split(' - ')
                  title = parts[parts.length - 1]?.trim() || title
                  if (parts.length > 1 && !author_name) author_name = parts[0]?.trim()
                }
              }
              return {
                id: submission.id,
                artwork: embedResult.thumbnail_url || null,
                title: title || undefined,
                author_name: author_name || undefined,
              }
            }
          } catch (error) {
            console.error('Error fetching artwork:', error)
          }
          return { id: submission.id, artwork: null, title: undefined, author_name: undefined }
        })
        
        const artworkResults = await Promise.all(artworkPromises)
        const artworkMap: SubmissionArtwork = {}
        const metadataMap: Record<string, SoundCloudMetadata> = {}
        artworkResults.forEach(({ id, artwork, title, author_name }) => {
          artworkMap[id] = artwork
          if (title || author_name) {
            metadataMap[id] = { title, author_name }
          }
        })
        setSubmissionArtworks(artworkMap)
        setSubmissionSoundCloudMetadata(metadataMap)
        return list
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
    }
    return []
  }

  useEffect(() => {
    fetchUser()
    fetchPendingSubmissions()
    fetchSubmissionsStatus()
    fetchSessions()
    fetchXp()
    fetchCanMove()
    return () => {
      if (queueClearedTimerRef.current) clearTimeout(queueClearedTimerRef.current)
    }
  }, [])

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

  useEffect(() => {
    const interval = setInterval(fetchPendingSubmissions, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!showRatingSliders || !selectedSubmission?.id) return
    preloadKnobSound()
    const sid = selectedSubmission.id
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/audience-rating/stats?submission_id=${encodeURIComponent(sid)}`,
          { credentials: 'include' }
        )
        if (!res.ok || cancelled) return
        const d = await res.json()
        if (!cancelled) {
          setOverlayAudience({
            vote_count: typeof d.vote_count === 'number' ? d.vote_count : 0,
            average: typeof d.average === 'number' ? d.average : null,
          })
        }
      } catch {
        /* ignore */
      }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [showRatingSliders, selectedSubmission?.id])

  // Update queue position ref after render (for move-up detection)
  useEffect(() => {
    if (submissions.length === 0) return
    prevQueuePositionsRef.current = Object.fromEntries(
      submissions.map((s, i) => [s.id, i + 1])
    )
    isFirstQueueRenderRef.current = false
  }, [submissions])

  const handleScoreChange = (field: string, value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0 || numValue > 10) return
    
    // Round to nearest 0.5
    const rounded = Math.round(numValue * 2) / 2
    setScores({ ...scores, [field]: rounded.toString() })
  }

  const handleSliderChange = (field: string, value: number) => {
    // Round to nearest 0.5
    const rounded = Math.round(value * 2) / 2
    const prev = parseFloat(scores[field as keyof typeof scores])
    setScores({ ...scores, [field]: rounded.toString() })
    if (rounded !== prev) playKnobTick(rounded)
  }

  const dismissSubmitterIntro = () => {
    if (closingSubmitterIntro) return
    setClosingSubmitterIntro(true)
  }

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  const selectSubmission = async (submission: Submission, opts?: { showIntro?: boolean }) => {
    setScores({
      sound_score: '0',
      structure_score: '0',
      mix_score: '0',
      vibe_score: '0',
    })
    setShowRatingSliders(false)
    setClosingRatingOverlay(false)
    setClosingSubmitterIntro(false)
    setShowSubmitterIntro(opts?.showIntro !== false)
    setIntroKey((k) => k + 1)
    setQueueCleared(false)
    if (queueClearedTimerRef.current) {
      clearTimeout(queueClearedTimerRef.current)
      queueClearedTimerRef.current = null
    }
    setSelectedSubmission(submission)
    setError('')
    setSuccess(false)
    setEmbedData(null)
    try {
      const embedResponse = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(submission.soundcloud_url)}`)
      if (embedResponse.ok) {
        const embedResult = await embedResponse.json()
        setEmbedData({ html: embedResult.html, thumbnail_url: embedResult.thumbnail_url })
      } else {
        setEmbedData({ error: 'Failed to load embed' })
      }
    } catch {
      setEmbedData({ error: 'Failed to load embed' })
    }
  }

  const runHandoffTo = async (
    target: Submission,
    opts?: { fromName?: string }
  ) => {
    if (handoffLockRef.current) return
    handoffLockRef.current = true

    const fromName = opts?.fromName ?? selectedSubmission?.users.display_name ?? ''
    const toName = target.users.display_name
    const toAvatar =
      (typeof target.users.profile_image_url === 'string' && target.users.profile_image_url.trim()) ||
      submissionArtworks[target.id] ||
      null

    setShowRatingSliders(false)
    setShowSubmitterIntro(false)
    setClosingSubmitterIntro(false)
    setClosingRatingOverlay(false)

    setHandoff({ phase: 'leaving', fromName, toName, toAvatar })
    await sleep(380)
    setHandoff({ phase: 'between', fromName, toName, toAvatar })
    await sleep(560)
    await selectSubmission(target, { showIntro: true })
    setHandoff({ phase: 'entering', fromName, toName, toAvatar })
    await sleep(420)
    setHandoff(null)
    handoffLockRef.current = false
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubmission) return

    setError('')
    setSuccess(false)
    setSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: selectedSubmission.id,
          sound_score: parseFloat(scores.sound_score),
          structure_score: parseFloat(scores.structure_score),
          mix_score: parseFloat(scores.mix_score),
          vibe_score: parseFloat(scores.vibe_score),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to submit review')
        setSubmitting(false)
        return
      }

      const fromName = selectedSubmission.users.display_name
      setSuccess('Review submitted successfully!')
      setShowRatingSliders(false)
      setShowSubmitterIntro(false)
      setClosingSubmitterIntro(false)
      setClosingRatingOverlay(false)
      setScores({
        sound_score: '0',
        structure_score: '0',
        mix_score: '0',
        vibe_score: '0',
      })

      const list = await fetchPendingSubmissions()
      const next = list[0] ?? null
      setSubmitting(false)

      if (next) {
        await runHandoffTo(next, { fromName })
      } else {
        setSelectedSubmission(null)
        triggerQueueCleared()
      }

      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setError('An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  const handleToggleSubmissions = async () => {
    setToggling(true)
    setError('')
    
    try {
      const response = await fetch('/api/settings/submissions', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submissions_open: !submissionsOpen,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to toggle submissions status')
        setToggling(false)
        return
      }

      // Use server response so UI stays in sync with persisted state
      const newOpen = data.submissions_open ?? !submissionsOpen
      setSubmissionsOpen(newOpen)
      setSuccess(newOpen ? 'Submissions opened.' : 'Submissions closed.')
      fetchSessions()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  const handleSkipToCarryover = async () => {
    if (!selectedSubmission) return
    if (!confirm('Move this track to Carryover? The user will need to wait 60 minutes before submitting again.')) return
    setSkipping(true)
    setError('')
    try {
      const res = await fetch(`/api/submissions/${selectedSubmission.id}/skip`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to move to carryover')
        return
      }
      setSuccess('Track moved to carryover.')
      setShowRatingSliders(false)
      setShowSubmitterIntro(false)
      setClosingSubmitterIntro(false)
      setScores({
        sound_score: '0',
        structure_score: '0',
        mix_score: '0',
        vibe_score: '0',
      })
      setSelectedSubmission(null)
      const list = await fetchPendingSubmissions()
      if (list.length === 0) triggerQueueCleared()
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError('An error occurred. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  const handleGrantDonationXp = async (userId: string) => {
    if (!userId) return
    setGrantingXpForUserId(userId)
    setError('')
    try {
      const res = await fetch('/api/xp/grant-donation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to grant donation XP')
        return
      }
      setSuccess('+20 donation XP granted.')
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError('An error occurred. Please try again.')
    } finally {
      setGrantingXpForUserId(null)
    }
  }

  // Extract unique users from submissions in queue order
  const getQueueSubmitters = () => {
    const userMap = new Map<string, {
      user_id: string
      display_name: string
      twitch_id: string
      queue_position: number
      submission_count: number
    }>()

    submissions.forEach((submission, index) => {
      const userId = submission.user_id
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          display_name: submission.users.display_name,
          twitch_id: submission.users.twitch_id,
          queue_position: index + 1,
          submission_count: 0
        })
      }
      const userData = userMap.get(userId)!
      userData.submission_count++
      // Keep the earliest queue position
      if (index + 1 < userData.queue_position) {
        userData.queue_position = index + 1
      }
    })

    // Return users in queue order (by their earliest appearance)
    return Array.from(userMap.values()).sort((a, b) => a.queue_position - b.queue_position)
  }

  const handleClearAllXp = async () => {
    if (!confirm('Clear all XP for every user? This cannot be undone.')) return
    setClearingXp(true)
    setError('')
    try {
      const res = await fetch('/api/xp/clear-all', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to clear XP')
        return
      }
      setSuccess('All XP cleared.')
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError('An error occurred. Please try again.')
    } finally {
      setClearingXp(false)
    }
  }

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

  return (
    <div className="bg-background px-2.5 sm:px-3 md:px-4 py-3 sm:py-4 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 mb-3 sm:mb-4 animate-fade-in border border-gray-800/50">
          <div className="flex flex-row flex-wrap items-center gap-2 sm:justify-between">
            <h1 className="text-base font-bold text-text-primary truncate min-w-0 flex-1 sm:flex-none sm:text-xl md:text-2xl">MikeGTC Panel</h1>
            <div className="flex flex-row items-center gap-1.5 sm:gap-2 min-w-0 sm:ml-auto">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label={showSettings ? 'Hide settings' : 'Settings'}
                  className="inline-flex h-9 w-9 sm:h-10 sm:w-auto sm:min-w-[7rem] sm:px-3 items-center justify-center text-xs sm:text-sm font-semibold bg-background-lighter hover:bg-gray-800 text-text-primary rounded-lg transition-all duration-200 border-2 border-gray-700 active:scale-[0.98] button-press touch-manipulation"
                >
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="hidden sm:inline">{showSettings ? 'Hide' : 'Settings'}</span>
                </button>
                <Link
                  href="/curator/xp"
                  aria-label={t('curator.navAllUsersXp')}
                  className="inline-flex h-9 w-9 sm:h-10 sm:w-auto sm:min-w-[7rem] sm:px-3 items-center justify-center text-xs sm:text-sm font-semibold bg-background-lighter hover:bg-gray-800 text-text-primary rounded-lg transition-all duration-200 border-2 border-gray-700 active:scale-[0.98] button-press touch-manipulation"
                >
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.83-4" /></svg>
                  <span className="hidden sm:inline">{t('curator.navAllUsersXp')}</span>
                </Link>
                <Link
                  href="/lab"
                  aria-label={t('lab.nav')}
                  className="inline-flex h-9 w-9 sm:h-10 sm:w-auto sm:min-w-[7rem] sm:px-3 items-center justify-center text-xs sm:text-sm font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-2 border-amber-500/35 rounded-lg transition-all duration-200 active:scale-[0.98] button-press touch-manipulation"
                >
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  <span className="hidden sm:inline">{t('lab.nav')}</span>
                </Link>
                <button
                  onClick={() => router.push('/dashboard')}
                  aria-label="Dashboard"
                  className="inline-flex h-9 w-9 sm:h-10 sm:w-auto sm:min-w-[7rem] sm:px-3 items-center justify-center text-xs sm:text-sm font-semibold bg-background-lighter hover:bg-gray-800 text-text-primary rounded-lg transition-all duration-200 border-2 border-gray-700 active:scale-[0.98] button-press touch-manipulation"
                >
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              </div>
              {/* XP bar — full width on phone, fixed width on larger screens */}
              <div
                className="flex items-stretch rounded-lg overflow-hidden border-2 border-primary/40 bg-gradient-to-r from-primary/15 to-primary/10 h-9 sm:h-[44px] w-[148px] sm:w-[220px] sm:min-w-[200px] sm:max-w-[220px] shadow-sm"
                title={!useXpAllowed && useXpReason ? useXpReason : t('dashboard.spend100Xp')}
              >
                <div className="flex items-center gap-2 pl-2.5 pr-2 py-2 min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0">XP</span>
                  <span className={`text-sm sm:text-base font-black text-primary tabular-nums shrink-0 ${xp >= 100 ? 'animate-xp-number-pulse' : ''}`}>{xp}</span>
                  {xp < 9999 && (
                    <div className="flex sm:hidden items-center gap-1 min-w-0 flex-1">
                      <div className="h-2 bg-background-lighter/80 rounded-full overflow-hidden flex-1 min-w-0">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xp % 100}%` }} />
                      </div>
                    </div>
                  )}
                  {xp < 9999 && (
                    <div className="hidden sm:flex items-center gap-1 min-w-0 flex-1">
                      <div className="w-7 h-2 bg-background-lighter/80 rounded-full overflow-hidden flex-1 min-w-0 max-w-[44px]">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xp % 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-px bg-primary/30 self-stretch shrink-0" aria-hidden />
                <button
                  type="button"
                  onClick={handleUseXp}
                  disabled={!useXpAllowed || useXpLoading}
                  title={useXpReason || t('dashboard.spend100XpPosition')}
                  className="shrink-0 min-w-[52px] sm:min-w-[64px] h-9 sm:h-[44px] px-2 sm:px-3 font-bold text-[11px] sm:text-xs text-background bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors button-press"
                >
                  {useXpLoading ? '…' : 'Use XP'}
                </button>
              </div>
            </div>
          </div>
          {showSettings && (
            <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-gray-800/50 animate-slide-in space-y-2 sm:space-y-3">
              {/* Submissions Toggle */}
              <div className="flex items-center justify-between p-3 bg-background-lighter rounded-lg border border-gray-800/50">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">Submission Status</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {submissionsOpen ? 'Open' : 'Closed'}
                  </p>
                </div>
                <button
                  onClick={handleToggleSubmissions}
                  disabled={toggling}
                  className={`px-4 py-1.5 text-sm rounded-button font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.98] button-press ${
                    submissionsOpen
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                      : 'bg-primary hover:bg-primary-hover text-background'
                  }`}
                >
                  {toggling ? '...' : submissionsOpen ? 'Close' : 'Open'}
                </button>
              </div>

              {/* Clear all XP */}
              <div className="flex items-center justify-between p-3 bg-background-lighter rounded-lg border border-amber-500/30">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">Clear all XP</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Set every user&apos;s XP to 0 (stored in Supabase)
                  </p>
                </div>
                <button
                  onClick={handleClearAllXp}
                  disabled={clearingXp}
                  className="px-4 py-1.5 text-sm rounded-button font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.98] button-press"
                >
                  {clearingXp ? '...' : 'Clear all XP'}
                </button>
              </div>

              {/* Sessions Management */}
              <div className="p-3 bg-background-lighter rounded-lg border border-gray-800/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text-primary">Sessions</h3>
                  <button
                    onClick={() => handleDeleteSessions(undefined, true)}
                    disabled={deleting || loadingSessions || sessions.length === 0}
                    className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press"
                  >
                    Delete All
                  </button>
                </div>
                {loadingSessions ? (
                  <p className="text-xs text-text-secondary">Loading...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-text-secondary">No sessions</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between gap-2 p-2 bg-background rounded text-xs border border-gray-800/50"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewSessionNumber(session.session_number)}
                          className="font-medium text-text-primary text-left hover:text-primary transition-colors truncate"
                          title="Preview session"
                        >
                          #{session.session_number} ({session.submission_count || 0})
                          {!session.ended_at && (
                            <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">live</span>
                          )}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewSessionNumber(session.session_number)}
                            disabled={deleting || showDeleteConfirm}
                            className="px-2 py-0.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 rounded-button text-xs transition-all duration-200 disabled:opacity-50 active:scale-[0.98] button-press"
                            title="Preview session"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteSessions([session.session_number])}
                            disabled={deleting || showDeleteConfirm}
                            className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-button text-xs transition-all duration-200 disabled:opacity-50 active:scale-[0.98] button-press"
                            title="Delete session"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {success && (
          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-primary/10 border border-primary/30 text-primary rounded-lg animate-scale-in text-xs sm:text-sm">
            {typeof success === 'string' ? success : 'Review submitted!'}
          </div>
        )}
        {error && (
          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg animate-scale-in text-xs sm:text-sm">
            {error}
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Pending submissions sidebar - compact, on the left */}
          <div className={`${selectedSubmission ? 'hidden lg:block' : 'block'} lg:w-56 xl:w-64 lg:shrink-0 space-y-3 sm:space-y-4`}>
            <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-2.5 sm:p-3 animate-fade-in border-2 border-gray-700/60">
              <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
                <h2 className="text-xs sm:text-sm font-extrabold text-text-primary tracking-tight">
                  {t('queue.title')} ({submissions.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowSubmitters((open) => !open)}
                  className="lg:hidden inline-flex h-8 items-center rounded-lg border-2 border-gray-600 px-2 text-[11px] font-bold text-text-primary"
                >
                  {t('curator.submitters')}
                </button>
              </div>
              {submissions.length === 0 ? (
                <p className="text-xs text-text-secondary font-medium">{t('curator.noPendingSubmissions')}</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto overflow-x-hidden scrollbar-hide">
                  {submissions.map((submission, index) => {
                    const position = index + 1
                    const prevPos = prevQueuePositionsRef.current[submission.id]
                    const movedUp = !isFirstQueueRenderRef.current && prevPos != null && position < prevPos
                    return (
                    <div
                      key={submission.id}
                      onClick={() => {
                        if (handoff) return
                        void selectSubmission(submission, { showIntro: true })
                      }}
                      className={`flex items-center gap-2 border-2 rounded-lg p-2 cursor-pointer transition-all duration-500 relative overflow-visible ${
                        selectedSubmission?.id === submission.id
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-gray-700/50 hover:border-primary/50 hover:bg-background-lighter'
                      } ${movedUp ? 'animate-queue-moved-up border-primary/40 bg-primary/10' : ''}`}
                    >
                      {movedUp && (
                        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-10 animate-arrow-rise">
                          <svg className="w-3 h-3 text-primary drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 14l5-5 5 5H7z" />
                          </svg>
                        </div>
                      )}
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center"
                        title={`${ordinal(position)} in queue`}
                      >
                        <span className="text-[10px] font-extrabold text-primary">{position}</span>
                      </div>
                      {(submission.moves_used_this_session ?? 0) > 0 && (
                        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded bg-amber-500/20 border border-amber-500/40" title="Used XP to move up">
                          <svg className="w-2 h-2 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 14l5-5 5 5H7z" />
                          </svg>
                        </span>
                      )}
                      {submissionArtworks[submission.id] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={submissionArtworks[submission.id] || ''}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-600"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-background-lighter border border-gray-600 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm text-text-muted">♪</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 overflow-hidden space-y-0.5">
                        <p className="text-xs truncate font-bold text-text-primary">
                          {(() => {
                            const raw = submission.song_title || submissionSoundCloudMetadata[submission.id]?.title || 'Untitled'
                            const artist = submission.artist_name || submissionSoundCloudMetadata[submission.id]?.author_name || submission.users.display_name
                            return artist && raw.endsWith(' by ' + artist) ? raw.slice(0, -(3 + artist.length)).trim() || raw : raw
                          })()}
                        </p>
                        <p className="text-[10px] truncate text-text-secondary font-medium">
                          {submission.artist_name || submissionSoundCloudMetadata[submission.id]?.author_name || submission.users.display_name}
                        </p>
                        {submission.genre && (
                          <span className="inline-block text-[9px] font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 truncate max-w-full">
                            {(submission.genre?.match(/\(([^)]+)\)\s*$/) ?? [null, submission.genre])[1]}
                          </span>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>

            {/* Submitters field - shows users in queue order */}
            <div className={`${showSubmitters ? 'block' : 'hidden lg:block'} bg-background-light rounded-lg sm:rounded-xl shadow-lg p-2.5 sm:p-3 animate-fade-in border-2 border-gray-700/60`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className="text-xs sm:text-sm font-extrabold text-text-primary tracking-tight">
                  {t('curator.submitters')} ({getQueueSubmitters().length})
                </h2>
                <button
                  onClick={() => setShowSubmitters(!showSubmitters)}
                  className="text-xs text-text-secondary hover:text-primary transition-colors font-medium"
                >
                  {showSubmitters ? t('common.hide') : t('common.show')}
                </button>
              </div>
              {showSubmitters && (
                <>
                  {getQueueSubmitters().length === 0 ? (
                    <p className="text-xs text-text-secondary font-medium">No submitters in queue</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto overflow-x-hidden scrollbar-hide">
                      {getQueueSubmitters().map((submitter) => (
                        <div
                          key={submitter.user_id}
                          className="flex items-center justify-between gap-2 border-2 rounded-lg p-2 transition-all duration-200 border-gray-700/50 hover:border-primary/50 hover:bg-background-lighter relative group"
                          onMouseEnter={() => setHoveredUserId(submitter.user_id)}
                          onMouseLeave={() => setHoveredUserId(null)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                            <div
                              className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center"
                              title={`${ordinal(submitter.queue_position)} in queue`}
                            >
                              <span className="text-[9px] font-extrabold text-primary">{submitter.queue_position}</span>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs truncate font-medium text-text-primary">
                                {submitter.display_name}
                              </p>
                              {submitter.submission_count > 1 && (
                                <p className="text-[10px] truncate text-text-secondary">
                                  {submitter.submission_count} submissions
                                </p>
                              )}
                            </div>
                          </div>
                          {hoveredUserId === submitter.user_id && (
                            <button
                              type="button"
                              onClick={() => handleGrantDonationXp(submitter.user_id)}
                              disabled={grantingXpForUserId === submitter.user_id}
                              className="px-2 py-1 text-xs rounded-lg font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation shrink-0"
                            >
                              {grantingXpForUserId === submitter.user_id ? '…' : '+20 XP'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Review window - wider, focuses on embed */}
            <div className={`${selectedSubmission ? 'block' : 'hidden lg:block'} flex-1 min-w-0`}>
            <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-5 animate-fade-in border-2 border-gray-700/60">
              {selectedSubmission ? (
                <div className={`relative space-y-3 sm:space-y-4 ${
                  handoff || (
                    showSubmitterIntro &&
                    (() => {
                      const m = selectedSubmission.description?.trim() || ''
                      return m.length > 180 || m.split(/\n/).length > 3
                    })()
                  ) ? 'min-h-[26rem] sm:min-h-[30rem]' : ''
                }`}>
                  {/* Full-panel handoff after Submit Review */}
                  {handoff && (
                    <div className="absolute inset-0 z-40 rounded-lg sm:rounded-xl bg-black/80 backdrop-blur-md flex items-center justify-center overflow-hidden">
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/25 to-transparent animate-handoff-sweep" />
                      {handoff.phase === 'leaving' && (
                        <div className="animate-handoff-leave text-center px-4">
                          <p className="text-xl sm:text-2xl font-black text-text-primary/80">{handoff.fromName || '—'}</p>
                        </div>
                      )}
                      {(handoff.phase === 'between' || handoff.phase === 'entering') && (
                        <div className={`${handoff.phase === 'entering' ? 'animate-handoff-enter' : 'animate-handoff-between'} text-center px-4 max-w-sm`}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-3">{t('curator.nextUp')}</p>
                          <div className="flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 text-primary animate-handoff-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                          <div className="mx-auto mb-3 w-16 h-16 sm:w-20 sm:h-20 relative">
                            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl" />
                            {handoff.toAvatar ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={handoff.toAvatar} alt="" className="relative w-full h-full rounded-full object-cover border-2 border-primary/70" />
                            ) : (
                              <div className="relative w-full h-full rounded-full border-2 border-primary/70 bg-primary/15 flex items-center justify-center">
                                <span className="text-2xl font-black text-primary">{(handoff.toName || '?').charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">{handoff.toName}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full-panel submitter intro — room for message */}
                  {showSubmitterIntro && !handoff && (() => {
                    const rawSong = selectedSubmission.song_title || submissionSoundCloudMetadata[selectedSubmission.id]?.title || 'Untitled Track'
                    const artistDisplay = selectedSubmission.artist_name || submissionSoundCloudMetadata[selectedSubmission.id]?.author_name || selectedSubmission.users.display_name
                    const songName = artistDisplay && rawSong.endsWith(' by ' + artistDisplay)
                      ? rawSong.slice(0, -(3 + artistDisplay.length)).trim() || rawSong
                      : rawSong
                    const genreLabel = selectedSubmission.genre
                      ? (selectedSubmission.genre.match(/\(([^)]+)\)\s*$/) ?? [null, selectedSubmission.genre])[1]
                      : null
                    const avatarSrc =
                      (typeof selectedSubmission.users.profile_image_url === 'string' && selectedSubmission.users.profile_image_url.trim()) ||
                      submissionArtworks[selectedSubmission.id] ||
                      null
                    const initial = (selectedSubmission.users.display_name || '?').charAt(0).toUpperCase()
                    const message = selectedSubmission.description?.trim() || ''
                    const messageLen = message.length
                    const messageMode: 'none' | 'short' | 'long' =
                      !message ? 'none' : messageLen > 180 || message.split(/\n/).length > 3 ? 'long' : 'short'

                    return (
                      <div
                        key={`intro-${introKey}`}
                        className={`absolute inset-0 z-30 rounded-lg sm:rounded-xl bg-black/75 backdrop-blur-md p-3 sm:p-5 ${
                          messageMode === 'long' ? 'flex flex-col' : 'flex items-center justify-center'
                        } ${closingSubmitterIntro ? 'animate-fade-out' : 'animate-fade-in'}`}
                        onAnimationEnd={(e) => {
                          if (e.target !== e.currentTarget || !closingSubmitterIntro) return
                          setShowSubmitterIntro(false)
                          setClosingSubmitterIntro(false)
                        }}
                      >
                        <div
                          className={`w-full max-w-xl mx-auto flex flex-col ${
                            messageMode === 'long' ? 'flex-1 min-h-0' : ''
                          } ${closingSubmitterIntro ? 'animate-scale-out' : ''}`}
                        >
                          <div className="animate-intro-avatar flex items-center gap-3 sm:gap-4 shrink-0 mb-3 sm:mb-4">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
                              <div className="absolute inset-0 rounded-full bg-primary/25 blur-lg" />
                              {avatarSrc ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={avatarSrc}
                                  alt=""
                                  className="relative w-full h-full rounded-full object-cover border-2 border-primary/60 shadow-lg shadow-primary/20"
                                />
                              ) : (
                                <div className="relative w-full h-full rounded-full border-2 border-primary/60 bg-primary/15 flex items-center justify-center shadow-lg shadow-primary/20">
                                  <span className="text-xl font-black text-primary">{initial}</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/90 mb-0.5">
                                {t('curator.introFrom')}
                              </p>
                              <h3 className="text-lg sm:text-xl font-black text-text-primary tracking-tight truncate">
                                {selectedSubmission.users.display_name}
                              </h3>
                            </div>
                          </div>

                          <div
                            className="animate-intro-rise shrink-0 rounded-xl border-2 border-gray-700/60 bg-background-light/95 px-3 py-2.5 sm:px-4 sm:py-3 mb-3 text-left"
                            style={{ animationDelay: '160ms' }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Song</span>
                                <p className="text-sm sm:text-base font-bold text-text-primary leading-snug">{songName}</p>
                              </div>
                              {genreLabel && (
                                <span className="inline-flex text-[10px] font-bold text-primary px-2 py-0.5 rounded-md bg-primary/15 border border-primary/35 shrink-0 mt-1">
                                  {genreLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-text-secondary font-medium truncate">{artistDisplay}</p>
                          </div>

                          {messageMode === 'short' && (
                            <div
                              className="animate-intro-message shrink-0 rounded-xl border-2 border-primary/35 bg-gradient-to-b from-primary/15 to-primary/5 px-3 py-2.5 sm:px-4 sm:py-3 text-left mb-3"
                              style={{ animationDelay: '280ms' }}
                            >
                              <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                                {t('curator.introMessage')}
                              </span>
                              <p className="mt-1 text-sm sm:text-[15px] text-text-primary/95 whitespace-pre-wrap break-words leading-relaxed">
                                {message}
                              </p>
                            </div>
                          )}

                          {messageMode === 'long' && (
                            <div
                              className="animate-intro-message flex-1 min-h-[7.5rem] flex flex-col rounded-xl border-2 border-primary/35 bg-gradient-to-b from-primary/15 to-primary/5 px-3 py-3 sm:px-4 sm:py-3.5 text-left mb-3"
                              style={{ animationDelay: '280ms' }}
                            >
                              <span className="text-[9px] font-bold uppercase tracking-wider text-primary shrink-0 mb-1.5">
                                {t('curator.introMessage')}
                              </span>
                              <p className="flex-1 min-h-0 overflow-y-auto text-sm sm:text-[15px] text-text-primary/95 whitespace-pre-wrap break-words leading-relaxed scrollbar-thin">
                                {message}
                              </p>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={dismissSubmitterIntro}
                            className="animate-intro-rise shrink-0 min-h-[48px] w-full sm:w-auto sm:min-w-[10rem] sm:self-center px-8 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-background font-bold text-sm border-2 border-primary/50 shadow-lg shadow-primary/20 active:scale-[0.98] button-press touch-manipulation"
                            style={{ animationDelay: messageMode === 'none' ? '240ms' : '400ms' }}
                          >
                            {t('curator.introOk')}
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Back button on mobile */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubmission(null)
                      setShowRatingSliders(false)
                      setClosingRatingOverlay(false)
                      setShowSubmitterIntro(false)
                      setClosingSubmitterIntro(false)
                      setHandoff(null)
                      handoffLockRef.current = false
                    }}
                    className="lg:hidden flex items-center gap-2 -ml-1 px-1 min-h-[44px] text-text-secondary hover:text-primary transition-colors font-medium text-sm touch-manipulation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  {/* Track info chips */}
                  <div className="pb-2 sm:pb-3 border-b border-gray-800/50">
                    <div className="flex flex-nowrap items-stretch gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible sm:gap-2">
                      <div className="flex min-h-[2.75rem] w-[9.25rem] shrink-0 sm:min-h-[4rem] sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 flex-col justify-center gap-1 rounded-md sm:rounded-lg border-2 border-primary/40 bg-primary/5 px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-primary">Song</span>
                        <span className="text-sm font-bold leading-tight text-text-primary truncate">
                          {(() => {
                            const rawSong = selectedSubmission.song_title || submissionSoundCloudMetadata[selectedSubmission.id]?.title || 'Untitled Track'
                            const artistDisplay = selectedSubmission.artist_name || submissionSoundCloudMetadata[selectedSubmission.id]?.author_name || selectedSubmission.users.display_name
                            if (artistDisplay && rawSong.endsWith(' by ' + artistDisplay)) {
                              return rawSong.slice(0, -(3 + artistDisplay.length)).trim() || rawSong
                            }
                            return rawSong
                          })()}
                        </span>
                      </div>
                      <div className="flex min-h-[2.75rem] w-[9.25rem] shrink-0 sm:min-h-[4rem] sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 flex-col justify-center gap-1 rounded-md sm:rounded-lg border-2 border-gray-800/50 bg-background-lighter px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-text-muted">Artist</span>
                        <span className="text-sm font-bold leading-tight text-text-primary truncate">
                          {selectedSubmission.artist_name || submissionSoundCloudMetadata[selectedSubmission.id]?.author_name || selectedSubmission.users.display_name}
                        </span>
                      </div>
                      <div className="flex min-h-[2.75rem] w-fit min-w-[7.5rem] max-w-[14rem] shrink-0 sm:min-h-[4rem] flex-col justify-center gap-1 rounded-md sm:rounded-lg border-2 border-primary/40 bg-primary/5 px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-primary">Genre</span>
                        <span className="text-sm font-bold leading-tight text-primary whitespace-nowrap">
                          {selectedSubmission.genre ? (selectedSubmission.genre?.match(/\(([^)]+)\)\s*$/) ?? [null, selectedSubmission.genre])[1] : '—'}
                        </span>
                      </div>
                      <div className="flex min-h-[2.75rem] w-[8.5rem] shrink-0 sm:min-h-[4rem] sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-0 flex-col justify-center gap-1 rounded-md sm:rounded-lg border-2 border-gray-800/50 bg-background-lighter px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-text-muted">Submitter</span>
                        <span className="text-sm font-bold leading-tight text-text-secondary truncate">{selectedSubmission.users.display_name}</span>
                      </div>
                      {selectedSubmission.session_number != null && (
                        <div className="flex min-h-[2.75rem] w-fit shrink-0 sm:min-h-[4rem] flex-col justify-center gap-1 rounded-md sm:rounded-lg border-2 border-primary/40 bg-primary/5 px-2.5 py-2 sm:px-3 sm:py-2.5">
                          <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-primary">Session</span>
                          <span className="text-sm font-bold leading-tight tabular-nums text-primary">#{selectedSubmission.session_number}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Large SoundCloud embed */}
                  <div className="soundcloud-embed-large bg-background rounded-lg sm:rounded-xl border-2 border-gray-700/50 overflow-hidden p-2 sm:p-3 relative">
                    <SoundCloudEmbed 
                      key={`embed-wrapper-${selectedSubmission.id}`}
                      submissionId={selectedSubmission.id}
                      embedData={embedData}
                      soundcloudUrl={selectedSubmission.soundcloud_url}
                      getEmbedUrl={getEmbedUrl}
                    />

                    {/* Floating rating sliders overlay */}
                    {showRatingSliders && !showSubmitterIntro && !handoff && (
                      <div
                        className={`absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10 ${closingRatingOverlay ? 'animate-fade-out' : 'animate-fade-in'}`}
                        onAnimationEnd={() => {
                          if (!closingRatingOverlay) return
                          setShowRatingSliders(false)
                          setClosingRatingOverlay(false)
                        }}
                      >
                        <div className={`bg-background-light rounded-xl p-3 sm:p-4 max-w-2xl w-full mx-3 sm:mx-4 max-h-[min(92vh,720px)] overflow-y-auto border-2 border-gray-700/50 shadow-2xl ${closingRatingOverlay ? 'animate-scale-out' : 'animate-scale-in'}`}>
                          <form onSubmit={handleSubmitReview} className="space-y-2.5 sm:space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-base sm:text-lg font-bold text-text-primary">Rate Song</h3>
                              <button
                                type="button"
                                onClick={() => setClosingRatingOverlay(true)}
                                className="shrink-0 text-text-secondary hover:text-primary transition-colors p-0.5"
                                aria-label="Close"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {/* Audience live score — matches metric card style */}
                            <div className="audience-score-live flex items-center justify-between gap-2 bg-background rounded-lg p-2 sm:p-2.5 border border-gray-700/50">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-text-primary truncate">
                                  {t('curator.audienceScore')}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-baseline gap-2">
                                <span className="text-sm sm:text-base font-extrabold text-primary tabular-nums">
                                  {overlayAudience.average == null ? (
                                    <span className="text-text-muted">—</span>
                                  ) : (
                                    <>
                                      <AnimatedAudienceAvg value={overlayAudience.average} epoch={ratingAnimEpoch} />
                                      <span className="text-[10px] sm:text-xs text-text-muted">/10</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-[10px] sm:text-xs font-semibold tabular-nums text-text-secondary">
                                  <AnimatedAudienceCount value={overlayAudience.vote_count} epoch={ratingAnimEpoch} />
                                  <span className="ml-0.5 text-text-muted font-medium">{t('curator.audienceVotes').toLowerCase()}</span>
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              {[
                                { key: 'sound_score', label: 'Sound' },
                                { key: 'structure_score', label: 'Structure' },
                                { key: 'mix_score', label: 'Mix' },
                                { key: 'vibe_score', label: 'Vibe' },
                              ].map(({ key, label }) => {
                                const score = parseFloat(scores[key as keyof typeof scores])
                                
                                return (
                                  <div key={key} className="space-y-1 bg-background rounded-lg p-2 sm:p-2.5 border border-gray-700/50">
                                    <div className="flex justify-between items-center gap-1">
                                      <label className="text-xs sm:text-sm font-bold text-text-primary">
                                        {label}
                                      </label>
                                      <span className="text-sm sm:text-base font-extrabold text-primary tabular-nums shrink-0">
                                        {scores[key as keyof typeof scores]}<span className="text-[10px] sm:text-xs text-text-muted">/10</span>
                                      </span>
                                    </div>
                                    
                                    <div className="relative">
                                      <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={scores[key as keyof typeof scores]}
                                        onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                                        className="w-full h-1.5 sm:h-2 rounded-lg appearance-none cursor-pointer slider-gradient"
                                        style={{
                                          background: `linear-gradient(to right, 
                                            #ef4444 0%, 
                                            #f97316 25%, 
                                            #eab308 50%, 
                                            #84cc16 75%, 
                                            #22c55e 100%)`,
                                          boxShadow: `inset 0 1px 2px rgba(0,0,0,0.3)`,
                                        }}
                                      />
                                      
                                      {/* Score indicators - compact */}
                                      <div className="flex justify-between mt-1">
                                        {[0, 2, 4, 6, 8, 10].map((num) => (
                                          <span key={num} className={`text-[8px] sm:text-[9px] font-bold tabular-nums transition-colors ${
                                            Math.abs(score - num) < 1 ? 'text-primary' : 'text-text-muted'
                                          }`}>
                                            {num}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="pt-0.5">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="w-full min-h-[44px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-bold py-2 px-3 sm:px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] button-press text-xs sm:text-sm border-2 border-primary/50 touch-manipulation"
                              >
                                {submitting ? '…' : 'Submit Review'}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Main action buttons — stay available during submitter intro */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!!handoff}
                      onClick={() => {
                        if (showSubmitterIntro) {
                          setShowSubmitterIntro(false)
                          setClosingSubmitterIntro(false)
                        }
                        if (showRatingSliders) setClosingRatingOverlay(true)
                        else {
                          setRatingAnimEpoch((e) => e + 1)
                          setShowRatingSliders(true)
                        }
                      }}
                      className={`flex-1 min-h-[56px] px-6 py-3 text-base rounded-xl font-bold transition-all active:scale-[0.98] button-press touch-manipulation min-w-0 disabled:opacity-50 ${
                        showRatingSliders
                          ? 'bg-primary text-background border-2 border-primary/50 shadow-lg'
                          : 'bg-primary/20 hover:bg-primary/30 text-primary border-2 border-primary/40'
                      }`}
                    >
                      {showRatingSliders ? 'Hide Ratings' : 'Rate Song'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipToCarryover}
                      disabled={skipping || !!handoff}
                      className="flex-1 min-h-[56px] px-6 py-3 text-base rounded-xl font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation"
                    >
                      {skipping ? '…' : 'Skip'}
                    </button>
                  </div>
                </div>
              ) : queueCleared ? (
                <div className="relative overflow-hidden text-center py-14 sm:py-20 px-4 animate-queue-cleared-panel">
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="absolute h-28 w-28 sm:h-36 sm:w-36 rounded-full border-2 border-primary/40 animate-queue-cleared-ring" />
                    <div className="absolute h-28 w-28 sm:h-36 sm:w-36 rounded-full border border-primary/20 animate-queue-cleared-ring" style={{ animationDelay: '120ms' }} />
                    {[
                      ['-42px', '-58px'],
                      ['48px', '-52px'],
                      ['62px', '8px'],
                      ['38px', '54px'],
                      ['-50px', '42px'],
                      ['-64px', '4px'],
                      ['12px', '-68px'],
                      ['-18px', '66px'],
                    ].map(([sx, sy], i) => (
                      <span
                        key={i}
                        className="absolute h-2 w-2 rounded-full bg-primary animate-queue-cleared-spark"
                        style={{
                          ['--sx' as string]: sx,
                          ['--sy' as string]: sy,
                          animationDelay: `${80 + i * 45}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="relative animate-queue-cleared-burst mx-auto mb-4 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/15 shadow-lg shadow-primary/20">
                    <svg className="h-8 w-8 sm:h-10 sm:w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="relative text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-2">
                    {t('curator.endOfQueue')}
                  </p>
                  <h3 className="relative text-xl sm:text-2xl font-black text-text-primary tracking-tight mb-2">
                    {t('curator.queueCleared')}
                  </h3>
                  <p className="relative text-sm text-text-secondary max-w-sm mx-auto">
                    {t('curator.queueClearedHint')}
                  </p>
                </div>
              ) : (
                <div className="text-center text-text-muted py-16">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-sm font-bold">Select a submission to review</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800/50">
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs text-text-muted">
            <button
              type="button"
              onClick={() => setShowXpHelpModal(true)}
              className="text-primary hover:text-primary-hover underline underline-offset-2 font-medium"
            >
              {t('xp.howXpWorks')}
            </button>
            <Link
              href="/dashboard"
              className="text-text-secondary hover:text-primary underline underline-offset-2 font-medium"
            >
              {t('common.dashboard')}
            </Link>
          </div>
        </div>
      </div>

      <XpHelpModal isOpen={showXpHelpModal} onClose={() => setShowXpHelpModal(false)} />

      <SessionPreviewModal
        sessionNumber={previewSessionNumber}
        onClose={() => setPreviewSessionNumber(null)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-background-light rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in shadow-2xl border border-gray-800/50">
            <h3 className="text-lg font-bold text-text-primary mb-4">Confirm Deletion</h3>
            <p className="text-text-secondary mb-6 text-sm">
              {sessionsToDelete.length === 0
                ? 'Are you sure you want to delete ALL sessions and their submissions? This action cannot be undone.'
                : `Are you sure you want to delete session(s) ${sessionsToDelete.join(', ')} and all their submissions? This action cannot be undone.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSessionsToDelete([])
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-700 text-text-primary rounded-button hover:bg-background-lighter transition-all duration-200 disabled:opacity-50 active:scale-[0.98] button-press"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSessions(sessionsToDelete, sessionsToDelete.length === 0)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
