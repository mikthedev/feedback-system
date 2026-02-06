'use client'

import { useState, useEffect, Suspense, useMemo, memo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

/** Memoized SoundCloud preview — only re-renders when embed-related props change, so typing in description or selecting genre won't restart the player */
const SoundCloudPreview = memo(function SoundCloudPreview({
  soundcloudUrl,
  embedHtml,
  embedLoading,
  embedUrl,
  isValid,
}: {
  soundcloudUrl: string
  embedHtml: string | null
  embedLoading: boolean
  embedUrl: string
  isValid: boolean
}) {
  if (!isValid) return null
  return (
    <div className="mt-4 p-4 bg-background-lighter rounded-xl border-2 border-gray-700/60 soundcloud-embed-inner" style={{ contain: 'layout style paint' }}>
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
          />
        </div>
      )}
    </div>
  )
})

// Genre options: main selectable list (alphabetical); Other at end; sub-genres only for Future House and Drum & Bass
const GENRE_MAIN_OPTIONS = [
  { value: 'Bass House', label: 'Bass House' },
  { value: 'Drum & Bass', label: 'Drum & Bass' },
  { value: 'Dubstep', label: 'Dubstep' },
  { value: 'Future Bass', label: 'Future Bass' },
  { value: 'Future House', label: 'Future House' },
  { value: 'Hip-Hop', label: 'Hip-Hop' },
  { value: 'House', label: 'House' },
  { value: 'Pop', label: 'Pop' },
  { value: 'Other', label: 'Other' },
] as const

const GENRE_SUB_BY_MAIN: Record<string, readonly { value: string; label: string }[]> = {
  'Future House': [
    { value: 'Future Bounce', label: 'Future Bounce' },
    { value: 'Future Room', label: 'Future Room' },
  ],
  'Drum & Bass': [
    { value: 'Dancefloor', label: 'Dancefloor' },
    { value: 'Jump Up', label: 'Jump Up' },
    { value: 'UK Garage', label: 'UK Garage' },
  ],
}

// Names that cannot be used when "Other" is selected (case-insensitive)
const GENRE_RESERVED_NAMES = [
  'House', 'Future House', 'Future Bounce', 'Future Room', 'Future Bass', 'Bass House',
  'Drum & Bass', 'Jump Up', 'UK Garage', 'Dancefloor', 'Dubstep', 'Pop', 'Hip-Hop', 'Other',
]

/** Extract first hashtag from text (e.g. description) and return title-cased label, or null */
function extractFirstHashtag(text: string | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/#([\w]+)/)
  if (!match) return null
  const raw = match[1]
  const withSpaces = raw.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
  const titleCased = withSpaces.toLowerCase().replace(/(?:^|\s)\w/g, (c) => c.toUpperCase())
  return titleCased || raw
}

function SubmitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('edit')
  const { t } = useLanguage()
  
  const [soundcloudUrl, setSoundcloudUrl] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [artistName, setArtistName] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [genreMain, setGenreMain] = useState<string>('')
  const [genreSub, setGenreSub] = useState<string>('')
  const [genreOther, setGenreOther] = useState('')
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
  const [suggestedGenreFromSoundCloud, setSuggestedGenreFromSoundCloud] = useState<string | null>(null)
  const [showGenrePrompt, setShowGenrePrompt] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

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
          // Parse stored genre for edit: "Main (Sub)" or "Main" or custom (Other)
          const g = (submission.genre || '').trim()
          if (g) {
            const futureHouseMatch = g.match(/^Future House\s*\((.*)\)\s*$/)
            const drumBassMatch = g.match(/^Drum & Bass\s*\((.*)\)\s*$/)
            if (futureHouseMatch) {
              setGenreMain('Future House')
              setGenreSub(futureHouseMatch[1].trim() || '')
            } else if (drumBassMatch) {
              setGenreMain('Drum & Bass')
              setGenreSub(drumBassMatch[1].trim() || '')
            } else if (GENRE_MAIN_OPTIONS.some((o) => o.value === g)) {
              setGenreMain(g)
              setGenreSub('')
              setGenreOther('')
            } else {
              setGenreMain('Other')
              setGenreSub('')
              setGenreOther(g)
            }
          }
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

  // Fetch embed HTML and optional genre from first hashtag when URL changes
  useEffect(() => {
    if (!isValidSoundCloudUrl(soundcloudUrl)) {
      setEmbedHtml(null)
      setEmbedLoading(false)
      setSuggestedGenreFromSoundCloud(null)
      return
    }

    const timeoutId = setTimeout(() => {
      setEmbedLoading(true)
      setSuggestedGenreFromSoundCloud(null)
      fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(soundcloudUrl)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.html) {
            setEmbedHtml(data.html)
          } else {
            setEmbedHtml(null)
          }
          const suggested = extractFirstHashtag(data?.description)
          if (suggested) setSuggestedGenreFromSoundCloud(suggested)
        })
        .catch(() => {
          setEmbedHtml(null)
          setSuggestedGenreFromSoundCloud(null)
        })
        .finally(() => setEmbedLoading(false))
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [soundcloudUrl])
  
  // Memoize the embed URL to prevent iframe recreation on every render
  // Note: getEmbedUrl is a pure function, so it's safe to call it in useMemo
  const embedUrl = useMemo(() => {
    if (!isValidSoundCloudUrl(soundcloudUrl)) return ''
    return getEmbedUrl(soundcloudUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundcloudUrl])

  // Build genre string for API: "Main", "Main (Sub)", or custom for Other
  const getGenrePayload = (): string | null => {
    if (!genreMain) return null
    if (genreMain === 'Other') {
      const custom = genreOther.trim()
      return custom || null
    }
    const subOptions = GENRE_SUB_BY_MAIN[genreMain]
    if (subOptions && subOptions.length > 0 && genreSub) {
      return `${genreMain} (${genreSub})`
    }
    return genreMain
  }

  const isGenreOtherDuplicate = (value: string): boolean => {
    const v = value.trim().toLowerCase()
    if (!v) return false
    return GENRE_RESERVED_NAMES.some((name) => name.toLowerCase() === v)
  }

  /** Perform the actual API submit (used after genre prompt or when genre is filled) */
  const doSubmit = async (genrePayload: string | null) => {
    setError('')
    setSuccess(false)
    setLoading(true)
    setShowGenrePrompt(false)
    setPendingSubmit(false)

    try {
      const url = isEditing && submissionId
        ? `/api/submissions/${submissionId}`
        : '/api/submissions'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soundcloud_url: soundcloudUrl.trim(),
          email: email.trim() || undefined,
          description: description.trim() || undefined,
          artist_name: artistName.trim() || undefined,
          song_title: songTitle.trim() || undefined,
          genre: genrePayload || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'submit'} demo`)
        setLoading(false)
        return
      }

      if (data.warning) {
        setError(data.warning)
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
        setGenreMain('')
        setGenreSub('')
        setGenreOther('')
        setSuggestedGenreFromSoundCloud(null)
      }
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (genreMain === 'Other' && genreOther.trim()) {
      if (isGenreOtherDuplicate(genreOther)) {
        setError('This genre name is already in the list. Please choose it from the list or enter a different name.')
        return
      }
    }

    let genrePayload = getGenrePayload()

    // No genre: ask user to fill for better experience; offer SoundCloud hashtag or submit without
    if (!genrePayload) {
      if (suggestedGenreFromSoundCloud) {
        setShowGenrePrompt(true)
        setPendingSubmit(true)
        return
      }
      setShowGenrePrompt(true)
      setPendingSubmit(true)
      return
    }

    await doSubmit(genrePayload)
  }

  const handleGenrePromptUseSuggested = () => {
    if (!suggestedGenreFromSoundCloud) return
    const s = suggestedGenreFromSoundCloud.trim()
    const mainMatch = GENRE_MAIN_OPTIONS.find((o) => o.value.toLowerCase() === s.toLowerCase())
    if (mainMatch) {
      setShowGenrePrompt(false)
      setPendingSubmit(false)
      doSubmit(mainMatch.value)
      return
    }
    const subMatch = Object.entries(GENRE_SUB_BY_MAIN).find(([, subs]) =>
      subs.some((sub) => sub.value.toLowerCase() === s.toLowerCase())
    )
    const payload = subMatch ? `${subMatch[0]} (${subMatch[1].find((sub) => sub.value.toLowerCase() === s.toLowerCase())!.value})` : s
    setShowGenrePrompt(false)
    setPendingSubmit(false)
    doSubmit(payload)
  }

  const handleGenrePromptSubmitWithout = () => {
    setShowGenrePrompt(false)
    setPendingSubmit(false)
    doSubmit(null)
  }

  const handleGenrePromptClose = () => {
    setShowGenrePrompt(false)
    setPendingSubmit(false)
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
        <div className="text-xl text-text-primary">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="bg-background px-3 sm:px-3 md:px-4 py-4 sm:py-5 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto w-full min-w-0">
        <div className="bg-background-light rounded-xl shadow-lg p-4 sm:p-5 md:p-6 animate-fade-in border-2 border-gray-700/60">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-lg font-extrabold text-text-primary truncate min-w-0 sm:text-xl md:text-2xl tracking-tight">
              {isEditing ? t('submit.editDemo') : t('submit.title')}
            </h1>
            {isEditing && (
              <Link href="/dashboard" className="text-sm text-primary hover:text-primary-hover font-semibold underline underline-offset-2 shrink-0 touch-manipulation min-h-[44px] flex items-center sm:min-h-0 sm:text-xs sm:font-medium">
                ← {t('common.dashboard')}
              </Link>
            )}
          </div>
          {!submissionsOpen && (
            <div className="mb-4 p-4 bg-yellow-500/10 border-2 border-yellow-500/40 text-yellow-400 rounded-xl text-sm font-bold">
              ⚠️ {t('submit.submissionsClosed')}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-primary/10 border-2 border-primary/40 text-primary rounded-xl animate-scale-in text-sm font-bold">
              {isEditing ? t('submit.updated') : t('submit.submitted')}
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

          {/* Genre prompt: ask to fill for better experience, or use SoundCloud hashtag / submit without */}
          {showGenrePrompt && pendingSubmit && (
            <div className="mb-4 p-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 text-amber-200 animate-scale-in space-y-3">
              <p className="text-sm font-bold">
                Add a genre for a better experience — it helps us organize and review your track.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedGenreFromSoundCloud && (
                  <button
                    type="button"
                    onClick={handleGenrePromptUseSuggested}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-background font-bold text-sm border-2 border-primary/50 transition-all active:scale-[0.98]"
                  >
                    Use “{suggestedGenreFromSoundCloud}” from track
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGenrePromptSubmitWithout}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-background-lighter hover:bg-gray-700 text-text-primary font-bold text-sm border-2 border-gray-600 transition-all active:scale-[0.98]"
                >
                  Submit without genre
                </button>
                <button
                  type="button"
                  onClick={handleGenrePromptClose}
                  className="px-4 py-2 rounded-xl text-text-muted hover:text-text-primary font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
            <div>
              <label htmlFor="soundcloud_url" className="block text-sm font-bold text-text-primary mb-2">
                {t('submit.soundcloudUrl')} <span className="text-primary">*</span>
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
              <SoundCloudPreview
                soundcloudUrl={soundcloudUrl}
                embedHtml={embedHtml}
                embedLoading={embedLoading}
                embedUrl={embedUrl}
                isValid={isValidSoundCloudUrl(soundcloudUrl)}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-bold text-text-primary mb-2">{t('common.description')}</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your track..."
                rows={3}
                className="w-full px-4 py-3 bg-background border-2 border-gray-600 rounded-xl text-base font-medium text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary resize-none min-h-[88px]"
                disabled={loading || (!submissionsOpen && !isEditing)}
              />
              <p className="mt-2 text-sm text-text-secondary font-medium">{t('submit.optional')}</p>
            </div>

            {/* Genre — styled to match app theme */}
            <fieldset className="rounded-xl overflow-hidden border-2 border-gray-700/60 bg-background-lighter/50">
              <legend className="sr-only">Genre</legend>
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Genre</span>
                  {suggestedGenreFromSoundCloud && !genreMain && (
                    <button
                      type="button"
                      onClick={() => {
                        const s = suggestedGenreFromSoundCloud.trim()
                        const mainMatch = GENRE_MAIN_OPTIONS.find((o) => o.value.toLowerCase() === s.toLowerCase())
                        if (mainMatch) {
                          setGenreMain(mainMatch.value)
                          setGenreSub('')
                          setGenreOther('')
                        } else {
                          const subMatch = Object.entries(GENRE_SUB_BY_MAIN).find(([, subs]) =>
                            subs.some((sub) => sub.value.toLowerCase() === s.toLowerCase())
                          )
                          if (subMatch) {
                            setGenreMain(subMatch[0])
                            setGenreSub(subMatch[1].find((sub) => sub.value.toLowerCase() === s.toLowerCase())!.value)
                            setGenreOther('')
                          } else {
                            setGenreMain('Other')
                            setGenreSub('')
                            setGenreOther(s)
                          }
                        }
                      }}
                      disabled={loading || (!submissionsOpen && !isEditing)}
                      className="text-[10px] font-bold uppercase tracking-wider text-background px-2.5 py-1 rounded-full bg-primary/90 border border-primary hover:bg-primary transition-colors"
                    >
                      From track: {suggestedGenreFromSoundCloud}
                    </button>
                  )}
                  {genreMain && (
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                      {genreMain}
                      {genreSub && ` · ${genreSub}`}
                      {genreMain === 'Other' && genreOther && ` · ${genreOther}`}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {GENRE_MAIN_OPTIONS.filter((o) => o.value !== 'Other').map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setGenreMain(opt.value)
                        setGenreSub('')
                        setGenreOther('')
                      }}
                      disabled={loading || (!submissionsOpen && !isEditing)}
                      className={`relative py-2.5 px-2 rounded-button text-xs font-bold transition-all duration-200 touch-manipulation overflow-hidden ${
                        genreMain === opt.value
                          ? 'bg-primary text-background shadow-md shadow-primary/20 ring-2 ring-primary/60 ring-offset-2 ring-offset-background-light scale-[1.02]'
                          : 'bg-background border-2 border-gray-700/60 text-text-secondary hover:border-primary/40 hover:text-text-primary hover:bg-primary/5'
                      }`}
                    >
                      <span className="block truncate">{opt.label}</span>
                    </button>
                  ))}
                  <button
                    key="Other"
                    type="button"
                    onClick={() => {
                      setGenreMain('Other')
                      setGenreSub('')
                      setGenreOther('')
                    }}
                    disabled={loading || (!submissionsOpen && !isEditing)}
                    className={`relative py-2.5 px-2 rounded-button text-xs font-medium transition-all duration-200 touch-manipulation overflow-hidden border border-dashed ${
                      genreMain === 'Other'
                        ? 'bg-primary/80 text-background border-primary shadow-md ring-2 ring-primary/50 ring-offset-2 ring-offset-background-light scale-[1.02]'
                        : 'bg-background/80 border-gray-600 text-text-muted hover:border-gray-500 hover:text-text-secondary'
                    }`}
                  >
                    <span className="block truncate">Other</span>
                  </button>
                </div>

                {(genreMain === 'Future House' || genreMain === 'Drum & Bass') && GENRE_SUB_BY_MAIN[genreMain] && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-700/60 animate-fade-in">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Sub-genre (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {GENRE_SUB_BY_MAIN[genreMain].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGenreSub(genreSub === opt.value ? '' : opt.value)}
                          disabled={loading || (!submissionsOpen && !isEditing)}
                          className={`px-3 py-1.5 rounded-button text-[11px] font-semibold transition-all border-2 ${
                            genreSub === opt.value
                              ? 'bg-primary text-background border-primary'
                              : 'bg-background border-gray-700/60 text-text-secondary hover:border-primary/50 hover:text-text-primary hover:bg-primary/5'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {genreMain === 'Other' && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-700/60 animate-fade-in">
                    <label htmlFor="genre_other" className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Custom genre</label>
                    <input
                      type="text"
                      id="genre_other"
                      value={genreOther}
                      onChange={(e) => setGenreOther(e.target.value)}
                      placeholder="e.g. Techno, Trance…"
                      className="w-full px-4 py-2.5 rounded-button bg-background border-2 border-gray-600 text-sm font-medium text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-primary"
                      disabled={loading || (!submissionsOpen && !isEditing)}
                    />
                    <p className="mt-1.5 text-[10px] text-text-muted">Must differ from genres in the list above.</p>
                  </div>
                )}
              </div>
            </fieldset>

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
                      {t('submit.artistName')}
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
                      {t('submit.songTitle')}
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
                {loading ? (isEditing ? t('submit.updating') : t('submit.submitting')) : (isEditing ? t('submit.updateButton') : t('submit.title'))}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-full min-h-[48px] px-4 py-3 border-2 border-gray-600 text-text-primary rounded-xl text-base font-bold hover:bg-background-lighter transition-all duration-200 active:scale-[0.98] button-press touch-manipulation sm:flex-1"
              >
                {t('submit.cancel')}
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
