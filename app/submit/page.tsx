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
    <div className="bg-background px-3 sm:px-3 md:px-4 py-4 sm:py-5 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto w-full min-w-0">
        <div className="bg-background-light rounded-xl shadow-lg p-4 sm:p-5 md:p-6 animate-fade-in border-2 border-gray-700/60">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-lg font-extrabold text-text-primary truncate min-w-0 sm:text-xl md:text-2xl tracking-tight">
              {isEditing ? 'Edit' : 'Submit Demo'}
            </h1>
            {isEditing && (
              <Link href="/dashboard" className="text-sm text-primary hover:text-primary-hover font-semibold underline underline-offset-2 shrink-0 touch-manipulation min-h-[44px] flex items-center sm:min-h-0 sm:text-xs sm:font-medium">
                ← Dashboard
              </Link>
            )}
          </div>
          {!submissionsOpen && (
            <div className="mb-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/40 text-yellow-400 rounded-xl text-sm font-bold">
              ⚠️ Submissions closed. Check back later or contact MikeGTC.
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-primary/10 border-2 border-primary/40 text-primary rounded-xl animate-scale-in text-sm font-bold">
              {isEditing ? 'Updated!' : 'Submitted!'} Redirecting…
            </div>
          )}
          {error && (
            <div className={`mb-4 p-4 border-2 rounded-xl animate-scale-in text-sm font-bold ${
              error.includes('strictly prohibited') || error.includes('may result in a ban')
                ? 'bg-red-500/15 border-red-500/60 text-red-400'
                : error.includes('already been submitted') || error.includes('has already been submitted')
                  ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                  : 'bg-red-500/10 border-red-500/50 text-red-400'
            }`}>
              {(error.includes('strictly prohibited') || error.includes('may result in a ban')) && '⛔ '}
              {(error.includes('already been submitted') || error.includes('has already been submitted')) && !(error.includes('strictly prohibited') || error.includes('may result in a ban')) && '⚠️ '}
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
            <div>
              <label htmlFor="soundcloud_url" className="block text-sm font-bold text-text-primary mb-2">
                SoundCloud URL <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                id="soundcloud_url"
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/…"
                required
                className="w-full px-4 py-3 bg-background border-2 border-gray-600 rounded-xl text-base font-medium text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-all min-h-[48px]"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-2 text-sm text-text-secondary font-medium">SoundCloud track URLs only</p>
              {isValidSoundCloudUrl(soundcloudUrl) && (
                <div className="mt-4 p-4 bg-background-lighter rounded-xl border-2 border-gray-700/60">
                  <p className="text-sm font-bold text-text-secondary mb-2">Preview</p>
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
              <label htmlFor="description" className="block text-sm font-bold text-text-primary mb-2">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your track..."
                rows={3}
                className="w-full px-4 py-3 bg-background border-2 border-gray-600 rounded-xl text-base font-medium text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary resize-none min-h-[88px]"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-2 text-sm text-text-secondary font-medium">Optional</p>
            </div>
            <div className="pt-4 border-t-2 border-gray-700/60">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors duration-200 mb-4 touch-manipulation min-h-[48px] items-center"
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
                    <label htmlFor="artist_name" className="block text-sm font-bold text-text-secondary mb-2">
                      Artist Name
                    </label>
                    <input
                      type="text"
                      id="artist_name"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Override artist name"
                      className="w-full px-4 py-3 text-base font-medium bg-background border-2 border-gray-600 rounded-xl text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words min-h-[48px]"
                        disabled={loading || (!submissionsOpen && !isEditing)}
                      />
                    </div>
                    <div>
                    <label htmlFor="song_title" className="block text-sm font-bold text-text-secondary mb-2">
                      Song Title
                    </label>
                    <input
                      type="text"
                      id="song_title"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Override song title"
                      className="w-full px-4 py-3 text-base font-medium bg-background border-2 border-gray-600 rounded-xl text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words min-h-[48px]"
                        disabled={loading || (!submissionsOpen && !isEditing)}
                      />
                    </div>
                  </div>

                  {!isEditing && (
                    <div>
                      <label htmlFor="email" className="block text-sm font-bold text-text-secondary mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 text-base font-medium bg-background border-2 border-gray-600 rounded-xl text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary break-words min-h-[48px]"
                        disabled={loading || !submissionsOpen}
                      />
                      <p className="mt-2 text-sm text-text-muted font-medium">
                        Optional: Receive confirmation email
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:gap-4">
              <button
                type="submit"
                disabled={loading || !soundcloudUrl.trim() || (!submissionsOpen && !isEditing)}
                className="w-full min-h-[52px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-bold py-3 px-5 rounded-xl text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press touch-manipulation sm:flex-[2] border-2 border-transparent hover:border-primary/30"
              >
                {loading ? (isEditing ? 'Updating…' : 'Submitting…') : (isEditing ? 'Update' : 'Submit Demo')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full min-h-[48px] px-4 py-3 border-2 border-gray-600 text-text-primary rounded-xl text-base font-bold hover:bg-background-lighter transition-all duration-200 active:scale-[0.98] button-press touch-manipulation sm:flex-1"
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
