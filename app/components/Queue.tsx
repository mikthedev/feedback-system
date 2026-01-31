'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

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
}

interface QueueItemWithMetadata extends QueueItem {
  queueNumber: number
  displayTitle: string
  displayArtist: string
  artwork?: string
  _isNew?: boolean
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
}

export default function Queue({ currentUserId, refetchTrigger, onQueueLoaded }: QueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataCache, setMetadataCache] = useState<Record<string, { title: string; artwork?: string }>>({})
  const previousQueueIdsRef = useRef<Set<string>>(new Set())

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

  // Process queue items with metadata
  const processedQueue = useMemo(() => {
    const currentIds = new Set(queue.map(item => item.id))
    const previousIds = previousQueueIdsRef.current
    
    return queue.map((item, index) => {
      const metadata = metadataCache[item.soundcloud_url]
      const displayTitle = item.song_title || metadata?.title || 'Untitled Track'
      const displayArtist = item.artist_name || item.users.display_name
      const artwork = metadata?.artwork
      const isNew = !previousIds.has(item.id)

      return {
        ...item,
        queueNumber: index + 1,
        displayTitle,
        displayArtist,
        artwork,
        _isNew: isNew,
      } as QueueItemWithMetadata
    })
  }, [queue, metadataCache])

  return (
    <div className="bg-background-light rounded-xl shadow-md p-3 sm:p-3 animate-fade-in border border-gray-800/50 max-w-md w-full min-w-0 sm:rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-text-primary sm:text-sm">Queue</h3>
          {processedQueue.length > 0 && (
            <span className="text-sm text-text-secondary bg-background-lighter px-2.5 py-1 rounded-full sm:text-xs sm:px-2 sm:py-0.5">
              {processedQueue.length}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2">
        {loading && processedQueue.length === 0 ? (
          <p className="text-sm text-text-secondary py-3 sm:text-xs sm:py-2">Loading...</p>
        ) : processedQueue.length === 0 ? (
          <p className="text-sm text-text-secondary py-3 sm:text-xs sm:py-2">No tracks in queue.</p>
        ) : (
            <div className="space-y-2 max-h-[220px] sm:max-h-[280px] overflow-y-auto overflow-x-hidden scrollbar-hide sm:space-y-1.5">
              {processedQueue.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-gray-800/50 hover:border-primary/30 hover:bg-background-lighter transition-all duration-200 min-h-[52px] sm:rounded-lg sm:p-2 sm:gap-2 sm:min-h-[44px] ${
                    item._isNew ? 'animate-slide-in bg-primary/5 border-primary/30' : ''
                  } ${currentUserId && item.user_id === currentUserId ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`}
                  style={{ animationDelay: item._isNew ? `${Math.min(index * 30, 200)}ms` : '0ms' }}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center sm:w-6 sm:h-6">
                    <span className="text-xs font-bold text-primary sm:text-[10px]">{item.queueNumber}</span>
                  </div>
                  {currentUserId && item.user_id === currentUserId && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded border border-primary/30 sm:px-1.5 sm:text-[10px]">You</span>
                  )}
                  {item.artwork ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.artwork}
                      alt={item.displayTitle}
                      className="w-10 h-10 rounded object-cover flex-shrink-0 sm:w-10 sm:h-10"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-background-lighter border border-gray-800/50 flex-shrink-0 flex items-center justify-center sm:w-10 sm:h-10">
                      <svg className="w-5 h-5 text-text-muted sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate sm:text-xs">{item.displayTitle}</p>
                    <p className="text-xs text-text-secondary truncate mt-0.5 sm:text-[10px]">{item.displayArtist}</p>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  )
}
