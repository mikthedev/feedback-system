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
  /** Use XP status: when true, show "You can use your XP"; when false, show reason why not. */
  useXpAllowed?: boolean
  useXpReason?: string
}

const INDICATOR_STYLE =
  'inline-flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden px-1 py-0.5 rounded text-[10px] font-bold border border-gray-600/40 touch-manipulation sm:gap-1 sm:px-2 sm:py-1 sm:text-xs sm:border-2 sm:rounded-md'

function IndicatorRow({
  timeXpActive,
  followingMikegtcoff,
  externalXpThisSession,
  hasReviewXp,
  carryoverCount,
  onShowIndicatorsHelp,
  t,
}: {
  timeXpActive: boolean | null
  followingMikegtcoff: boolean | null
  externalXpThisSession: number
  hasReviewXp: boolean
  carryoverCount: number
  onShowIndicatorsHelp?: () => void
  t: (key: string) => string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 sm:gap-2">
      <span
        className={`${INDICATOR_STYLE} ${
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
        className={`${INDICATOR_STYLE} ${
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
        <span className="shrink-0">{followingMikegtcoff === true ? '✓' : followingMikegtcoff === false ? '✗' : '—'}</span>
        <span className="min-w-0 truncate sm:hidden">{t('xp.following')}</span>
        <span className="min-w-0 truncate hidden sm:inline">
          {followingMikegtcoff === true ? t('xp.following') : followingMikegtcoff === false ? t('xp.notFollowing') : '—'}
        </span>
      </span>
      <span
        className={`${INDICATOR_STYLE} bg-gray-500/10 text-text-muted border-gray-600/40`}
        title="Sub/Donation XP this session"
      >
        <span className="min-w-0 truncate">Sub</span>
        <span className="shrink-0 font-semibold text-text-primary tabular-nums">{externalXpThisSession}</span>
      </span>
      <span
        className={`${INDICATOR_STYLE} ${hasReviewXp ? 'bg-primary/10 text-primary border-primary/30' : 'bg-gray-500/10 text-text-muted border-gray-600/40'}`}
        title="Review XP counted"
      >
        <span className="shrink-0">{hasReviewXp ? '✓' : '○'}</span>
        <span className="min-w-0 truncate">{t('xp.rate')}</span>
      </span>
      <Link
        href="/carryover"
        className={`${INDICATOR_STYLE} bg-gray-500/10 text-text-muted border-gray-600/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors`}
        title="Your tracks in carryover — view details"
      >
        <span className="min-w-0 truncate">{t('xp.carry')}</span>
        <span className="shrink-0 font-semibold text-text-primary tabular-nums">{carryoverCount}</span>
      </Link>
      {onShowIndicatorsHelp && (
        <button
          type="button"
          onClick={onShowIndicatorsHelp}
          className={`${INDICATOR_STYLE} flex-none bg-gray-500/20 text-text-muted hover:bg-primary/20 hover:text-primary border-gray-600/40 hover:border-primary/30 transition-colors cursor-pointer`}
          title="What do these indicators mean?"
          aria-label="Explain live indicators"
        >
          ?
        </button>
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
  useXpAllowed,
  useXpReason,
}: DashboardFooterProps) {
  const { t } = useLanguage()
  const hasReviewXp = xpLog.some(
    (e) => e.source === 'curator_review' || e.source === 'audience_review'
  )

  if (compactTop) {
    return (
      <div className="flex flex-nowrap items-center gap-1.5 py-1.5 px-2 rounded-lg bg-background-lighter/60 border-2 border-gray-700/50 sm:gap-3 sm:py-2.5 sm:px-3 sm:rounded-lg">
        <IndicatorRow
          timeXpActive={timeXpActive}
          followingMikegtcoff={followingMikegtcoff}
          externalXpThisSession={externalXpThisSession}
          hasReviewXp={hasReviewXp}
          carryoverCount={carryoverCount}
          onShowIndicatorsHelp={onShowIndicatorsHelp}
          t={t}
        />
      </div>
    )
  }

  return (
    <div className="bg-background-light rounded-xl shadow-lg p-4 animate-fade-in border-2 border-gray-700/60 w-full">
      {/* XP summary — 2 stat cards in a row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg bg-background/80 border-2 border-gray-700/50 p-3 flex flex-col items-center justify-center min-h-[72px]">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {t('xp.used')}
          </span>
          <span className="mt-1 text-lg font-extrabold text-text-primary tabular-nums" title={usedCap == null ? 'No limit for testers' : undefined}>
            {xpUsedThisSession}
            {usedCap != null ? <span className="text-text-muted font-semibold">/{usedCap}</span> : <span className="text-text-muted font-semibold text-xs ml-0.5">({t('common.noLimit')})</span>}
          </span>
        </div>
        <div className="rounded-lg bg-background/80 border-2 border-gray-700/50 p-3 flex flex-col items-center justify-center min-h-[72px]">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {t('xp.stored')}
          </span>
          <span className="mt-1 text-lg font-extrabold text-primary tabular-nums">
            {xp}
          </span>
        </div>
      </div>

      {/* How XP works */}
      <button
        type="button"
        onClick={onShowXpHelp}
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-primary/10 border-2 border-primary/40 text-primary font-bold text-sm hover:bg-primary/20 hover:border-primary/50 transition-colors touch-manipulation"
        title={t('xp.howXpWorks')}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {t('xp.howXpWorks')}
      </button>

      {/* Use XP status — why you can / can't use XP */}
      {useXpAllowed != null && useXpReason != null && (
        <div
          className={`mt-3 mb-4 px-3 py-2.5 rounded-lg border-2 text-sm font-medium ${
            useXpAllowed
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {useXpAllowed
            ? t('xpHelp.youCanUseXp')
            : (useXpReason || t('xpHelp.unknownReason'))}
        </div>
      )}

      {/* XP Log — expandable */}
      <details className="group border-t-2 border-gray-700/50 -mx-4 pt-0">
        <summary className="list-none flex items-center justify-between gap-2 px-4 py-3 cursor-pointer text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-gray-800/20 active:bg-gray-800/30 min-h-[48px] touch-manipulation">
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
          {loadingLog ? (
            <p className="text-sm text-text-muted py-4 font-medium">{t('xp.loading')}</p>
          ) : xpLog.length === 0 ? (
            <p className="text-sm text-text-muted py-4 font-medium">{t('xp.noEvents')}</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {xpLog.map((entry) => {
                const isPositive = entry.amount > 0
                const isNegative = entry.amount < 0
                const isNeutral = entry.amount === 0
                return (
                  <li
                    key={entry.id}
                    className={`flex flex-wrap items-start gap-x-2 gap-y-1 px-3 py-2.5 rounded-lg border transition-colors ${
                      isPositive
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                        : isNegative
                          ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                          : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                    }`}
                  >
                    <span className="text-[11px] text-text-muted shrink-0 tabular-nums font-medium uppercase tracking-wider">
                      {new Date(entry.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {entry.amount !== 0 ? (
                      <span
                        className={`shrink-0 font-bold tabular-nums ${
                          isPositive ? 'text-primary' : 'text-red-400'
                        }`}
                      >
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                    ) : (
                      <span className="text-amber-400/80 font-medium tabular-nums shrink-0">—</span>
                    )}
                    <span
                      className={`text-sm min-w-0 break-words ${
                        isPositive
                          ? 'text-text-secondary font-medium'
                          : isNegative
                            ? 'text-red-300/90 font-medium'
                            : 'text-amber-200/90 font-medium'
                      }`}
                    >
                      {(() => {
                        const key = `xpLog.source.${entry.source}`
                        const translated = t(key)
                        return translated !== key ? translated : (entry.description || entry.source)
                      })()}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  )
}
