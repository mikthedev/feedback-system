'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import XpHelpModal from '../components/XpHelpModal'

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

interface Submission {
  id: string
  user_id: string
  soundcloud_url: string
  description?: string
  artist_name?: string
  song_title?: string
  status: string
  session_number?: number
  created_at: string
  users: {
    display_name: string
    twitch_id: string
  }
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
  const [showSettings, setShowSettings] = useState(false)
  const [showXpHelpModal, setShowXpHelpModal] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [showRatingSliders, setShowRatingSliders] = useState(false)
  const [showSubmitters, setShowSubmitters] = useState(false)
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null)
  const [grantingXpForUserId, setGrantingXpForUserId] = useState<string | null>(null)

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

  const fetchPendingSubmissions = async () => {
    try {
      const response = await fetch('/api/submissions/pending', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
        
        const artworkPromises = (data.submissions || []).map(async (submission: Submission) => {
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
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
    }
  }

  useEffect(() => {
    fetchUser()
    fetchPendingSubmissions()
    fetchSubmissionsStatus()
    fetchSessions()
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
    const interval = setInterval(fetchPendingSubmissions, 8000)
    return () => clearInterval(interval)
  }, [])

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
    setScores({ ...scores, [field]: rounded.toString() })
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

      setSuccess('Review submitted successfully!')
      setSelectedSubmission(null)
      setShowRatingSliders(false)
      setScores({
        sound_score: '0',
        structure_score: '0',
        mix_score: '0',
        vibe_score: '0',
      })
      
      // Refresh submissions list
      fetchPendingSubmissions()
      
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
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
      setSelectedSubmission(null)
      setShowRatingSliders(false)
      setScores({
        sound_score: '0',
        structure_score: '0',
        mix_score: '0',
        vibe_score: '0',
      })
      fetchPendingSubmissions()
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
    <div className="bg-background px-4 sm:px-3 md:p-4 py-4 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto w-full min-w-0">
        <div className="bg-background-light rounded-xl shadow-lg p-4 sm:p-4 mb-4 animate-fade-in border border-gray-800/50 sm:rounded-xl">
          <div className="flex justify-between items-center gap-3">
            <h1 className="text-lg font-bold text-text-primary truncate min-w-0 sm:text-xl md:text-2xl">MikeGTC Panel</h1>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="min-h-[44px] px-3 py-2.5 text-sm font-semibold bg-background-lighter hover:bg-gray-800 text-text-primary rounded-xl transition-all duration-200 border border-gray-700 active:scale-[0.98] button-press touch-manipulation sm:min-h-[36px] sm:rounded-button sm:py-1.5 sm:text-xs sm:font-medium"
              >
                {showSettings ? 'Hide' : 'Settings'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="min-h-[44px] px-3 py-2.5 text-sm font-semibold bg-background-lighter hover:bg-gray-800 text-text-primary rounded-xl transition-all duration-200 border border-gray-700 active:scale-[0.98] button-press touch-manipulation sm:min-h-[36px] sm:rounded-button sm:py-1.5 sm:text-xs sm:font-medium"
              >
                Dashboard
              </button>
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
                        className="flex items-center justify-between p-2 bg-background rounded text-xs border border-gray-800/50"
                      >
                        <span className="font-medium text-text-primary">
                          #{session.session_number} ({session.submission_count || 0})
                        </span>
                        <button
                          onClick={() => handleDeleteSessions([session.session_number])}
                          disabled={deleting || showDeleteConfirm}
                          className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-button text-xs transition-all duration-200 disabled:opacity-50 active:scale-[0.98] button-press"
                        >
                          ×
                        </button>
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
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Pending submissions sidebar - compact, on the left */}
          <div className={`${selectedSubmission ? 'hidden lg:block' : 'block'} lg:w-56 xl:w-64 lg:shrink-0 space-y-4`}>
            <div className="bg-background-light rounded-xl shadow-lg p-3 animate-fade-in border-2 border-gray-700/60">
              <h2 className="text-sm font-extrabold text-text-primary mb-3 tracking-tight">
                Queue ({submissions.length})
              </h2>
              {submissions.length === 0 ? (
                <p className="text-xs text-text-secondary font-medium">No pending submissions</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto overflow-x-hidden scrollbar-hide">
                  {submissions.map((submission, index) => (
                    <div
                      key={submission.id}
                      className={`flex items-center gap-2 border-2 rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                        selectedSubmission?.id === submission.id
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-gray-700/50 hover:border-primary/50 hover:bg-background-lighter'
                      }`}
                      onClick={async () => {
                        setScores({
                          sound_score: '0',
                          structure_score: '0',
                          mix_score: '0',
                          vibe_score: '0',
                        })
                        setShowRatingSliders(false)
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
                      }}
                    >
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center"
                        title={`${ordinal(index + 1)} in queue`}
                      >
                        <span className="text-[10px] font-extrabold text-primary">{index + 1}</span>
                      </div>
                      {submissionArtworks[submission.id] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={submissionArtworks[submission.id] || ''}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-600"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-background-lighter border border-gray-600 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-text-muted">♪</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-xs truncate font-medium text-text-primary">
                          {submission.song_title || submissionSoundCloudMetadata[submission.id]?.title || 'Untitled'}
                        </p>
                        <p className="text-[10px] truncate text-text-secondary">
                          {submission.users.display_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submitters field - shows users in queue order */}
            <div className="bg-background-light rounded-xl shadow-lg p-3 animate-fade-in border-2 border-gray-700/60">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-text-primary tracking-tight">
                  Submitters ({getQueueSubmitters().length})
                </h2>
                <button
                  onClick={() => setShowSubmitters(!showSubmitters)}
                  className="text-xs text-text-secondary hover:text-primary transition-colors font-medium"
                >
                  {showSubmitters ? 'Hide' : 'Show'}
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
            <div className="bg-background-light rounded-xl shadow-lg p-4 sm:p-5 animate-fade-in border-2 border-gray-700/60">
              {selectedSubmission ? (
                <div className="space-y-4">
                  {/* Back button on mobile */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubmission(null)
                      setShowRatingSliders(false)
                    }}
                    className="lg:hidden flex items-center gap-2 text-text-secondary hover:text-primary transition-colors font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  {/* Track info - compact */}
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base sm:text-lg font-extrabold text-primary tracking-tight truncate">
                        {selectedSubmission.song_title || submissionSoundCloudMetadata[selectedSubmission.id]?.title || 'Untitled Track'}
                      </h2>
                      <p className="text-sm text-text-secondary font-medium truncate">
                        {selectedSubmission.artist_name || submissionSoundCloudMetadata[selectedSubmission.id]?.author_name || selectedSubmission.users.display_name}
                        <span className="text-text-muted mx-2">•</span>
                        <span className="text-text-muted">{selectedSubmission.users.display_name}</span>
                      </p>
                    </div>
                    {selectedSubmission.session_number != null && (
                      <span className="shrink-0 px-2 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold border border-primary/40">
                        #{selectedSubmission.session_number}
                      </span>
                    )}
                  </div>

                  {/* Large SoundCloud embed */}
                  <div className="soundcloud-embed-large bg-background rounded-xl border-2 border-gray-700/50 overflow-hidden p-3 relative">
                    <SoundCloudEmbed 
                      key={`embed-wrapper-${selectedSubmission.id}`}
                      submissionId={selectedSubmission.id}
                      embedData={embedData}
                      soundcloudUrl={selectedSubmission.soundcloud_url}
                      getEmbedUrl={getEmbedUrl}
                    />
                    
                    {/* Floating rating sliders overlay */}
                    {showRatingSliders && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10 animate-fade-in">
                        <div className="bg-background-light rounded-xl p-4 sm:p-5 max-w-2xl w-full mx-4 max-h-[90%] overflow-y-auto border-2 border-gray-700/50 shadow-2xl">
                          <form onSubmit={handleSubmitReview} className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-bold text-text-primary">Rate Song</h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowRatingSliders(false)
                                  setScores({ sound_score: '0', structure_score: '0', mix_score: '0', vibe_score: '0' })
                                }}
                                className="text-text-secondary hover:text-primary transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { key: 'sound_score', label: 'Sound' },
                                { key: 'structure_score', label: 'Structure' },
                                { key: 'mix_score', label: 'Mix' },
                                { key: 'vibe_score', label: 'Vibe' },
                              ].map(({ key, label }) => {
                                const score = parseFloat(scores[key as keyof typeof scores])
                                
                                return (
                                  <div key={key} className="space-y-2 bg-background rounded-lg p-3 border border-gray-700/50">
                                    <div className="flex justify-between items-center">
                                      <label className="text-sm font-bold text-text-primary">
                                        {label}
                                      </label>
                                      <span className="text-lg font-extrabold text-primary tabular-nums">
                                        {scores[key as keyof typeof scores]}<span className="text-sm text-text-muted">/10</span>
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
                                        className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-gradient"
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
                                      <div className="flex justify-between mt-1.5">
                                        {[0, 2, 4, 6, 8, 10].map((num) => (
                                          <span key={num} className={`text-[9px] font-bold tabular-nums transition-colors ${
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

                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 min-h-[48px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-bold py-2.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] button-press text-sm border-2 border-primary/50 touch-manipulation"
                              >
                                {submitting ? '…' : 'Submit Review'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowRatingSliders(false)
                                  setScores({ sound_score: '0', structure_score: '0', mix_score: '0', vibe_score: '0' })
                                }}
                                className="min-h-[48px] px-4 py-2.5 border-2 border-gray-700 text-text-primary rounded-xl hover:bg-background-lighter transition-all duration-200 active:scale-[0.98] button-press text-sm font-bold touch-manipulation"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Main action buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRatingSliders(!showRatingSliders)}
                      className={`flex-1 min-h-[56px] px-6 py-3 text-base rounded-xl font-bold transition-all active:scale-[0.98] button-press touch-manipulation ${
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
                      disabled={skipping}
                      className="flex-1 min-h-[56px] px-6 py-3 text-base rounded-xl font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation"
                    >
                      {skipping ? '…' : 'Skip'}
                    </button>
                  </div>
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
              How XP works
            </button>
            <Link
              href="/dashboard"
              className="text-text-secondary hover:text-primary underline underline-offset-2 font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <XpHelpModal isOpen={showXpHelpModal} onClose={() => setShowXpHelpModal(false)} />

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
