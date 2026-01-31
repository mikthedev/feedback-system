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
  const [grantingDonation, setGrantingDonation] = useState(false)
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

  const handleGrantDonationXp = async () => {
    if (!selectedSubmission?.user_id) return
    setGrantingDonation(true)
    setError('')
    try {
      const res = await fetch('/api/xp/grant-donation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedSubmission.user_id }),
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
      setGrantingDonation(false)
    }
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
    <div className="min-h-screen bg-background px-4 sm:px-3 md:p-4 py-4 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="lg:col-span-1 bg-background-light rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-3 animate-fade-in border border-gray-800/50 flex flex-col min-w-0 max-w-full">
            <h2 className="text-xs sm:text-sm font-bold text-text-primary mb-1.5 sm:mb-2 flex-shrink-0">
              Pending ({submissions.length})
            </h2>
            {submissions.length === 0 ? (
              <p className="text-[11px] sm:text-xs text-text-secondary">No pending submissions</p>
            ) : (
              <div className="space-y-1 max-h-[min(40vh,280px)] sm:max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden scrollbar-hide flex-1 min-w-0 w-full">
                {submissions.map((submission, index) => (
                  <div
                    key={submission.id}
                    className={`flex items-center gap-2 border rounded-lg p-1.5 cursor-pointer transition-all duration-200 w-full min-w-0 max-w-full ${
                      selectedSubmission?.id === submission.id
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-gray-800/50 hover:border-primary/50 hover:bg-background-lighter'
                    }`}
                    onClick={async () => {
                      setScores({
                        sound_score: '0',
                        structure_score: '0',
                        mix_score: '0',
                        vibe_score: '0',
                      })
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
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center"
                      title={`${ordinal(index + 1)} in queue`}
                    >
                      <span className="text-[10px] font-bold text-primary">{index + 1}</span>
                    </div>
                    {submissionArtworks[submission.id] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={submissionArtworks[submission.id] || ''}
                        alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-background-lighter border border-gray-800/50 flex-shrink-0 flex items-center justify-center">
                        <span className="text-[10px] text-text-muted">♪</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-[11px] truncate">
                        <span className="font-semibold text-primary">&quot;{submission.song_title || submissionSoundCloudMetadata[submission.id]?.title || 'Untitled'}&quot;</span>
                        <span className="text-text-muted font-normal mx-0.5">by</span>
                        <span className="text-text-secondary italic">&quot;{submission.artist_name || submissionSoundCloudMetadata[submission.id]?.author_name || submission.users.display_name}&quot;</span>
                      </p>
                      <p className="text-[10px] truncate flex items-center gap-1.5 mt-0.5">
                        <span className="text-text-secondary font-medium">&quot;{submission.users.display_name}&quot;</span>
                        {submission.session_number != null && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-semibold">#{submission.session_number}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 animate-fade-in border border-gray-800/50 min-w-0">
            {selectedSubmission ? (
              <div className="space-y-2 sm:space-y-4">
                <div className="pb-2 sm:pb-3 border-b border-gray-800/50">
                  <h2 className="text-sm sm:text-base md:text-lg mb-0.5 sm:mb-1 line-clamp-1">
                    <span className="font-bold text-primary">&quot;{selectedSubmission.song_title || submissionSoundCloudMetadata[selectedSubmission.id]?.title || 'Untitled Track'}&quot;</span>
                    <span className="text-text-muted font-normal mx-1">by</span>
                    <span className="font-semibold text-text-secondary italic">&quot;{selectedSubmission.artist_name || submissionSoundCloudMetadata[selectedSubmission.id]?.author_name || selectedSubmission.users.display_name}&quot;</span>
                  </h2>
                  <p className="text-[11px] sm:text-xs md:text-sm line-clamp-1 flex items-center gap-2 flex-wrap">
                    <span className="text-text-secondary font-medium border-l-2 border-primary/50 pl-2">&quot;{selectedSubmission.users.display_name}&quot;</span>
                    {selectedSubmission.session_number != null && (
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-semibold">Session #{selectedSubmission.session_number}</span>
                    )}
                  </p>
                  {selectedSubmission.description && (
                    <p className="text-[11px] sm:text-xs text-text-muted mt-1 sm:mt-2 line-clamp-2">
                      {selectedSubmission.description}
                    </p>
                  )}
                </div>
                <div className="bg-background-lighter rounded-md sm:rounded-lg p-2 sm:p-3 border border-gray-800/50">
                  <SoundCloudEmbed 
                    key={`embed-wrapper-${selectedSubmission.id}`}
                    submissionId={selectedSubmission.id}
                    embedData={embedData}
                    soundcloudUrl={selectedSubmission.soundcloud_url}
                    getEmbedUrl={getEmbedUrl}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-1.5 sm:pb-2">
                  <button
                    type="button"
                    onClick={handleGrantDonationXp}
                    disabled={grantingDonation}
                    className="min-h-[36px] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-button font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation"
                  >
                    {grantingDonation ? '…' : '+20 XP'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipToCarryover}
                    disabled={skipping}
                    className="min-h-[36px] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-button font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation"
                  >
                    {skipping ? '…' : 'Skip'}
                  </button>
                </div>
                <form onSubmit={handleSubmitReview} className="space-y-2 sm:space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { key: 'sound_score', label: 'Sound', colorClass: 'text-blue-400' },
                      { key: 'structure_score', label: 'Structure', colorClass: 'text-purple-400' },
                      { key: 'mix_score', label: 'Mix', colorClass: 'text-pink-400' },
                      { key: 'vibe_score', label: 'Vibe', colorClass: 'text-orange-400' },
                    ].map(({ key, label, colorClass }) => (
                      <div key={key} className="space-y-1.5 bg-background rounded-lg p-2.5 border border-gray-800/50">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-text-primary">
                            {label}
                          </label>
                          <span className={`text-sm font-bold ${colorClass}`}>
                            {scores[key as keyof typeof scores]}/10
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={scores[key as keyof typeof scores]}
                          onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer transition-all duration-200 hover:h-2.5"
                          style={{
                            background: key === 'sound_score' 
                              ? `linear-gradient(to right, #60a5fa 0%, #60a5fa ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 100%)`
                              : key === 'structure_score'
                              ? `linear-gradient(to right, #a78bfa 0%, #a78bfa ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 100%)`
                              : key === 'mix_score'
                              ? `linear-gradient(to right, #f472b6 0%, #f472b6 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 100%)`
                              : `linear-gradient(to right, #fb923c 0%, #fb923c ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #1f2937 100%)`
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 sm:gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 min-h-[44px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-medium py-2.5 px-3 sm:px-4 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press text-sm touch-manipulation"
                    >
                      {submitting ? '…' : 'Submit Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubmission(null)
                        setScores({ sound_score: '0', structure_score: '0', mix_score: '0', vibe_score: '0' })
                      }}
                      className="min-h-[44px] px-3 sm:px-4 py-2.5 border border-gray-700 text-text-primary rounded-button hover:bg-background-lighter transition-all duration-200 active:scale-[0.98] button-press text-sm touch-manipulation"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center text-text-muted py-16">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-sm">Select a submission to review</p>
              </div>
            )}
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
