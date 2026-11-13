'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'

type LiveStream = {
  id: string
  title: string
  viewer_count: number
  started_at: string
  thumbnail_url: string
  game_name: string
}

type FeedbackVod = {
  id: string
  title: string
  url: string
  thumbnail_url: string
  duration: string
  view_count: number
  published_at: string
}

type TwitchHomePayload = {
  channel: string
  live: LiveStream | null
  vods: FeedbackVod[]
}

const PLACEHOLDER_COUNT = 3

let sharedPayload: TwitchHomePayload | null = null
let sharedPromise: Promise<TwitchHomePayload> | null = null
const sharedListeners = new Set<() => void>()

async function loadTwitchHome(force = false): Promise<TwitchHomePayload> {
  if (!force && sharedPayload) return sharedPayload
  if (sharedPromise) return sharedPromise

  sharedPromise = (async () => {
    try {
      const res = await fetch('/api/twitch/home', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const json = (await res.json()) as TwitchHomePayload
      sharedPayload = json
      return json
    } catch {
      const fallback: TwitchHomePayload = { channel: 'mikegtc', live: null, vods: [] }
      sharedPayload = fallback
      return fallback
    } finally {
      sharedPromise = null
      sharedListeners.forEach((l) => l())
    }
  })()

  return sharedPromise
}

function formatDuration(duration: string): string {
  const match = duration.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i)
  if (!match) return duration
  const h = match[1] ? `${match[1]}:` : ''
  const m = match[2] ? String(match[2]).padStart(h ? 2 : 1, '0') : h ? '00' : '0'
  const s = match[3] ? String(match[3]).padStart(2, '0') : '00'
  return `${h}${m}:${s}`
}

function formatPublished(iso: string, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : locale === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function TwitchIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714V11.143z" />
    </svg>
  )
}

function TwitchPlayer({
  channel,
  videoId,
  title,
}: {
  channel?: string
  videoId?: string
  title: string
}) {
  const [parent, setParent] = useState('localhost')

  useEffect(() => {
    setParent(window.location.hostname || 'localhost')
  }, [])

  const src = useMemo(() => {
    const params = new URLSearchParams({
      parent,
      autoplay: 'false',
      muted: 'false',
    })
    if (videoId) {
      params.set('video', videoId.startsWith('v') ? videoId : `v${videoId}`)
    } else if (channel) {
      params.set('channel', channel)
    }
    return `https://player.twitch.tv/?${params.toString()}`
  }, [channel, videoId, parent])

  return (
    <div className="relative w-full overflow-hidden rounded-lg sm:rounded-xl border border-gray-700/50 bg-black aspect-video">
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allowFullScreen
        allow="autoplay; fullscreen"
        loading="lazy"
      />
    </div>
  )
}

function VodPlaceholder({ index }: { index: number }) {
  const { t } = useLanguage()
  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-gray-700/50 bg-background-lighter animate-fade-in"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="relative aspect-video flex flex-col items-center justify-center gap-2.5 px-4 text-center bg-background">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-600/60 bg-background-lighter text-text-muted">
          <svg className="h-4 w-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <p className="text-xs font-extrabold text-text-secondary tracking-tight">
          {t('home.vodPlaceholderTitle')}
        </p>
      </div>
      <div className="space-y-2 border-t border-gray-700/40 px-3 py-2.5">
        <div className="h-2.5 w-[78%] rounded bg-gray-700/45" />
        <div className="h-2 w-[42%] rounded bg-gray-700/30" />
      </div>
    </div>
  )
}

