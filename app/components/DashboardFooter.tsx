'use client'

import Link from 'next/link'

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
  unusedExternal: number
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
}

const INDICATOR_STYLE = 'inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium border touch-manipulation'

function IndicatorRow({
  timeXpActive,
  followingMikegtcoff,
  externalXpThisSession,
  hasReviewXp,
  carryoverCount,
  onShowIndicatorsHelp,
}: {
  timeXpActive: boolean | null
  followingMikegtcoff: boolean | null
  externalXpThisSession: number
  hasReviewXp: boolean
  carryoverCount: number
  onShowIndicatorsHelp?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`${INDICATOR_STYLE} ${
          timeXpActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-gray-500/10 text-text-muted border-gray-600/40'
        }`}
        title={timeXpActive ? 'Time XP on' : 'Time XP off'}
      >
        {timeXpActive ? '✓' : '○'} Time XP
      </span>
      <span
        className={`${INDICATOR_STYLE} ${
          followingMikegtcoff === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : followingMikegtcoff === false ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-gray-500/10 text-text-muted border-gray-600/40'
        }`}
        title={followingMikegtcoff === true ? 'Following' : followingMikegtcoff === false ? 'Not following' : 'Unknown'}
      >
        {followingMikegtcoff === true ? '✓' : followingMikegtcoff === false ? '✗' : '—'} MikeGTC
      </span>
      <span className={`${INDICATOR_STYLE} bg-gray-500/10 text-text-muted border-gray-600/40`} title="Sub/Donation XP this session">
        Sub/Don: <span className="font-semibold text-text-primary tabular-nums">{externalXpThisSession}</span>
      </span>
      <span className={`${INDICATOR_STYLE} ${hasReviewXp ? 'bg-primary/10 text-primary border-primary/30' : 'bg-gray-500/10 text-text-muted border-gray-600/40'}`} title="Review XP counted">
        {hasReviewXp ? '✓' : '○'} Ratings
      </span>
      <Link
        href="/carryover"
        className={`${INDICATOR_STYLE} bg-gray-500/10 text-text-muted border-gray-600/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors`}
        title="Your tracks in carryover — view details"
      >
        Carry: <span className="font-semibold text-text-primary tabular-nums">{carryoverCount}</span>
      </Link>
      {onShowIndicatorsHelp && (
        <button
          type="button"
          onClick={onShowIndicatorsHelp}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-500/20 text-text-muted hover:bg-primary/20 hover:text-primary border border-gray-600/40 hover:border-primary/30 transition-colors"
          title="What do these indicators mean?"
          aria-label="Explain live indicators"
        >
          <span className="text-[10px] font-bold">?</span>
        </button>
      )}
    </div>
  )
}

export default function DashboardFooter({
  xp,
  xpUsedThisSession,
  unusedExternal,
  externalXpThisSession,
  timeXpActive,
  followingMikegtcoff,
  carryoverCount,
  xpLog,
  loadingLog,
  onShowXpHelp,
  compactTop = false,
  onShowIndicatorsHelp,
}: DashboardFooterProps) {
  const hasReviewXp = xpLog.some((e) => e.source === 'curator_review' || e.source === 'audience_review')

  if (compactTop) {
    return (
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 py-1 sm:py-1.5 px-2 rounded-md sm:rounded-lg bg-background-lighter/60 border border-gray-800/40">
        <span className="text-[9px] sm:text-[10px] font-medium text-text-muted uppercase tracking-wider mr-0.5 shrink-0">
          Live
        </span>
        <IndicatorRow
          timeXpActive={timeXpActive}
          followingMikegtcoff={followingMikegtcoff}
          externalXpThisSession={externalXpThisSession}
          hasReviewXp={hasReviewXp}
          carryoverCount={carryoverCount}
          onShowIndicatorsHelp={onShowIndicatorsHelp}
        />
      </div>
    )
  }

  return (
    <footer className="max-w-2xl mx-auto mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800/50">
      <div className="space-y-2 sm:space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[10px] sm:text-[11px] text-text-muted">
          <span>Used <span className="font-semibold text-text-primary tabular-nums">{xpUsedThisSession}</span>/300</span>
          <span>·</span>
          <span>Stored <span className="font-semibold text-primary tabular-nums">{xp}</span></span>
          {unusedExternal > 0 && (
            <>
              <span>·</span>
              <span>Unused ext. <span className="font-semibold text-primary tabular-nums">{unusedExternal}</span></span>
            </>
          )}
        </div>

        {/* XP Log: expandable, compact */}
        <details className="group rounded border border-gray-800/50 bg-background-lighter/40 overflow-hidden">
          <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-medium text-text-secondary hover:text-text-primary list-none flex items-center justify-between gap-2">
            <span>XP log</span>
            <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="px-2 pb-2 pt-0 border-t border-gray-800/50">
            {loadingLog ? (
              <p className="text-[10px] text-text-muted py-1">Loading…</p>
            ) : xpLog.length === 0 ? (
              <p className="text-[10px] text-text-muted py-1">No events yet.</p>
            ) : (
              <ul className="space-y-0.5 max-h-40 overflow-y-auto text-[10px]">
                {xpLog.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-1.5 py-0.5 border-b border-gray-800/20 last:border-0">
                    <span className="text-text-muted shrink-0 tabular-nums">
                      {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={entry.amount >= 0 ? 'text-primary font-medium' : 'text-red-400 font-medium'}>
                      {entry.amount >= 0 ? '+' : ''}{entry.amount}
                    </span>
                    <span className="text-text-secondary truncate">{entry.description || entry.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </footer>
  )
}
