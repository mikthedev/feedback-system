'use client'

import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

interface XpLogEntry {
  id: string
  amount: number
  source: string
  description?: string
  created_at: string
}

interface DashboardFooterProps {
  xp: number
  xpUsedThisSession: number
  /** When null, user has no session cap (e.g. tester). */
  usedCap: number | null
  externalXpThisSession: number
  timeXpActive: boolean | null
  followingMikegtcoff: boolean | null
  carryoverCount: number
  xpLog: XpLogEntry[]
  loadingLog: boolean
  onShowXpHelp: () => void
  /** When true, render only the indicator row (for top of page). */
  compactTop?: boolean
  /** Opens the live indicators help modal (? icon). Only used when compactTop. */
  onShowIndicatorsHelp?: () => void
  /** Let indicator chips wrap onto more than one line. */
  wrap?: boolean
  /** Use XP status: when true, show "You can use your XP"; when false, show reason why not. */
  useXpAllowed?: boolean
  useXpReason?: string
  /** Phone XP pane: single cohesive mobile layout (indicators + stats + status + log). */
  phoneLayout?: boolean
  /** Hide Used/Stored summary cards (when those stats live in the welcome card). */
  hideSummary?: boolean
  /** Standalone dashboard windows. */
  panel?: 'status' | 'tools'
}

const INDICATOR_STYLE =
  'inline-flex min-w-0 items-center justify-center gap-0.5 overflow-hidden px-1 py-0.5 rounded text-[10px] font-bold border border-gray-600/40 touch-manipulation sm:gap-1 sm:px-2 sm:py-1 sm:text-xs sm:border-2 sm:rounded-md'

function IndicatorRow({
  timeXpActive,
  followingMikegtcoff,
  externalXpThisSession,
  hasReviewXp,
  carryoverCount,
  onShowIndicatorsHelp,
  wrap,
  dense,
  t,
}: {
  timeXpActive: boolean | null
  followingMikegtcoff: boolean | null
  externalXpThisSession: number
  hasReviewXp: boolean
  carryoverCount: number
  onShowIndicatorsHelp?: () => void
  wrap?: boolean
  dense?: boolean
  t: (key: string) => string
}) {
  const chip = dense
    ? 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2 touch-manipulation'
    : wrap
      ? `${INDICATOR_STYLE} flex-none gap-1 px-2 py-1 text-xs border-2 rounded-md`
      : `${INDICATOR_STYLE} flex-1`
  return (
    <div
      className={
        dense
          ? 'grid grid-cols-2 gap-1.5'
          : wrap
            ? 'flex flex-wrap items-center gap-1.5'
            : 'flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 sm:gap-2'
      }
    >
      <span
        className={`${chip} ${
          timeXpActive
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-gray-500/10 text-text-muted border-gray-600/40'
        }`}
        title={timeXpActive ? 'Time XP on' : 'Time XP off'}
      >
        <span className="shrink-0">{timeXpActive ? '✓' : '○'}</span>
        <span className="min-w-0 truncate">{t('xp.time')}</span>
      </span>
      <span
        className={`${chip} ${
          followingMikegtcoff === true
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : followingMikegtcoff === false
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-gray-500/10 text-text-muted border-gray-600/40'
        }`}
        title={
          followingMikegtcoff === true
            ? t('xp.following')
            : followingMikegtcoff === false
              ? t('xp.notFollowing')
              : t('xp.unknown')
        }
      >
        <span className="shrink-0">
          {followingMikegtcoff === true ? '✓' : followingMikegtcoff === false ? '✗' : '—'}
        </span>
        {dense ? (
          <span className="min-w-0 truncate">{t('xp.following')}</span>
        ) : (
          <>
            <span className="min-w-0 truncate sm:hidden">{t('xp.following')}</span>
            <span className="min-w-0 truncate hidden sm:inline">
              {followingMikegtcoff === true
                ? t('xp.following')
                : followingMikegtcoff === false
                  ? t('xp.notFollowing')
                  : '—'}
            </span>
          </>
        )}
      </span>
      <span
        className={`${chip} bg-gray-500/10 text-text-muted border-gray-600/40`}
        title="Sub/Donation XP this session"
      >
        <span className="min-w-0 truncate">Sub</span>
        <span className="shrink-0 font-semibold text-text-primary tabular-nums">
          {externalXpThisSession}
        </span>
      </span>
      <span
        className={`${chip} ${
          hasReviewXp
            ? 'bg-primary/10 text-primary border-primary/30'
            : 'bg-gray-500/10 text-text-muted border-gray-600/40'
        }`}
        title="Review XP counted"
      >
        <span className="shrink-0">{hasReviewXp ? '✓' : '○'}</span>
        <span className="min-w-0 truncate">{t('xp.rate')}</span>
      </span>
      <Link
        href="/carryover"
        className={`${chip} ${dense ? '' : ''} bg-gray-500/10 text-text-muted border-gray-600/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors ${dense ? 'col-span-1' : ''}`}
        title="Your tracks in carryover — view details"
      >
        <span className="min-w-0 truncate">{t('xp.carry')}</span>
        <span className="shrink-0 font-semibold text-text-primary tabular-nums">{carryoverCount}</span>
      </Link>
      {onShowIndicatorsHelp && (
        <button
          type="button"
          onClick={onShowIndicatorsHelp}
          className={`${chip} ${dense ? '' : 'flex-none'} bg-gray-500/20 text-text-muted hover:bg-primary/20 hover:text-primary border-gray-600/40 hover:border-primary/30 transition-colors cursor-pointer`}
          title="What do these indicators mean?"
          aria-label="Explain live indicators"
        >
          ?
        </button>
      )}
    </div>
  )
}