export default function HomeStreamSection() {
  const { t, locale } = useLanguage()
  const [data, setData] = useState<TwitchHomePayload | null>(sharedPayload)
  const [loading, setLoading] = useState(!sharedPayload)
  const [activeVodId, setActiveVodId] = useState<string | null>(sharedPayload?.vods[0]?.id ?? null)
  // Session-only — resets on page reload
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const apply = (json: TwitchHomePayload) => {
      if (cancelled) return
      setData(json)
      setActiveVodId((prev) => {
        if (prev && json.vods.some((v) => v.id === prev)) return prev
        return json.vods[0]?.id ?? null
      })
      setLoading(false)
    }

    const onShared = () => {
      if (sharedPayload) apply(sharedPayload)
    }
    sharedListeners.add(onShared)

    const load = async (force = false) => {
      const json = await loadTwitchHome(force)
      apply(json)
    }

    load(false)
    timer = setInterval(() => load(true), 60_000)
    return () => {
      cancelled = true
      sharedListeners.delete(onShared)
      if (timer) clearInterval(timer)
    }
  }, [])

  const channel = data?.channel ?? 'mikegtc'
  const live = data?.live ?? null
  const vods = data?.vods ?? []
  const activeVod = vods.find((v) => v.id === activeVodId) ?? vods[0] ?? null
  const isLive = !!live

  if (hidden) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setHidden(false)}
          className={`w-full flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border-2 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all duration-200 touch-manipulation active:scale-[0.99] ${
            isLive
              ? 'border-primary/35 bg-background-light hover:border-primary/50'
              : 'border-gray-700/60 bg-background-light hover:border-primary/35'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 border border-red-500/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-400 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-55" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
                </span>
                {t('home.liveNow')}
              </span>
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/10 text-primary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-text-primary truncate">
                {isLive
                  ? live?.title || t('home.liveFallbackTitle')
                  : t('home.vodsTitle')}
              </span>
              <span className="block text-[11px] text-text-muted font-medium">
                {t('home.showPanel')}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-primary px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
            {t('common.showMore')}
          </span>
        </button>
      </div>
    )
  }

  return (
    <section
      className={`w-full overflow-hidden rounded-xl sm:rounded-2xl border-2 bg-background-light p-3 sm:p-5 shadow-lg animate-fade-in ${
        isLive ? 'border-primary/35' : 'border-gray-700/60'
      }`}
    >
      <div className="mb-3 sm:mb-4 flex items-center gap-2.5 sm:gap-3">
        <div
          className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${
            isLive
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-primary/30 bg-primary/10 text-primary'
          }`}
        >
          {isLive ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-55" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
            </span>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isLive ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 border border-red-500/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-400">
                  <span className="relative flex h-1.5 w-1.5 sm:hidden">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-55" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
                  </span>
                  {t('home.liveNow')}
                </span>
                {live && live.viewer_count > 0 && (
                  <span className="text-[11px] font-semibold text-text-muted">
                    {t('home.viewers').replace('{n}', String(live.viewer_count))}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-text-primary leading-tight tracking-tight line-clamp-2">
                {live?.title || t('home.liveFallbackTitle')}
              </h2>
            </div>
          ) : (
            <h2 className="text-base sm:text-lg font-extrabold text-text-primary leading-tight tracking-tight">
              {t('home.vodsTitle')}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLive && (
            <a
              href={`https://www.twitch.tv/${channel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-primary transition-colors hover:bg-primary/20 touch-manipulation"
            >
              <TwitchIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">{t('home.watchOnTwitch')}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="inline-flex items-center justify-center min-h-[36px] rounded-lg border border-gray-600/50 bg-background-lighter px-2.5 py-1.5 text-xs font-bold text-text-secondary hover:border-primary/40 hover:text-primary hover:bg-primary/10 transition-colors touch-manipulation"
            aria-label={t('common.hide')}
            title={t('common.hide')}
          >
            {t('common.hide')}
          </button>
        </div>
      </div>

      {isLive && live ? (
        <TwitchPlayer channel={channel} title={live.title || t('home.liveFallbackTitle')} />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border-2 border-gray-700/50 bg-background-lighter animate-pulse"
            >
              <div className="aspect-video bg-background" />
              <div className="space-y-2 border-t border-gray-700/40 p-3">
                <div className="h-2.5 w-3/4 rounded bg-gray-700/40" />
                <div className="h-2 w-1/2 rounded bg-gray-700/25" />
              </div>
            </div>
          ))}
        </div>
      ) : vods.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-text-muted px-0.5">{t('home.vodsEmpty')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
              <VodPlaceholder key={i} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {activeVod && (
            <div className="space-y-2.5">
              <TwitchPlayer videoId={activeVod.id} title={activeVod.title} />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-700/40 bg-background/50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
                    {t('home.nowPlaying')}
                  </p>
                  <h3 className="text-sm font-bold text-text-primary leading-snug line-clamp-2">
                    {activeVod.title}
                  </h3>
                </div>
                <a
                  href={activeVod.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 touch-manipulation"
                >
                  <TwitchIcon className="h-3 w-3" />
                  {t('home.openOnTwitch')}
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {vods.map((vod, index) => {
              const selected = vod.id === activeVod?.id
              return (
                <button
                  key={vod.id}
                  type="button"
                  onClick={() => setActiveVodId(vod.id)}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`group text-left overflow-hidden rounded-xl border-2 transition-all duration-200 touch-manipulation animate-fade-in active:scale-[0.99] ${
                    selected
                      ? 'border-primary/55 bg-primary/10'
                      : 'border-gray-700/45 bg-background-lighter hover:border-primary/35 hover:bg-primary/[0.06]'
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden bg-background">
                    {vod.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vod.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 ease-framer group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="h-full w-full bg-background-lighter" />
                    )}
                    <div
                      className="pointer-events-none absolute inset-0 bg-black/20 opacity-80 transition-opacity group-hover:opacity-95"
                      aria-hidden
                    />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white">
                        <svg className="h-4 w-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums border border-white/10">
                      {formatDuration(vod.duration)}
                    </span>
                    {selected && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-background">
                        {t('home.nowPlaying')}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 px-2.5 py-2.5">
                    <p className="text-xs font-bold text-text-primary line-clamp-2 leading-snug">
                      {vod.title}
                    </p>
                    <p className="text-[10px] text-text-muted font-medium">
                      {formatPublished(vod.published_at, locale)}
                      {vod.view_count > 0
                        ? ` · ${t('home.views').replace('{n}', String(vod.view_count))}`
                        : ''}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
