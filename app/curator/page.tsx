'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'

// Memoized embed component to prevent re-renders when scores change
const SoundCloudEmbed = memo(({ 
  embedData, 
  soundcloudUrl, 
  getEmbedUrl 
}: { 
  embedData: EmbedData | null
  soundcloudUrl: string
  getEmbedUrl: (url: string) => string
}) => {
  return (
    <div className="mb-4">
      {embedData?.html ? (
        <div 
          className="soundcloud-embed w-full"
          style={{ maxWidth: '100%', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: embedData.html }}
        />
      ) : embedData?.error ? (
        <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
          <p className="text-sm text-gray-600 mb-2">
            Unable to embed this track. 
            <a 
              href={soundcloudUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline ml-1"
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
            src={getEmbedUrl(soundcloudUrl)}
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
          src={getEmbedUrl(soundcloudUrl)}
          className="rounded"
          title="SoundCloud Player"
        ></iframe>
      )}
    </div>
  )
})

SoundCloudEmbed.displayName = 'SoundCloudEmbed'

interface Submission {
  id: string
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
  const [embedData, setEmbedData] = useState<EmbedData | null>(null)
  const [submissionArtworks, setSubmissionArtworks] = useState<SubmissionArtwork>({})
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionsToDelete, setSessionsToDelete] = useState<number[]>([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetchUser()
    fetchPendingSubmissions()
    fetchSubmissionsStatus()
    fetchSessions()
  }, [])

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
      const response = await fetch('/api/submissions/pending')
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
        
        // Fetch artwork for each submission
        const artworkPromises = (data.submissions || []).map(async (submission: Submission) => {
          try {
            const embedResponse = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(submission.soundcloud_url)}`)
            if (embedResponse.ok) {
              const embedResult = await embedResponse.json()
              return { id: submission.id, artwork: embedResult.thumbnail_url || null }
            }
          } catch (error) {
            console.error('Error fetching artwork:', error)
          }
          return { id: submission.id, artwork: null }
        })
        
        const artworkResults = await Promise.all(artworkPromises)
        const artworkMap: SubmissionArtwork = {}
        artworkResults.forEach(({ id, artwork }) => {
          artworkMap[id] = artwork
        })
        setSubmissionArtworks(artworkMap)
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
    }
  }

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-white to-indigo-50 rounded-xl shadow-lg p-4 mb-4 animate-fade-in border border-indigo-100">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">MikeGTC Panel</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-lg transition-all duration-200 font-medium"
              >
                {showSettings ? 'Hide' : 'Settings'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg transition-all duration-200 font-medium"
              >
                Dashboard
              </button>
            </div>
          </div>
          
          {/* Collapsible Settings */}
          {showSettings && (
            <div className="mt-4 pt-4 border-t border-gray-200 animate-slide-in space-y-3">
              {/* Submissions Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-800">Submission Status</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {submissionsOpen ? 'Open' : 'Closed'}
                  </p>
                </div>
                <button
                  onClick={handleToggleSubmissions}
                  disabled={toggling}
                  className={`px-4 py-1.5 text-sm rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
                    submissionsOpen
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                  }`}
                >
                  {toggling ? '...' : submissionsOpen ? 'Close' : 'Open'}
                </button>
              </div>

              {/* Sessions Management */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Sessions</h3>
                  <button
                    onClick={() => handleDeleteSessions(undefined, true)}
                    disabled={deleting || loadingSessions || sessions.length === 0}
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete All
                  </button>
                </div>
                {loadingSessions ? (
                  <p className="text-xs text-gray-600">Loading...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-gray-600">No sessions</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2 bg-white rounded text-xs"
                      >
                        <span className="font-medium text-gray-800">
                          #{session.session_number} ({session.submission_count || 0})
                        </span>
                        <button
                          onClick={() => handleDeleteSessions([session.session_number])}
                          disabled={deleting || showDeleteConfirm}
                          className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-all duration-200 disabled:opacity-50"
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

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg animate-scale-in">
            {typeof success === 'string' ? success : 'Review submitted successfully!'}
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg animate-scale-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compact Submissions List */}
          <div className="lg:col-span-1 bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg p-4 animate-fade-in border border-purple-100">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              Pending ({submissions.length})
            </h2>
            {submissions.length === 0 ? (
              <p className="text-sm text-gray-500">No pending submissions</p>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className={`border rounded-lg p-2 cursor-pointer transition-all duration-200 ${
                      selectedSubmission?.id === submission.id
                        ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md scale-[1.01]'
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm hover:bg-gray-50'
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
                          setEmbedData({ 
                            html: embedResult.html,
                            thumbnail_url: embedResult.thumbnail_url 
                          })
                        } else {
                          setEmbedData({ error: 'Failed to load embed' })
                        }
                      } catch (error) {
                        setEmbedData({ error: 'Failed to load embed' })
                      }
                    }}
                  >
                    <div className="flex gap-2">
                      {submissionArtworks[submission.id] && (
                        <img
                          src={submissionArtworks[submission.id] || ''}
                          alt={submission.song_title || 'Track artwork'}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-gray-800 line-clamp-1">
                          {submission.song_title || 'Untitled Track'}
                        </p>
                        <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                          {submission.artist_name || submission.users.display_name}
                        </p>
                        {submission.session_number && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            #{submission.session_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Panel - Focus on Embed and Scoring */}
          <div className="lg:col-span-2 bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg p-4 md:p-6 animate-fade-in border border-blue-100">
            {selectedSubmission ? (
              <div className="space-y-4">
                {/* Track Info - Compact */}
                <div className="pb-3 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-800 mb-1">
                    {selectedSubmission.song_title || 'Untitled Track'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedSubmission.artist_name || selectedSubmission.users.display_name}
                    {selectedSubmission.session_number && ` • Session #${selectedSubmission.session_number}`}
                  </p>
                  {selectedSubmission.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {selectedSubmission.description}
                    </p>
                  )}
                </div>
                
                {/* SoundCloud Embed - Prominent */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <SoundCloudEmbed 
                    key={selectedSubmission.id}
                    embedData={embedData}
                    soundcloudUrl={selectedSubmission.soundcloud_url}
                    getEmbedUrl={getEmbedUrl}
                  />
                </div>

                {/* Scoring System - Compact Grid */}
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'sound_score', label: 'Sound', color: 'from-blue-500 to-blue-600' },
                      { key: 'structure_score', label: 'Structure', color: 'from-purple-500 to-purple-600' },
                      { key: 'mix_score', label: 'Mix', color: 'from-pink-500 to-pink-600' },
                      { key: 'vibe_score', label: 'Vibe', color: 'from-orange-500 to-orange-600' },
                    ].map(({ key, label, color }) => (
                      <div key={key} className="space-y-1.5 bg-white rounded-lg p-2.5 border border-gray-200">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-gray-700">
                            {label}
                          </label>
                          <span className={`text-sm font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
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
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer transition-all duration-200 hover:h-2.5"
                          style={{
                            background: key === 'sound_score' 
                              ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb 100%)`
                              : key === 'structure_score'
                              ? `linear-gradient(to right, #a855f7 0%, #a855f7 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb 100%)`
                              : key === 'mix_score'
                              ? `linear-gradient(to right, #ec4899 0%, #ec4899 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb 100%)`
                              : `linear-gradient(to right, #f97316 0%, #f97316 ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb ${(parseFloat(scores[key as keyof typeof scores]) / 10) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubmission(null)
                        setScores({
                          sound_score: '0',
                          structure_score: '0',
                          mix_score: '0',
                          vibe_score: '0',
                        })
                      }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-16">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-sm">Select a submission to review</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6 text-sm">
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
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSessions(sessionsToDelete, sessionsToDelete.length === 0)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
