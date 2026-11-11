'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'
import TotmLeaderboardIcon from './TotmLeaderboardIcon'

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

type FeaturedArtist = {
  awarded_at: string
  year: number | null
  month: number | null
  label: string | null
  rank: number | null
  song_title: string | null
}

type TotmMe = {
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

const FEATURED_HIDDEN_KEY = 'dfs_hide_featured_artist'

function isInTotm(data: TotmMe | null): boolean {
  if (!data) return false
  return !!(data.featured_artist || data.skips.length > 0 || data.history.length > 0)
}

function loadFeaturedHidden(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FEATURED_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
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
  const [featuredHidden, setFeaturedHidden] = useState(false)

  useEffect(() => {
    setFeaturedHidden(loadFeaturedHidden())
  }, [])

  const setFeaturedHiddenPersist = (hidden: boolean) => {
    setFeaturedHidden(hidden)
    try {
      if (hidden) localStorage.setItem(FEATURED_HIDDEN_KEY, '1')
      else localStorage.removeItem(FEATURED_HIDDEN_KEY)
    } catch {
      /* ignore */
    }
  }

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
      onMembershipChange?.(isInTotm(json))
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

  const featured = data?.featured_artist ?? null
  const showFeatured = !!featured && !featuredHidden
  const showFeaturedRestore = !!featured && featuredHidden

  if (loading) {
    return (
      <div className={embedded ? 'px-0 py-1' : 'rounded-lg border border-gray-700/50 bg-background-light/80 px-3 py-2'}>
        <p className="text-[11px] text-text-muted font-medium">{t('common.loading')}</p>
      </div>
    )
  }

  if (!showFeatured && !showFeaturedRestore && preview.length === 0) return null

  const featuredMetaParts: string[] = []
  if (featured?.rank != null) featuredMetaParts.push(`#${featured.rank}`)
  if (featured?.label) featuredMetaParts.push(featured.label)
  if (featured?.song_title) featuredMetaParts.push(featured.song_title)

  return (
    <section
      className={
        embedded
          ? 'space-y-2 animate-fade-in'
          : 'rounded-lg sm:rounded-xl border border-gray-700/50 bg-background-light/90 p-2 sm:p-2.5 space-y-2 animate-fade-in'
      }
    >
      {showFeatured && featured && (
        <div className="flex items-start gap-2 rounded-md bg-primary/[0.07] border border-primary/25 px-2.5 py-1.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <TotmLeaderboardIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold text-primary leading-tight">
              {t('totm.featuredBadge')}
            </p>
            <p className="text-[10px] text-text-muted font-medium leading-tight">
              {t('totm.featuredBrief')}
            </p>
            {featuredMetaParts.length > 0 && (
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-text-secondary leading-tight truncate">
                {featuredMetaParts.join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFeaturedHiddenPersist(true)}
            title={t('totm.hideFeatured')}
            aria-label={t('totm.hideFeatured')}
            className="shrink-0 mt-0.5 min-h-[28px] min-w-[28px] px-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background/50 text-[10px] font-bold touch-manipulation"
          >
            {t('totm.hide')}
          </button>
        </div>
      )}

      {showFeaturedRestore && (
        <button
          type="button"
          onClick={() => setFeaturedHiddenPersist(false)}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-700/40 bg-background/30 px-2.5 py-1.5 text-left touch-manipulation hover:border-primary/30 hover:bg-primary/[0.05] transition-colors"
        >
          <span className="text-[10px] font-bold text-text-muted truncate">
            {t('totm.featuredBadge')}
            {featured?.rank != null || featured?.label
              ? ` · ${[featured?.rank != null ? `#${featured.rank}` : null, featured?.label]
                  .filter(Boolean)
                  .join(' · ')}`
              : ''}
          </span>
          <span className="shrink-0 text-[10px] font-bold text-primary">{t('totm.showFeatured')}</span>
        </button>
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
    </section>
  )
}
