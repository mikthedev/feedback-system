'use client'

import { useState, useEffect, useMemo } from 'react'

interface CarryoverItem {
  id: string
  soundcloud_url: string
  song_title?: string
  artist_name?: string
  session_number?: number
  created_at: string
  users: {
    display_name: string
  }
}

interface CarryoverItemWithMetadata extends CarryoverItem {
  carryoverNumber: number
  displayTitle: string
  displayArtist: string
  artwork?: string
}

export default function Carryover() {
  const [carryover, setCarryover] = useState<CarryoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataCache, setMetadataCache] = useState<Record<string, { title: string; artwork?: string }>>({})
  const [isExpanded, setIsExpanded] = useState(false)

  const fetchCarryover = async (silent = false) => {
    try {
      const response = await fetch('/api/submissions/carryover')
      if (response.ok) {
        const data = await response.json()
        setCarryover(data.carryover || [])
      }
    } catch (error) {
      console.error('Error fetching carryover:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    const itemsNeedingMetadata = carryover.filter(
      (item) => !item.song_title && !metadataCache[item.soundcloud_url]
    )
    if (itemsNeedingMetadata.length === 0) return

    const metadataPromises = itemsNeedingMetadata.map(async (item) => {
      try {
        const res = await fetch(`/api/soundcloud/oembed?url=${encodeURIComponent(item.soundcloud_url)}`)
        if (!res.ok) return { url: item.soundcloud_url, title: 'Untitled Track', artwork: undefined }
        const data = await res.json()
        let title = data.title || 'Untitled Track'
        if (title.includes(' - ')) {
          const parts = title.split(' - ')
          title = parts[parts.length - 1].trim()
        }
        return {
          url: item.soundcloud_url,
          title,
          artwork: data.thumbnail_url || undefined,
        }
      } catch {
        return { url: item.soundcloud_url, title: 'Untitled Track', artwork: undefined }
      }
    })

    Promise.all(metadataPromises).then((results) => {
      setMetadataCache((prev) => {
        const next = { ...prev }
        results.forEach(({ url, title, artwork }) => {
          next[url] = { title, artwork }
        })
        return next
      })
    })
  }, [carryover, metadataCache])

  useEffect(() => {
    fetchCarryover()
    const interval = setInterval(() => fetchCarryover(true), 5000)
    return () => clearInterval(interval)
  }, [])

  const processed = useMemo(() => {
    return carryover.map((item, index) => {
      const meta = metadataCache[item.soundcloud_url]
      return {
        ...item,
        carryoverNumber: index + 1,
        displayTitle: item.song_title || meta?.title || 'Untitled Track',
        displayArtist: item.artist_name || item.users?.display_name || '—',
        artwork: meta?.artwork,
      } as CarryoverItemWithMetadata
    })
  }, [carryover, metadataCache])

  if (loading && carryover.length === 0 && !isExpanded) {
    return null
  }

  return (
    <div className="bg-background-light rounded-lg shadow-md p-3 animate-fade-in border border-gray-800/50 max-w-md w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">Carryover</h3>
          {processed.length > 0 && (
            <span className="text-xs text-text-secondary bg-background-lighter px-2 py-0.5 rounded-full">
              {processed.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-secondary hover:text-text-primary transition-colors duration-200 p-1 hover:bg-background-lighter rounded"
          aria-label={isExpanded ? 'Collapse carryover' : 'Expand carryover'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2">
          {loading && processed.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">Loading...</p>
          ) : processed.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">No carryover</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto overflow-x-hidden scrollbar-hide">
              {processed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-gray-800/50 hover:border-amber-500/30 hover:bg-background-lighter transition-all duration-200 bg-amber-500/5 border-amber-500/20"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-amber-400">{item.carryoverNumber}</span>
                  </div>
                  {item.artwork ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.artwork}
                      alt={item.displayTitle}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-background-lighter border border-gray-800/50 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{item.displayTitle}</p>
                    <p className="text-[10px] text-text-secondary truncate mt-0.5">
                      {item.displayArtist}
                      {item.session_number != null && (
                        <span className="ml-1">· Session #{item.session_number}</span>
                      )}
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
