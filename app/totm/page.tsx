'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'
import TotmLeaderboardIcon from '../components/TotmLeaderboardIcon'

type TotmEntry = {
  rank: number
  artist_name: string | null
  song_title: string | null
  genre: string | null
  audience_score: number | null
  soundcloud_url: string
  soundcloud_unavailable: boolean
  removed_from_active: boolean
}

type TotmMonth = {
  year: number
  month: number
  status: string
  review_count: number
  label: string
  entries: TotmEntry[]
}

type TotmPayload = {
  current: TotmMonth | null
  history: TotmMonth[]
  min_reviews: number
  min_score: number
}

function monthKey(m: Pick<TotmMonth, 'year' | 'month'>) {
  return `${m.year}-${m.month}`
}

function shortMonthLabel(year: number, month: number, locale = 'en') {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toLocaleString(locale, { month: 'short', timeZone: 'UTC' })
}

function groupHistoryByYear(history: TotmMonth[]): Array<{ year: number; months: TotmMonth[] }> {
  const map = new Map<number, TotmMonth[]>()
  for (const m of history) {
    const list = map.get(m.year) ?? []
    list.push(m)
    map.set(m.year, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: [...months].sort((a, b) => b.month - a.month),
    }))
}

export default function TotmPage() {
  const { t, locale } = useLanguage()
  const [data, setData] = useState<TotmPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/totm', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load')
        const json = (await res.json()) as TotmPayload
        if (!cancelled) {
          setData(json)
          if (json.history[0]) {
            setSelectedHistory(monthKey(json.history[0]))
          }
        }
      } catch {
        if (!cancelled) setError(t('totm.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const historyByYear = useMemo(
    () => (data?.history?.length ? groupHistoryByYear(data.history) : []),
    [data?.history]
  )

  const selectedMonth =
    data?.history.find((h) => monthKey(h) === selectedHistory) ?? data?.history[0] ?? null

  return (
    <div className="min-h-screen bg-background px-2.5 sm:px-4 py-4 sm:py-6 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2 sm:gap-3">
              <TotmLeaderboardIcon className="h-5 w-5 sm:h-7 sm:w-7 text-primary shrink-0" />
              {t('totm.title')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary font-medium">{t('totm.subtitle')}</p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 min-h-[40px] px-3 py-2 rounded-xl border-2 border-gray-600/50 bg-background-lighter text-text-primary text-xs sm:text-sm font-bold hover:border-primary/40 hover:bg-primary/10 transition-all"
          >
            {t('common.dashboard')}
          </Link>
        </div>

        {loading && (
          <div className="rounded-xl border-2 border-gray-700/60 bg-background-light p-6 text-text-secondary font-medium">
            {t('common.loading')}
          </div>
        )}
        {error && (
          <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 p-4 text-red-400 text-sm font-bold">
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="rounded-xl border-2 border-primary/30 bg-background-light p-3 sm:p-5 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">
                    {t('totm.thisMonth')}
                  </p>
                  <h2 className="text-lg sm:text-xl font-extrabold text-text-primary">
                    {data.current?.label ?? t('totm.collecting')}
                  </h2>
                </div>
                {data.current && (
                  <span className="text-xs sm:text-sm font-bold text-text-secondary tabular-nums">
                    {data.current.status === 'collecting'
                      ? t('totm.progress')
                          .replace('{n}', String(data.current.review_count))
                          .replace('{min}', String(data.min_reviews))
                      : t('totm.activeBadge')}
                  </span>
                )}
              </div>

              {(!data.current || data.current.status === 'collecting') && (
                <p className="text-sm text-text-secondary font-medium leading-relaxed">
                  {t('totm.thresholdHint')
                    .replace('{min}', String(data.min_reviews))
                    .replace('{score}', String(data.min_score))}
                </p>
              )}

              {data.current?.status === 'active' && data.current.entries.length === 0 && (
                <p className="text-sm text-text-secondary font-medium">{t('totm.noVisibleTracks')}</p>
              )}

              {data.current?.status === 'active' && data.current.entries.length > 0 && (
                <TotmTrackList entries={data.current.entries} t={t} />
              )}
            </section>

            {historyByYear.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <div className="px-0.5">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-text-muted">
                    {t('totm.history')}
                  </p>
                  <h2 className="text-base sm:text-lg font-extrabold text-text-primary">
                    {t('totm.previousMonths')}
                  </h2>
                </div>

                {historyByYear.map(({ year, months }) => {
                  const selectedInThisYear = selectedMonth?.year === year ? selectedMonth : null

                  return (
                    <section
                      key={year}
                      className="rounded-xl border border-gray-700/50 bg-background-light/90 p-2.5 sm:p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-text-primary tabular-nums">
                          {year}
                        </h3>
                        <span className="text-[10px] font-bold text-text-muted">
                          {months.length}{' '}
                          {months.length === 1 ? t('totm.monthSingular') : t('totm.monthPlural')}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {months.map((h) => {
                          const key = monthKey(h)
                          const active = selectedInThisYear
                            ? monthKey(selectedInThisYear) === key
                            : false
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedHistory(key)}
                              className={`min-h-[30px] px-2 py-1 rounded-md text-[11px] sm:text-xs font-bold border transition-all touch-manipulation ${
                                active
                                  ? 'bg-primary/15 border-primary/45 text-primary'
                                  : 'bg-background-lighter border-gray-700/50 text-text-secondary hover:border-primary/25'
                              }`}
                            >
                              {shortMonthLabel(h.year, h.month, locale)}
                            </button>
                          )
                        })}
                      </div>

                      {selectedInThisYear &&
                        (selectedInThisYear.entries.length === 0 ? (
                          <p className="text-xs text-text-secondary font-medium px-0.5 py-1">
                            {t('totm.noSelectionThatMonth')}
                          </p>
                        ) : (
                          <TotmTrackList
                            entries={selectedInThisYear.entries}
                            t={t}
                            historical
                            compact
                          />
                        ))}
                    </section>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TotmTrackList({
  entries,
  t,
  historical = false,
  compact = false,
}: {
  entries: TotmEntry[]
  t: (key: string) => string
  historical?: boolean
  compact?: boolean
}) {
  if (compact) {
    return (
      <ul className="rounded-lg border border-gray-700/40 overflow-hidden divide-y divide-gray-700/30">
        {entries.map((e) => {
          const isSim = e.soundcloud_url.startsWith('https://soundcloud.com/totm-sim/')
          const unavailable = e.soundcloud_unavailable || (historical && e.removed_from_active)
          return (
            <li
              key={`${e.rank}-${e.soundcloud_url}`}
              className={`flex items-center gap-2 px-2 py-1.5 ${
                unavailable ? 'bg-background/40 opacity-75' : 'bg-background-lighter/80'
              }`}
            >
              <span className="w-5 h-5 shrink-0 rounded bg-primary/12 border border-primary/30 text-primary text-[10px] font-black flex items-center justify-center tabular-nums">
                {e.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-bold text-text-primary truncate leading-tight">
                  {e.song_title || t('totm.untitled')}
                </p>
                <p className="text-[10px] text-text-muted font-medium truncate leading-tight">
                  {e.artist_name || t('totm.unknownArtist')}
                  {e.genre ? ` · ${e.genre}` : ''}
                  {e.audience_score != null ? ` · ${e.audience_score.toFixed(1)}` : ''}
                </p>
              </div>
              {isSim && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary/80">
                  {t('totm.simulated')}
                </span>
              )}
              {unavailable && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-400/90">
                  {t('totm.unavailable')}
                </span>
              )}
              {!isSim && !unavailable && (
                <a
                  href={e.soundcloud_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-bold text-primary hover:underline"
                >
                  SC
                </a>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="space-y-2 sm:space-y-3">
      {entries.map((e) => {
        const isSim = e.soundcloud_url.startsWith('https://soundcloud.com/totm-sim/')
        return (
          <li
            key={`${e.rank}-${e.soundcloud_url}`}
            className={`rounded-lg sm:rounded-xl border-2 p-3 sm:p-4 ${
              e.soundcloud_unavailable || e.removed_from_active
                ? 'border-gray-700/40 bg-background/50 opacity-80'
                : 'border-gray-700/60 bg-background-lighter'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 border border-primary/40 text-primary text-sm font-black flex items-center justify-center tabular-nums">
                {e.rank}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm sm:text-base font-extrabold text-text-primary truncate">
                  {e.song_title || t('totm.untitled')}
                </p>
                <p className="text-xs sm:text-sm font-bold text-text-secondary truncate">
                  {e.artist_name || t('totm.unknownArtist')}
                  {e.genre ? ` · ${e.genre}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] sm:text-xs font-bold text-text-muted">
                    {t('totm.audience')}:{' '}
                    <span className="text-text-primary tabular-nums">
                      {e.audience_score != null ? e.audience_score.toFixed(1) : '—'}
                    </span>
                  </span>
                  {isSim && (
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">
                      {t('totm.simulated')}
                    </span>
                  )}
                  {(e.soundcloud_unavailable || (historical && e.removed_from_active)) && (
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      {t('totm.unavailable')}
                    </span>
                  )}
                  {!isSim && !e.soundcloud_unavailable && !e.removed_from_active && (
                    <a
                      href={e.soundcloud_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] sm:text-xs font-bold text-primary hover:text-primary-hover underline underline-offset-2"
                    >
                      {t('totm.playOnSoundCloud')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
