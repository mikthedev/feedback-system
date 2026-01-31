'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SubmitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('edit')
  
  const [soundcloudUrl, setSoundcloudUrl] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [artistName, setArtistName] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [submissionsOpen, setSubmissionsOpen] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [embedHtml, setEmbedHtml] = useState<string | null>(null)
  const [embedLoading, setEmbedLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const fetchSubmissionsStatus = async () => {
    try {
      const response = await fetch('/api/settings/submissions', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSubmissionsOpen(data.submissions_open ?? true)
      }
    } catch (error) {
      console.error('Error fetching submissions status:', error)
    } finally {
      setCheckingStatus(false)
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
      router.push('/')
    }
  }

  const fetchSubmissionForEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/submissions/${id}`)
      if (response.ok) {
        const data = await response.json()
        const submission = data.submission
        if (submission && submission.status === 'pending') {
          setIsEditing(true)
          setSoundcloudUrl(submission.soundcloud_url || '')
          setDescription(submission.description || '')
          setArtistName(submission.artist_name || '')
          setSongTitle(submission.song_title || '')
        } else {
          router.push('/dashboard')
          return
        }
      }
    } catch (error) {
      console.error('Error fetching submission:', error)
      router.push('/dashboard')
    }
  }

  useEffect(() => {
    fetchUser()
    fetchSubmissionsStatus()
    if (submissionId) {
      fetchSubmissionForEdit(submissionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + submissionId
  }, [submissionId])

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

  // Validate SoundCloud URL format
  const isValidSoundCloudUrl = (url: string): boolean => {
    if (!url) return false
    const trimmed = url.trim()
    // Accept both regular SoundCloud URLs and on.soundcloud.com share links
    return /^https?:\/\/((www\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+|on\.soundcloud\.com\/[a-zA-Z0-9]+)/.test(trimmed)
  }

  // Fetch embed HTML when URL changes - use a debounced approach to prevent rapid re-fetching
  useEffect(() => {
    if (!isValidSoundCloudUrl(soundcloudUrl)) {
      setEmbedHtml(null)
      setEmbedLoading(false)
      return
    }

    // Debounce the fetch to prevent rapid re-fetching while typing
    const timeoutId = setTimeout(() => {
      setEmbedLoading(true)
      fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(soundcloudUrl)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.html) {
            setEmbedHtml(data.html)
          } else {
            setEmbedHtml(null)
          }
        })
        .catch(() => setEmbedHtml(null))
        .finally(() => setEmbedLoading(false))
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId)
  }, [soundcloudUrl])
  
  // Memoize the embed URL to prevent iframe recreation on every render
  // Note: getEmbedUrl is a pure function, so it's safe to call it in useMemo
  const embedUrl = useMemo(() => {
    if (!isValidSoundCloudUrl(soundcloudUrl)) return ''
    return getEmbedUrl(soundcloudUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundcloudUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const url = isEditing && submissionId
        ? `/api/submissions/${submissionId}`
        : '/api/submissions'
      
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          soundcloud_url: soundcloudUrl.trim(),
          email: email.trim() || undefined,
          description: description.trim() || undefined,
          artist_name: artistName.trim() || undefined,
          song_title: songTitle.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'submit'} demo`)
        setLoading(false)
        return
      }

      // Show warning if track was previously submitted in another session
      if (data.warning) {
        setError(data.warning)
        // Still show success since submission was successful
        setSuccess(true)
      } else {
        setSuccess(true)
      }
      if (!isEditing) {
        setSoundcloudUrl('')
        setEmail('')
        setDescription('')
        setArtistName('')
        setSongTitle('')
      }
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  // Prevent Enter key from submitting (abuse prevention)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
    }
  }

  if (!user || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-text-primary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-2 sm:px-3 md:p-4 py-4 sm:py-6 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto w-full min-w-0">
        <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 animate-fade-in border border-gray-800/50">
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-text-primary truncate min-w-0">
              {isEditing ? 'Edit' : 'Submit Demo'}
            </h1>
            {isEditing && (
              <Link href="/dashboard" className="text-[11px] sm:text-xs text-primary hover:text-primary-hover underline underline-offset-2 shrink-0 touch-manipulation">
                ← Dashboard
              </Link>
            )}
          </div>
          {!submissionsOpen && (
            <div className="mb-3 p-2.5 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs sm:text-sm">
              <strong>⚠️ Submissions closed.</strong> Check back later or contact MikeGTC.
            </div>
          )}
          {success && (
            <div className="mb-3 p-2.5 sm:p-3 bg-primary/10 border border-primary/30 text-primary rounded-lg animate-scale-in text-xs sm:text-sm">
              {isEditing ? 'Updated!' : 'Submitted!'} Redirecting…
            </div>
          )}
          {error && (
            <div className={`mb-3 p-2.5 sm:p-3 border rounded-lg animate-scale-in text-xs sm:text-sm ${
              error.includes('strictly prohibited') || error.includes('may result in a ban')
                ? 'bg-red-500/15 border-red-500/50 text-red-400'
                : error.includes('already been submitted') || error.includes('has already been submitted')
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {(error.includes('strictly prohibited') || error.includes('may result in a ban')) && '⛔ '}
              {(error.includes('already been submitted') || error.includes('has already been submitted')) && !(error.includes('strictly prohibited') || error.includes('may result in a ban')) && '⚠️ '}
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="soundcloud_url" className="block text-xs sm:text-sm font-semibold text-text-primary mb-1.5">
                SoundCloud URL <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                id="soundcloud_url"
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/…"
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border border-gray-700 rounded-button text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-all text-sm sm:text-base min-h-[44px]"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-1 text-[11px] sm:text-xs text-text-secondary">SoundCloud track URLs only</p>
              {isValidSoundCloudUrl(soundcloudUrl) && (
                <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-background-lighter rounded-lg border border-gray-800/50">
                  <p className="text-[11px] sm:text-xs font-medium text-text-secondary mb-1.5">Preview</p>
                  {embedLoading ? (
                    <div className="w-full h-28 sm:h-32 flex items-center justify-center">
                      <p className="text-[11px] sm:text-xs text-text-secondary">Loading…</p>
                    </div>
                  ) : embedHtml ? (
                    <div 
                      key={`embed-html-${soundcloudUrl}`}
                      className="soundcloud-embed w-full"
                      style={{ maxWidth: '100%', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ __html: embedHtml }}
                    />
                  ) : (
                    <div className="w-full">
                      <iframe
                        key={`embed-iframe-${soundcloudUrl}`}
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
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-xs sm:text-sm font-semibold text-text-primary mb-1.5">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your track..."
                rows={2}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-background border border-gray-700 rounded-button text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm min-h-[72px]"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-1 text-[11px] sm:text-xs text-text-secondary">Optional</p>
            </div>
            <div className="pt-2 border-t border-gray-800/50">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[11px] sm:text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 mb-2 touch-manipulation"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <span>Advanced Options</span>
              </button>

              {/* Advanced Options Content */}
              {showAdvanced && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="artist_name" className="block text-xs font-medium text-text-secondary mb-1.5">
                        Artist Name
                      </label>
                      <input
                        type="text"
                        id="artist_name"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        placeholder="Override artist name"
                        className="w-full px-3 py-2 text-sm bg-background border border-gray-700 rounded-button text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words transition-all duration-200"
                        disabled={loading || (!submissionsOpen && !isEditing)}
                      />
                    </div>
                    <div>
                      <label htmlFor="song_title" className="block text-xs font-medium text-text-secondary mb-1.5">
                        Song Title
                      </label>
                      <input
                        type="text"
                        id="song_title"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Override song title"
                        className="w-full px-3 py-2 text-sm bg-background border border-gray-700 rounded-button text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words transition-all duration-200"
                        disabled={loading || (!submissionsOpen && !isEditing)}
                      />
                    </div>
                  </div>

                  {!isEditing && (
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 text-sm bg-background border border-gray-700 rounded-button text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words transition-all duration-200"
                        disabled={loading || !submissionsOpen}
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Optional: Receive confirmation email
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 sm:gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !soundcloudUrl.trim() || (!submissionsOpen && !isEditing)}
                className="flex-1 min-h-[44px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-medium py-2.5 sm:py-3 px-3 sm:px-4 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press text-sm touch-manipulation"
              >
                {loading ? (isEditing ? 'Updating…' : 'Submitting…') : (isEditing ? 'Update' : 'Submit Demo')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="min-h-[44px] px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-700 text-text-primary rounded-button hover:bg-background-lighter transition-all duration-200 active:scale-[0.98] button-press text-sm touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-text-primary">Loading...</div>
      </div>
    }>
      <SubmitPageContent />
    </Suspense>
  )
}