const XP_LOG_PREVIEW = 6

function formatXpLogLabel(entry: XpLogEntry, t: (key: string) => string) {
  const key = `xpLog.source.${entry.source}`
  const translated = t(key)
  return translated !== key ? translated : entry.description || entry.source
}

function XpLogList({
  xpLog,
  loadingLog,
  t,
  preview = false,
}: {
  xpLog: XpLogEntry[]
  loadingLog: boolean
  t: (key: string) => string
  preview?: boolean
}) {
  if (loadingLog) {
    return <p className="text-sm text-text-muted py-3 font-medium">{t('xp.loading')}</p>
  }
  if (xpLog.length === 0) {
    return <p className="text-sm text-text-muted py-3 font-medium">{t('xp.noEvents')}</p>
  }

  const visible = preview ? xpLog.slice(0, XP_LOG_PREVIEW) : xpLog
  const hasMore = preview && xpLog.length > XP_LOG_PREVIEW

  return (
    <div>
      <ul className="divide-y divide-gray-700/40 rounded-xl border border-gray-700/45 overflow-hidden bg-background/30">
        {visible.map((entry) => {
          const isPositive = entry.amount > 0
          const isNegative = entry.amount < 0
          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-background-lighter/40 transition-colors"
            >
              <span
                className={`shrink-0 min-w-[3.25rem] text-right text-sm font-black tabular-nums ${
                  isPositive ? 'text-primary' : isNegative ? 'text-red-400' : 'text-amber-400'
                }`}
              >
                {entry.amount === 0 ? '—' : `${entry.amount > 0 ? '+' : ''}${entry.amount}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {formatXpLogLabel(entry, t)}
                </p>
                <p className="text-[11px] text-text-muted tabular-nums font-medium mt-0.5">
                  {new Date(entry.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <Link
          href="/xp/log"
          className="mt-2.5 w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/15 transition-colors touch-manipulation"
        >
          {t('xp.viewFullLog')}
          <span className="text-text-muted font-medium tabular-nums">({xpLog.length})</span>
        </Link>
      )}
    </div>
  )
}

export default function DashboardFooter({
  xp,
  xpUsedThisSession,
  usedCap,
  externalXpThisSession,
  timeXpActive,
  followingMikegtcoff,
  carryoverCount,
  xpLog,
  loadingLog,
  onShowXpHelp,
  compactTop = false,
  onShowIndicatorsHelp,
  wrap = false,
  useXpAllowed,
  useXpReason,
  phoneLayout = false,
  hideSummary = false,
  panel,
}: DashboardFooterProps) {
  const { t } = useLanguage()
  const xpToNext = 100 - (xp % 100)
  const hasReviewXp = xpLog.some(
    (e) => e.source === 'curator_review' || e.source === 'audience_review'
  )

  if (panel === 'status') {
    if (typeof useXpAllowed !== 'boolean') return null
    return (
      <div
        className={`bg-background-light rounded-xl sm:rounded-2xl shadow-lg border-2 overflow-hidden animate-fade-in w-full ${
          useXpAllowed ? 'border-primary/40' : 'border-gray-700/60'
        }`}
      >
        <div
          className={`px-3.5 sm:px-4 py-3.5 flex items-start gap-3 ${
            useXpAllowed ? 'bg-primary/[0.06]' : 'bg-background-light'
          }`}
        >
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              useXpAllowed
                ? 'border-primary/35 bg-primary/15 text-primary'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            aria-hidden
          >
            {useXpAllowed ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              {t('xp.statusTitle')}
            </p>
            <p
              className={`text-sm font-semibold leading-snug ${
                useXpAllowed ? 'text-primary' : 'text-text-primary'
              }`}
            >
              {useXpAllowed
                ? t('dashboard.useXpStatusReady')
                : useXpReason || t('xpHelp.unknownReason')}
            </p>
            {!useXpAllowed && xp < 9999 && xpToNext > 0 && useXpReason && !/session/i.test(useXpReason) && (
              <p className="mt-1 text-xs text-text-muted font-medium">
                {t('dashboard.useXpToGoLine').replace(/\{n\}/g, String(xpToNext))}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (panel === 'tools') {
    return (
      <div className="bg-background-light rounded-xl sm:rounded-2xl shadow-lg border-2 border-gray-700/60 overflow-hidden animate-fade-in w-full">
        <div className="px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-3">
          <button
            type="button"
            onClick={onShowXpHelp}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary/10 border-2 border-primary/40 text-primary font-bold text-sm hover:bg-primary/20 hover:border-primary/50 transition-colors touch-manipulation"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('xp.howXpWorks')}
          </button>
        </div>

        <details className="group border-t-2 border-gray-700/50">
          <summary className="list-none flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-gray-800/20 active:bg-gray-800/30 min-h-[44px] touch-manipulation">
            <span className="flex items-center gap-2">
              <span>{t('xp.xpLog')}</span>
              {xpLog.length > 0 && (
                <span className="text-xs text-text-muted font-medium tabular-nums">
                  {xpLog.length} {xpLog.length === 1 ? t('xp.event') : t('xp.events')}
                </span>
              )}
            </span>
            <svg
              className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-3.5 sm:px-4 pb-3.5 pt-1 border-t border-gray-800/30 bg-background/30">
            <XpLogList xpLog={xpLog} loadingLog={loadingLog} t={t} preview />
          </div>
        </details>
      </div>
    )
  }

  if (compactTop) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-md border-2 border-gray-700/50 bg-background-lighter/60 px-1.5 py-1.5 sm:gap-3 sm:rounded-lg sm:px-3 sm:py-2.5 ${wrap ? 'flex-wrap' : 'flex-nowrap py-1'}`}
      >
        <IndicatorRow
          timeXpActive={timeXpActive}
          followingMikegtcoff={followingMikegtcoff}
          externalXpThisSession={externalXpThisSession}
          hasReviewXp={hasReviewXp}
          carryoverCount={carryoverCount}
          onShowIndicatorsHelp={onShowIndicatorsHelp}
          wrap={wrap}
          t={t}
        />
      </div>
    )
  }

  if (phoneLayout) {
    return (
      <div className="bg-background-light rounded-xl shadow-lg border-2 border-gray-700/60 overflow-hidden animate-fade-in w-full">
        {/* Hero XP strip */}
        <div className="px-3 pt-3 pb-2.5 bg-gradient-to-b from-primary/[0.08] to-transparent border-b border-gray-700/40">
          <div className="flex items-end justify-between gap-3 mb-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {t('xp.stored')}
              </p>
              <p className="text-3xl font-black text-primary tabular-nums leading-none mt-0.5">{xp}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {t('xp.used')}
              </p>
              <p className="text-lg font-extrabold text-text-primary tabular-nums leading-none mt-0.5">
                {xpUsedThisSession}
                {usedCap != null ? (
                  <span className="text-text-muted font-semibold text-sm">/{usedCap}</span>
                ) : (
                  <span className="text-text-muted font-semibold text-[10px] ml-1">
                    ({t('common.noLimit')})
                  </span>
                )}
              </p>
            </div>
          </div>

          {typeof useXpAllowed === 'boolean' && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                useXpAllowed
                  ? 'border-primary/35 bg-primary/10'
                  : 'border-amber-500/25 bg-amber-500/[0.07]'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                  useXpAllowed
                    ? 'border-primary/35 bg-primary/15 text-primary'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                }`}
                aria-hidden
              >
                {useXpAllowed ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-semibold leading-snug ${
                    useXpAllowed ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {useXpAllowed
                    ? t('dashboard.useXpStatusReady')
                    : useXpReason || t('xpHelp.unknownReason')}
                </p>
                {!useXpAllowed && xp < 9999 && (
                  <p className="text-[10px] font-medium text-text-muted mt-0.5">
                    {t('dashboard.useXpToGoLine').replace(/\{n\}/g, String(xpToNext))}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live indicators */}
        <div className="px-3 py-2.5 border-b border-gray-700/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {t('xp.liveStatus')}
            </p>
            {onShowIndicatorsHelp && (
              <button
                type="button"
                onClick={onShowIndicatorsHelp}
                className="text-[10px] font-bold text-primary touch-manipulation"
              >
                ?
              </button>
            )}
          </div>
          <IndicatorRow
            timeXpActive={timeXpActive}
            followingMikegtcoff={followingMikegtcoff}
            externalXpThisSession={externalXpThisSession}
            hasReviewXp={hasReviewXp}
            carryoverCount={carryoverCount}
            dense
            t={t}
          />
        </div>

        {/* Actions */}
        <div className="p-3 space-y-2">
          <button
            type="button"
            onClick={onShowXpHelp}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary/10 border-2 border-primary/40 text-primary font-bold text-sm hover:bg-primary/20 transition-colors touch-manipulation"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('xp.howXpWorks')}
          </button>

          <details className="group rounded-xl border-2 border-gray-700/50 overflow-hidden bg-background/40">
            <summary className="list-none flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer text-xs font-bold text-text-secondary hover:text-text-primary min-h-[44px] touch-manipulation">
              <span className="flex items-center gap-2">
                <span>{t('xp.xpLog')}</span>
                {xpLog.length > 0 && (
                  <span className="text-[10px] text-text-muted font-medium tabular-nums">
                    {xpLog.length}
                  </span>
                )}
              </span>
              <svg
                className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-3 pb-3 border-t border-gray-700/40">
              <XpLogList xpLog={xpLog} loadingLog={loadingLog} t={t} preview />
            </div>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background-light rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 animate-fade-in border-2 border-gray-700/60 w-full">
      {!hideSummary && (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div className="rounded-md sm:rounded-lg bg-background/80 border-2 border-gray-700/50 p-2 sm:p-3 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[72px]">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">
              {t('xp.used')}
            </span>
            <span
              className="mt-0.5 sm:mt-1 text-base sm:text-lg font-extrabold text-text-primary tabular-nums"
              title={usedCap == null ? 'No limit for testers' : undefined}
            >
              {xpUsedThisSession}
              {usedCap != null ? (
                <span className="text-text-muted font-semibold">/{usedCap}</span>
              ) : (
                <span className="text-text-muted font-semibold text-xs ml-0.5">
                  ({t('common.noLimit')})
                </span>
              )}
            </span>
          </div>
          <div className="rounded-md sm:rounded-lg bg-background/80 border-2 border-gray-700/50 p-2 sm:p-3 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[72px]">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">
              {t('xp.stored')}
            </span>
            <span className="mt-0.5 sm:mt-1 text-base sm:text-lg font-extrabold text-primary tabular-nums">
              {xp}
            </span>
          </div>
        </div>
      )}

      {/* How XP works */}
      <button
        type="button"
        onClick={onShowXpHelp}
        className="w-full min-h-[44px] sm:min-h-[48px] flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-primary/10 border-2 border-primary/40 text-primary font-bold text-xs sm:text-sm hover:bg-primary/20 hover:border-primary/50 transition-colors touch-manipulation"
        title={t('xp.howXpWorks')}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {t('xp.howXpWorks')}
      </button>

      {/* Use XP status */}
      {typeof useXpAllowed === 'boolean' && (
        <div
          className={`relative mt-3 sm:mt-4 mb-3 sm:mb-4 overflow-hidden rounded-lg sm:rounded-xl border-2 p-3 sm:p-3.5 animate-fade-in transition-shadow ${
            useXpAllowed
              ? 'border-primary/40 bg-primary/10 shadow-sm ring-1 ring-inset ring-primary/10'
              : 'border-gray-700/50 bg-background/80 shadow-sm ring-1 ring-inset ring-white/[0.04]'
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-x-4 top-0 h-px rounded-full ${
              useXpAllowed
                ? 'bg-gradient-to-r from-transparent via-primary/60 to-transparent'
                : 'bg-gradient-to-r from-transparent via-amber-500/45 to-transparent'
            }`}
            aria-hidden
          />
          <div className="relative flex items-start gap-3 sm:gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 shadow-inner ${
                useXpAllowed
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-amber-500/30 bg-amber-500/[0.08] text-amber-400'
              }`}
              aria-hidden
            >
              {useXpAllowed ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <p
                className={`text-sm sm:text-[15px] leading-snug font-semibold tracking-tight ${
                  useXpAllowed ? 'text-primary' : 'text-text-primary'
                }`}
              >
                {useXpAllowed
                  ? t('dashboard.useXpStatusReady')
                  : useXpReason || t('xpHelp.unknownReason')}
              </p>
              {!useXpAllowed && xp < 9999 && (
                <p className="text-xs font-medium leading-relaxed text-text-secondary">
                  {t('dashboard.useXpToGoLine').replace(/\{n\}/g, String(xpToNext))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* XP Log — expandable */}
      <details className="group border-t-2 border-gray-700/50 -mx-4 pt-0">
        <summary className="list-none flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-gray-800/20 active:bg-gray-800/30 min-h-[44px] sm:min-h-[48px] touch-manipulation">
          <span className="flex items-center gap-2">
            <span>{t('xp.xpLog')}</span>
            {xpLog.length > 0 && (
              <span className="text-xs text-text-muted font-medium tabular-nums">
                {xpLog.length} {xpLog.length === 1 ? t('xp.event') : t('xp.events')}
              </span>
            )}
          </span>
          <svg
            className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-gray-800/30 bg-background/30">
          <XpLogList xpLog={xpLog} loadingLog={loadingLog} t={t} preview />
        </div>
      </details>
    </div>
  )
}
