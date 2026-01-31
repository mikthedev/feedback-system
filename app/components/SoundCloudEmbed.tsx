'use client'

import { memo } from 'react'

export interface SoundCloudEmbedProps {
  /** Stable id (e.g. submission.id) so React never remounts the embed on scroll */
  id: string
  /** oEmbed HTML from SoundCloud; if set, we render this instead of iframe */
  embedHtml?: string | null
  /** If true, show fallback message + iframe */
  embedError?: boolean
  /** SoundCloud track URL for fallback iframe and "Open in SoundCloud" link */
  soundcloudUrl: string
  /** Pre-computed embed URL (useMemo in parent) so reference is stable and embed never reloads */
  embedUrl: string
}

/**
 * Memoized SoundCloud embed. Only re-renders when id, embedHtml, embedError, soundcloudUrl, or embedUrl change.
 * Parent scroll state (e.g. bannerState) will not cause re-renders, so iframes won't refresh while scrolling.
 */
const SoundCloudEmbed = memo(function SoundCloudEmbed({
  id,
  embedHtml,
  embedError,
  soundcloudUrl,
  embedUrl,
}: SoundCloudEmbedProps) {
  return (
    <div
      className="soundcloud-embed w-full"
      data-soundcloud-id={id}
      style={{
        maxWidth: '100%',
        overflow: 'hidden',
        contain: 'layout style paint',
      }}
    >
      {embedHtml ? (
        <div
          key={`html-${id}`}
          className="soundcloud-embed-inner"
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        />
      ) : embedError ? (
        <div className="p-3 bg-background-lighter rounded-lg border border-gray-800/50">
          <p className="text-sm text-text-secondary mb-2">
            Unable to embed this track.{' '}
            <a
              href={soundcloudUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline underline-offset-2"
            >
              Open in SoundCloud
            </a>
          </p>
          <iframe
            key={`iframe-${id}`}
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
      ) : (
        <iframe
          key={`iframe-${id}`}
          width="100%"
          height="166"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={embedUrl}
          className="rounded"
          title="SoundCloud Player"
        />
      )}
    </div>
  )
})

export default SoundCloudEmbed
