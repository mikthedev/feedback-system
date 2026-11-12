'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'
import { TotmMedalIcon } from './TotmLeaderboardIcon'
import TotmBadgeExplainModal from './TotmBadgeExplainModal'
import TotmBadgeConfetti from './TotmBadgeConfetti'

type Skip = {
  id: string
  status: 'available' | 'activated' | 'consumed' | string
  earned_year: number
  earned_month: number
  label: string
}

type HistoryEntry = {
  year: number
  month: number
  label: string
  rank: number
  song_title: string | null
}

type InTotm = {
  year: number
  month: number
  label: string
  rank: number
  song_title: string | null
  artist_name: string | null
}

type FeaturedArtist = {
  awarded_at: string
  show_on_profile?: boolean
}

type TotmMe = {
  in_totm: InTotm | null
  featured_artist: FeaturedArtist | null
  skips: Skip[]
  available_skips: Skip[]
  history: HistoryEntry[]
}

type PublicEntry = {
  rank: number
  artist_name: string | null
  song_title: string | null
  genre: string | null
  audience_score: number | null
}

type TotmDashboardPanelProps = {
  refreshKey?: number
  onMembershipChange?: (inTotm: boolean) => void
  onAvailableSkipsChange?: (count: number) => void
  /** Lighter chrome when nested inside another card. */
  embedded?: boolean
}

