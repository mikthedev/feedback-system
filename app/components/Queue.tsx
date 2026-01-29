'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

interface QueueItem {
  id: string
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

export default function Queue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataCache, setMetadataCache] = useState<Record<string, { title: string; artwork?: string }>>({})
  const [isExpanded, setIsExpanded] = useState(false)
  const previousQueueIdsRef = useRef<Set<string>>(new Set())

  const fetchQueue = async (silent = false) => {
    try {
      const response = await fetch('/api/submissions/queue')
      if (response.ok) {
        const data = await response.json()
        const newQueue = data.queue || []
        
        // Detect new items for animation
        const currentIds = new Set(newQueue.map((item: QueueItem) => item.id))
        const previousIds = previousQueueIdsRef.current
        const newIds = Array.from(currentIds).filter(id => !previousIds.has(id))
        
        setQueue(newQueue)
        previousQueueIdsRef.current = currentIds
        
        if (!silent) {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('Error fetching queue:', error)
      if (!silent) {
        setLoading(false)
      }
    }
  }

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
    fetchQueue()
    const interval = setInterval(() => fetchQueue(true), 5000) // Poll every 5 seconds
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

  if (loading && queue.length === 0 && !isExpanded) {
    return null // Don't show anything while loading if collapsed
  }

  return (
    <div className="bg-background-light rounded-lg shadow-md p-3 animate-fade-in border border-gray-800/50 max-w-md">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">Queue</h3>
          {processedQueue.length > 0 && (
            <span className="text-xs text-text-secondary bg-background-lighter px-2 py-0.5 rounded-full">
              {processedQueue.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-secondary hover:text-text-primary transition-colors duration-200 p-1 hover:bg-background-lighter rounded"
          aria-label={isExpanded ? 'Collapse queue' : 'Expand queue'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
        </button>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-2">
          {loading && processedQueue.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">Loading...</p>
          ) : processedQueue.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">No tracks in queue</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto overflow-x-hidden scrollbar-hide">
              {processedQueue.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border border-gray-800/50 hover:border-primary/30 hover:bg-background-lighter transition-all duration-200 ${
                    item._isNew ? 'animate-slide-in bg-primary/5 border-primary/30' : ''
                  }`}
                  style={{
                    animationDelay: item._isNew ? `${Math.min(index * 30, 200)}ms` : '0ms'
                  }}
                >
                  {/* Queue Number */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{item.queueNumber}</span>
                  </div>

                  {/* Artwork */}
                  {item.artwork ? (
                    <img
                      src={item.artwork}
                      alt={item.displayTitle}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-background-lighter border border-gray-800/50 flex-shrink-0 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {item.displayTitle}
                    </p>
                    <p className="text-[10px] text-text-secondary truncate mt-0.5">
                      {item.displayArtist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
