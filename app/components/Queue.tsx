'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'

interface QueueItem {
  id: string
  user_id?: string
  soundcloud_url: string
  song_title?: string
  artist_name?: string
  created_at: string
  users: {
    display_name: string
  }
  moves_used_this_session?: number
}

interface QueueItemWithMetadata extends QueueItem {
  queueNumber: number
  displayTitle: string
  displayArtist: string
  artwork?: string
  _isNew?: boolean
  _movedUp?: boolean
  moves_used_this_session: number
}

export interface QueueLoadedItem {
  id: string
  user_id: string
  position: number
}

interface QueueProps {
  currentUserId?: string | null
  refetchTrigger?: number
  onQueueLoaded?: (items: QueueLoadedItem[]) => void
  /** Optional: show compact styling (e.g. in curator panel) */
  compact?: boolean
  /** Render without outer card chrome (parent provides the window). */
  embedded?: boolean
}

const QUEUE_COLLAPSED_THRESHOLD = 5
const QUEUE_COLLAPSED_VISIBLE = 3

export default function Queue({ currentUserId, refetchTrigger, onQueueLoaded, compact = false, embedded = false }: QueueProps) {
  const { t } = useLanguage()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataCache, setMetadataCache] = useState<Record<string, { title: string; artwork?: string }>>({})
  const [queueExpanded, setQueueExpanded] = useState(false)
  const previousQueueIdsRef = useRef<Set<string>>(new Set())
  const previousPositionByIdRef = useRef<Record<string, number>>({})

  const fetchQueue = useCallback(
    async (opts: { silent?: boolean; notifyParent?: boolean } = {}) => {
      const { silent = false, notifyParent = true } = opts
      try {
        const response = await fetch('/api/submissions/queue', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          const newQueue = data.queue || []
          const currentIds = new Set(newQueue.map((item: QueueItem) => item.id))
          previousQueueIdsRef.current = currentIds
          setQueue(newQueue)
          if (notifyParent && onQueueLoaded) {
            const items: QueueLoadedItem[] = newQueue.map((item: QueueItem, index: number) => ({
              id: item.id,
              user_id: item.user_id ?? '',
              position: index + 1,
            }))
            onQueueLoaded(items)
          }
        }
      } catch (error) {
        console.error('Error fetching queue:', error)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [onQueueLoaded]
  )

  // Refetch when parent triggers (e.g. after tester XP adjust); always notify parent
  useEffect(() => {
    if (refetchTrigger != null && refetchTrigger > 0) fetchQueue({ silent: true, notifyParent: true })
  }, [refetchTrigger, fetchQueue])

  // Fetch SoundCloud metadata for items without song titles
  useEffect(() => {
    const fetchMetadata = async () => {
      const itemsNeedingMetadata = queue.filter(
        item => !item.song_title && !metadataCache[item.soundcloud_url]
      )

      if (itemsNeedingMetadata.length === 0) return

      const metadataPromises = itemsNeedingMetadata.map(async (item) => {
        try {
          const response = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(item.soundcloud_url)}`)
          if (response.ok) {
            const data = await response.json()
            // SoundCloud oEmbed returns title in the format "Artist - Title" or just "Title"
            // Extract just the title part if it contains a dash
            let title = data.title || 'Untitled Track'
            if (title.includes(' - ')) {
              const parts = title.split(' - ')
              title = parts[parts.length - 1] // Get the last part (song title)
            }
            
            return {
              url: item.soundcloud_url,
              title: title.trim(),
              artwork: data.thumbnail_url || undefined,
            }
          }
        } catch (error) {
          console.error('Error fetching metadata:', error)
        }
        return {
          url: item.soundcloud_url,
          title: 'Untitled Track',
          artwork: undefined,
        }
      })

      const results = await Promise.all(metadataPromises)
      setMetadataCache(prev => {
        const updated = { ...prev }
        results.forEach(({ url, title, artwork }) => {
          updated[url] = { title, artwork }
        })
        return updated
      })
    }

    fetchMetadata()
  }, [queue, metadataCache])

  // Real-time polling
  useEffect(() => {
    fetchQueue({ silent: false, notifyParent: true })
    const interval = setInterval(() => fetchQueue({ silent: true, notifyParent: false }), 5000)
    return () => clearInterval(interval)
  }, [])

  // Process queue items with metadata; detect moved-up for animation
  const processedQueue = useMemo(() => {
    const currentIds = new Set(queue.map(item => item.id))
    const previousIds = previousQueueIdsRef.current
    const prevPos = previousPositionByIdRef.current

    const result = queue.map((item, index) => {
      const metadata = metadataCache[item.soundcloud_url]
      const displayTitle = item.song_title || metadata?.title || 'Untitled Track'
      const displayArtist = item.artist_name || item.users.display_name
      const artwork = metadata?.artwork
      const isNew = !previousIds.has(item.id)
      const position = index + 1
      const previousPosition = prevPos[item.id]
      const movedUp = previousPosition != null && position < previousPosition

      return {
        ...item,
        queueNumber: position,
        displayTitle,
        displayArtist,
        artwork,
        _isNew: isNew,
        _movedUp: movedUp,
        moves_used_this_session: item.moves_used_this_session ?? 0,
      } as QueueItemWithMetadata
    })

    previousPositionByIdRef.current = Object.fromEntries(
      queue.map((item, index) => [item.id, index + 1])
    )
    return result
  }, [queue, metadataCache])

  const canCollapse = processedQueue.length > QUEUE_COLLAPSED_THRESHOLD
  const isCollapsed = canCollapse && !queueExpanded
  const visibleItems = isCollapsed ? processedQueue.slice(0, QUEUE_COLLAPSED_VISIBLE) : processedQueue
  const hiddenCount = processedQueue.length - QUEUE_COLLAPSED_VISIBLE

  const body = (
    <>
      <div className={`flex items-center gap-2 sm:gap-3 ${embedded ? 'mb-3' : 'mb-3 sm:mb-4'}`}>
        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg border-2 border-primary/30 shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-extrabold text-text-primary tracking-tight">{t('queue.title')}</h3>
          {processedQueue.length > 0 && (
            <span className="text-xs sm:text-sm font-bold text-text-secondary bg-background-lighter px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-gray-600">
              {processedQueue.length}
            </span>
          )}
        </div>
      </div>
      <div>
        {loading && processedQueue.length === 0 ? (
          <div className="space-y-2 sm:space-y-2.5 py-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-3 rounded-xl border-2 border-gray-700/40 bg-background/25 min-h-[48px] sm:min-h-[58px] opacity-70"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-extrabold text-primary/40 tabular-nums">{n}</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-background-lighter border-2 border-gray-700/50 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 w-[70%] rounded bg-gray-700/45" />
                  <div className="h-2.5 w-[40%] rounded bg-gray-700/35" />
                </div>
              </div>
            ))}
          </div>
        ) : processedQueue.length === 0 ? (
          <div className="space-y-2 sm:space-y-2.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-3 rounded-xl border-2 border-dashed border-gray-700/45 bg-background/20 min-h-[48px] sm:min-h-[58px]"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/25 flex items-center justify-center">
                  <span className="text-xs font-extrabold text-primary/45 tabular-nums">{n}</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-background-lighter border-2 border-gray-700/45 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-muted/55 truncate">
                    {n === 1 ? t('queue.emptySlotTitle') : '—'}
                  </p>
                  <p className="text-xs text-text-muted/45 truncate mt-0.5 font-medium">
                    {n === 1 ? t('queue.empty') : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <>
            <div className="space-y-2 sm:space-y-2.5 max-h-[min(70vh,640px)] sm:max-h-[min(65vh,560px)] overflow-y-auto overflow-x-hidden scrollbar-hide pr-0.5">
              {visibleItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2.5 sm:gap-3 p-2 sm:p-3 rounded-xl border-2 min-h-[48px] sm:min-h-[58px] transition-all duration-500 relative overflow-visible ${
                    item._isNew ? 'animate-slide-in bg-primary/5 border-primary/30' : 'border-gray-700/50 hover:border-primary/40 hover:bg-background-lighter'
                  } ${
                    item._movedUp ? 'animate-queue-moved-up border-primary/40 bg-primary/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]' : ''
                  } ${currentUserId && item.user_id === currentUserId ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`}
                  style={{
                    animationDelay: item._isNew ? `${Math.min(index * 30, 200)}ms` : undefined,
                    transform: item._movedUp ? 'translateY(0)' : undefined,
                  }}
                >
                  {item._movedUp && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 animate-arrow-rise">
                      <svg className="w-4 h-4 text-primary drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5H7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                    <span className="text-xs font-extrabold text-primary tabular-nums">{item.queueNumber}</span>
                  </div>
                  {currentUserId && item.user_id === currentUserId && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-[11px] font-bold bg-primary/20 text-primary rounded-md border-2 border-primary/40">{t('queue.you')}</span>
                  )}
                  {item.moves_used_this_session > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-amber-500/20 border border-amber-500/40" title="Used XP to move up">
                      <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5H7z" />
                      </svg>
                    </span>
                  )}
                  {item.artwork ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.artwork}
                      alt={item.displayTitle}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border-2 border-gray-600"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-background-lighter border-2 border-gray-600 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate" title={item.displayTitle}>{item.displayTitle}</p>
                    <p className="text-xs text-text-secondary truncate mt-0.5 font-medium">{item.displayArtist}</p>
                  </div>
                </div>
              ))}
            </div>
            {canCollapse && (
              <button
                type="button"
                onClick={() => setQueueExpanded((e) => !e)}
                className="mt-2.5 sm:mt-3 w-full min-h-[40px] flex items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-background-lighter hover:bg-gray-700/50 border-2 border-gray-600 text-text-primary text-xs sm:text-sm font-bold transition-colors touch-manipulation"
              >
                {isCollapsed ? (
                  <>{t('queue.showMore').replace('{n}', String(hiddenCount))}</>
                ) : (
                  <>{t('queue.showLess')}</>
                )}
              </button>
            )}
            </>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className="w-full animate-fade-in">{body}</div>
  }

  return (
    <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 animate-fade-in border-2 border-gray-700/60 w-full">
      {body}
    </div>
  )
}
