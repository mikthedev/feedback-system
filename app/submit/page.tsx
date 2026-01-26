'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

  useEffect(() => {
    fetchUser()
    fetchSubmissionsStatus()
    if (submissionId) {
      fetchSubmissionForEdit(submissionId)
    }
  }, [submissionId])

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

  // Validate SoundCloud URL format
  const isValidSoundCloudUrl = (url: string): boolean => {
    if (!url) return false
    const trimmed = url.trim()
    return /^https?:\/\/(www\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/.test(trimmed)
  }

  // Fetch embed HTML when URL changes
  useEffect(() => {
    if (isValidSoundCloudUrl(soundcloudUrl)) {
      setEmbedLoading(true)
      setEmbedHtml(null)
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
    } else {
      setEmbedHtml(null)
    }
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
        // Check if it's a duplicate link warning
        if (data.warning && data.error) {
          setError(data.error)
        } else {
          setError(data.error || `Failed to ${isEditing ? 'update' : 'submit'} demo`)
        }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-white to-indigo-50 rounded-xl shadow-lg p-4 md:p-6 animate-fade-in border border-indigo-100">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">
            {isEditing ? 'Edit Submission' : 'Submit Demo'}
          </h1>
          
          {!submissionsOpen && (
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
              <strong>⚠️ Submissions are currently closed.</strong> Please check back later or contact MikeGTC for more information.
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg animate-scale-in text-sm">
              {isEditing ? 'Submission updated successfully!' : 'Demo submitted successfully!'} Redirecting to dashboard...
            </div>
          )}

          {error && (
            <div className={`mb-4 p-3 border rounded-lg animate-scale-in text-sm ${
              error.includes('already been submitted') || error.includes('has already been submitted')
                ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                : 'bg-red-100 border-red-400 text-red-700'
            }`}>
              {(error.includes('already been submitted') || error.includes('has already been submitted')) && '⚠️ '}
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            <div className="mb-4">
              <label htmlFor="soundcloud_url" className="block text-sm font-medium text-gray-700 mb-2">
                SoundCloud URL *
              </label>
              <input
                type="text"
                id="soundcloud_url"
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/username/track-name"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent break-words transition-all duration-200"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-1 text-sm text-gray-500">
                Only SoundCloud track URLs are accepted
              </p>
              
              {/* SoundCloud Embed Preview */}
              {isValidSoundCloudUrl(soundcloudUrl) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  {embedLoading ? (
                    <div className="w-full h-32 flex items-center justify-center">
                      <p className="text-sm text-gray-500">Loading preview...</p>
                    </div>
                  ) : embedHtml ? (
                    <div 
                      className="soundcloud-embed w-full"
                      style={{ maxWidth: '100%', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ __html: embedHtml }}
                    />
                  ) : (
                    <div className="w-full">
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
                  )}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your track..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none break-words"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-1 text-sm text-gray-500">
                Optional: Add a description of what you're submitting
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="artist_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Artist Name
                </label>
                <input
                  type="text"
                  id="artist_name"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Artist name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent break-words"
                  disabled={loading || (!submissionsOpen && !isEditing)}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional: Override artist name
                </p>
              </div>
              <div>
                <label htmlFor="song_title" className="block text-sm font-medium text-gray-700 mb-2">
                  Song Title
                </label>
                <input
                  type="text"
                  id="song_title"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="Song title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent break-words"
                  disabled={loading || (!submissionsOpen && !isEditing)}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional: Override song title
                </p>
              </div>
            </div>

            {!isEditing && (
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email (optional)
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent break-words"
                  disabled={loading || !submissionsOpen}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional: Receive confirmation email. If not provided, we'll use your Twitch email.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !soundcloudUrl.trim() || (!submissionsOpen && !isEditing)}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? (isEditing ? 'Updating...' : 'Submitting...') : (isEditing ? 'Update Submission' : 'Submit Demo')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    }>
      <SubmitPageContent />
    </Suspense>
  )
}