function hasSeenConfetti(key: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

function markConfettiSeen(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

/** One celebration per live month placement, and one per curator Featured grant. */
function totmConfettiKey(opts: {
  inTotm: InTotm | null
  featured: FeaturedArtist | null
}): string | null {
  if (opts.inTotm) {
    return `dfs_totm_confetti:live:${opts.inTotm.year}-${opts.inTotm.month}`
  }
  if (opts.featured?.show_on_profile) {
    const id = opts.featured.awarded_at || 'granted'
    return `dfs_totm_confetti:featured:${id}`
  }
  return null
}

export default function TotmDashboardPanel({
  refreshKey = 0,
  onMembershipChange,
  onAvailableSkipsChange,
  embedded = false,
}: TotmDashboardPanelProps) {
  const { t } = useLanguage()
  const [data, setData] = useState<TotmMe | null>(null)
  const [preview, setPreview] = useState<PublicEntry[]>([])
  const [previewLabel, setPreviewLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [explainOpen, setExplainOpen] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const [confettiOrigin, setConfettiOrigin] = useState<DOMRect | null>(null)
  const medalRef = useRef<HTMLButtonElement>(null)
  const lastConfettiKeyRef = useRef<string | null>(null)

  const fetchPublicPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/totm', { cache: 'no-store' })
      if (!res.ok) {
        setPreview([])
        setPreviewLabel(null)
        return
      }
      const json = await res.json()
      const entries = (json.current?.entries ?? []) as PublicEntry[]
      setPreview(entries.slice(0, 10))
      setPreviewLabel(json.current?.label ?? null)
    } catch {
      setPreview([])
      setPreviewLabel(null)
    }
  }, [])

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/totm/me', { credentials: 'include' })
      if (!res.ok) {
        setData(null)
        onMembershipChange?.(false)
        onAvailableSkipsChange?.(0)
        return
      }
      const json = (await res.json()) as TotmMe
      setData(json)
      const hasProfileBadge =
        !!json.in_totm || !!(json.featured_artist?.show_on_profile)
      onMembershipChange?.(hasProfileBadge)
      onAvailableSkipsChange?.(json.available_skips?.length ?? 0)
    } catch {
      setData(null)
      onMembershipChange?.(false)
      onAvailableSkipsChange?.(0)
    } finally {
      setLoading(false)
    }
  }, [onMembershipChange, onAvailableSkipsChange])

  useEffect(() => {
    setLoading(true)
    void fetchMe()
    void fetchPublicPreview()
  }, [fetchMe, fetchPublicPreview, refreshKey])

  const inTotm = data?.in_totm ?? null
  const featured = data?.featured_artist ?? null
  const showBadge = !!(inTotm || featured?.show_on_profile)
  const confettiKey = totmConfettiKey({ inTotm, featured })

  useEffect(() => {
    if (!showBadge || loading || !confettiKey) return
    if (hasSeenConfetti(confettiKey)) return
    if (lastConfettiKeyRef.current === confettiKey) return

    let cancelled = false
    let attempts = 0

    const tryBurst = () => {
      if (cancelled) return
      const el = medalRef.current
      if (!el) {
        if (attempts++ < 8) {
          window.requestAnimationFrame(tryBurst)
        }
        return
      }
      lastConfettiKeyRef.current = confettiKey
      markConfettiSeen(confettiKey)
      setConfettiOrigin(el.getBoundingClientRect())
      setConfettiActive(true)
    }

    const frame = window.requestAnimationFrame(tryBurst)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [showBadge, loading, confettiKey])

  if (loading) {
    return (
      <div className={embedded ? 'px-0 py-1' : 'rounded-lg border border-gray-700/50 bg-background-light/80 px-3 py-2'}>
        <p className="text-[11px] text-text-muted font-medium">{t('common.loading')}</p>
      </div>
    )
  }

  if (!showBadge && preview.length === 0) return null

  const songMeta = inTotm
    ? [inTotm.song_title?.trim() || t('totm.untitled'), inTotm.label].join(' · ')
    : null

  return (
    <section
      className={
        embedded
          ? 'space-y-2 animate-fade-in'
          : 'rounded-lg sm:rounded-xl border border-gray-700/50 bg-background-light/90 p-2 sm:p-2.5 space-y-2 animate-fade-in'
      }
    >
      {showBadge && (
        <div
          className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5"
          role="status"
          aria-label={t('totm.inTotmBadge')}
        >
          <button
            ref={medalRef}
            type="button"
            onClick={() => setExplainOpen(true)}
            title={t('totm.explainOpenHint')}
            aria-label={t('totm.explainOpenHint')}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-background-light text-primary transition-transform duration-150 hover:scale-110 hover:border-primary/60 hover:bg-primary/15 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <TotmMedalIcon className="h-5 w-5" />
            {inTotm && (
              <span className="absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded border border-primary/40 bg-background-light px-1 text-[9px] font-black text-primary tabular-nums leading-none pointer-events-none">
                #{inTotm.rank}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setExplainOpen(true)}
            className="min-w-0 flex-1 text-left touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <p className="text-[12px] sm:text-[13px] font-extrabold tracking-tight text-text-primary leading-snug">
              {t('totm.inTotmBadge')}
            </p>
            <p className="mt-0.5 text-[11px] text-text-secondary font-medium leading-snug">
              {inTotm ? t('totm.inTotmBrief') : t('totm.featuredProfileBrief')}
            </p>
            {songMeta && (
              <p className="mt-1 text-[11px] font-semibold text-text-muted truncate leading-tight">
                {songMeta}
              </p>
            )}
          </button>
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-md border border-primary/20 bg-background/40 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-gray-700/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary truncate">
              {previewLabel || t('totm.thisMonth')}
            </p>
            <Link href="/totm" className="text-[10px] font-bold text-primary hover:underline shrink-0">
              {t('totm.viewPublic')}
            </Link>
          </div>
          <ul className="max-h-[220px] overflow-y-auto divide-y divide-gray-700/30">
            {preview.map((e) => (
              <li key={e.rank} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="w-5 h-5 shrink-0 rounded bg-primary/15 border border-primary/30 text-primary text-[10px] font-black flex items-center justify-center tabular-nums">
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-text-primary truncate leading-tight">
                    {e.song_title || t('totm.untitled')}
                  </p>
                  <p className="text-[10px] text-text-muted font-medium truncate leading-tight">
                    {e.artist_name || t('totm.unknownArtist')}
                    {e.genre ? ` · ${e.genre}` : ''}
                  </p>
                </div>
                {e.audience_score != null && (
                  <span className="shrink-0 text-[10px] font-bold text-text-secondary tabular-nums">
                    {Number(e.audience_score).toFixed(1)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TotmBadgeExplainModal
        isOpen={explainOpen}
        onClose={() => setExplainOpen(false)}
        rank={inTotm?.rank ?? null}
        songTitle={inTotm?.song_title ?? null}
        monthLabel={inTotm?.label ?? null}
      />

      <TotmBadgeConfetti
        active={confettiActive}
        origin={confettiOrigin}
        onDone={() => setConfettiActive(false)}
      />
    </section>
  )
}
