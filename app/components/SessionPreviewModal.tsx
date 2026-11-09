'use client'

import { useEffect, useState } from 'react'

type Track = {
  id: string
  song_title: string | null
  artist_name: string | null
  status: string
  created_at: string
  soundcloud_url: string
}

type Submitter = {
  user_id: string
  display_name: string
  track_count: number
  reviewed_count: number
  pending_count: number
  tracks: Track[]
  xp_gained: number
  xp_lost: number
  xp_net: number
  moves_used: number
  by_source: Record<string, number>
}

type SessionSummary = {
  session_number: number
  started_at: string
  ended_at: string | null
  submission_count: number
  unique_submitters: number
  reviewed_count: number
  pending_count: number
  xp_gained: number
  xp_lost: number
  xp_net: number
}

interface SessionPreviewModalProps {
  sessionNumber: number | null
  onClose: () => void
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function formatXp(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

const SOURCE_LABELS: Record<string, string> = {
  time: 'Time',
  follow: 'Follow',
  curator_review: 'Review',
  audience_review: 'Community',
  carryover: 'Carryover',
  sub: 'Sub',
  donation: 'Donation',
  adjust: 'Adjust',
  queue_move: 'Queue move',
}

export default function SessionPreviewModal({ sessionNumber, onClose }: SessionPreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionSummary | null>(null)
  const [submitters, setSubmitters] = useState<Submitter[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (sessionNumber == null) return

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setSession(null)
      setSubmitters([])
      setExpandedId(null)
      try {
        const res = await fetch(`/api/sessions/${sessionNumber}`, { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'Failed to load session')
          return
        }
        if (cancelled) return
        setSession(data.session ?? null)
        setSubmitters(Array.isArray(data.submitters) ? data.submitters : [])
      } catch {
        if (!cancelled) setError('Failed to load session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [sessionNumber])

  useEffect(() => {
    if (sessionNumber == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionNumber, onClose])

  if (sessionNumber == null) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-preview-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-hidden rounded-xl bg-background-light border border-gray-800/50 shadow-2xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800/50 shrink-0">
          <h3 id="session-preview-title" className="text-base font-bold text-text-primary">
            Session #{sessionNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3 scrollbar-thin">
          {loading && <p className="text-sm text-text-secondary">Loading session…</p>}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {!loading && !error && session && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-gray-800/50 bg-background p-2.5">
                  <p className="text-text-muted uppercase tracking-wider text-[10px] font-semibold mb-0.5">Started</p>
                  <p className="text-text-primary font-medium">{formatWhen(session.started_at)}</p>
                </div>
                <div className="rounded-lg border border-gray-800/50 bg-background p-2.5">
                  <p className="text-text-muted uppercase tracking-wider text-[10px] font-semibold mb-0.5">Ended</p>
                  <p className="text-text-primary font-medium">
                    {session.ended_at ? formatWhen(session.ended_at) : (
                      <span className="text-emerald-400">Active</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Tracks" value={String(session.submission_count)} />
                <Stat label="Submitters" value={String(session.unique_submitters)} />
                <Stat label="Reviewed" value={String(session.reviewed_count)} />
                <Stat label="Pending" value={String(session.pending_count)} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="XP gained"
                  value={formatXp(session.xp_gained)}
                  valueClass="text-emerald-400"
                />
                <Stat
                  label="XP lost"
                  value={session.xp_lost > 0 ? `−${session.xp_lost}` : '0'}
                  valueClass="text-red-400"
                />
                <Stat
                  label="Net XP"
                  value={formatXp(session.xp_net)}
                  valueClass={
                    session.xp_net > 0
                      ? 'text-emerald-400'
                      : session.xp_net < 0
                        ? 'text-red-400'
                        : 'text-text-primary'
                  }
                />
              </div>

              <div>
                <p className="text-text-muted font-semibold mb-2 uppercase tracking-wider text-[10px]">
                  Who submitted
                </p>
                {submitters.filter((s) => s.track_count > 0).length === 0 ? (
                  <p className="text-xs text-text-secondary">No submissions in this session.</p>
                ) : (
                  <div className="space-y-1.5">
                    {submitters
                      .filter((s) => s.track_count > 0)
                      .map((s) => {
                        const open = expandedId === s.user_id
                        return (
                          <div
                            key={s.user_id}
                            className="rounded-lg border border-gray-800/50 bg-background overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedId(open ? null : s.user_id)}
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-background-lighter/60 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-text-primary truncate">
                                  {s.display_name}
                                </p>
                                <p className="text-[11px] text-text-secondary">
                                  {s.track_count} track{s.track_count === 1 ? '' : 's'}
                                  {s.reviewed_count > 0 ? ` · ${s.reviewed_count} reviewed` : ''}
                                  {s.moves_used > 0 ? ` · ${s.moves_used} XP move${s.moves_used === 1 ? '' : 's'}` : ''}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p
                                  className={`text-xs font-bold tabular-nums ${
                                    s.xp_net > 0
                                      ? 'text-emerald-400'
                                      : s.xp_net < 0
                                        ? 'text-red-400'
                                        : 'text-text-muted'
                                  }`}
                                >
                                  {formatXp(s.xp_net)} XP
                                </p>
                                <p className="text-[10px] text-text-muted tabular-nums">
                                  +{s.xp_gained} / −{s.xp_lost}
                                </p>
                              </div>
                            </button>
                            {open && (
                              <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-gray-800/40">
                                {Object.keys(s.by_source).length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-2">
                                    {Object.entries(s.by_source)
                                      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                      .map(([source, amount]) => (
                                        <span
                                          key={source}
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border tabular-nums ${
                                            amount >= 0
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                                          }`}
                                        >
                                          {SOURCE_LABELS[source] ?? source} {formatXp(amount)}
                                        </span>
                                      ))}
                                  </div>
                                )}
                                <ul className="space-y-1 pt-1">
                                  {s.tracks.map((track) => (
                                    <li
                                      key={track.id}
                                      className="flex items-start justify-between gap-2 text-[11px] rounded-md bg-background-lighter/50 px-2 py-1.5"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-text-primary font-medium truncate">
                                          {track.song_title || track.artist_name || 'Untitled track'}
                                        </p>
                                        <p className="text-text-muted">
                                          {formatWhen(track.created_at)} · {track.status}
                                        </p>
                                      </div>
                                      <a
                                        href={track.soundcloud_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 text-primary hover:text-primary-hover underline underline-offset-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        SC
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {submitters.some((s) => s.track_count === 0 && (s.xp_net !== 0 || s.moves_used > 0)) && (
                <div>
                  <p className="text-text-muted font-semibold mb-2 uppercase tracking-wider text-[10px]">
                    Other XP activity
                  </p>
                  <div className="space-y-1">
                    {submitters
                      .filter((s) => s.track_count === 0 && (s.xp_net !== 0 || s.moves_used > 0))
                      .map((s) => (
                        <div
                          key={s.user_id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-800/50 bg-background px-2.5 py-2 text-xs"
                        >
                          <span className="font-medium text-text-primary truncate">{s.display_name}</span>
                          <span
                            className={`tabular-nums font-bold ${
                              s.xp_net > 0
                                ? 'text-emerald-400'
                                : s.xp_net < 0
                                  ? 'text-red-400'
                                  : 'text-text-muted'
                            }`}
                          >
                            {formatXp(s.xp_net)} XP
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-text-muted leading-snug">
                XP is counted from events between session start and end (or now if still active). Deleting a session removes submissions but keeps XP history.
              </p>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-button bg-background-lighter hover:bg-gray-700/50 text-text-primary border border-gray-700 font-medium text-sm transition-colors active:scale-[0.98] button-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass = 'text-text-primary',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-gray-800/50 bg-background p-2.5 text-center">
      <p className="text-text-muted uppercase tracking-wider text-[10px] font-semibold mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}
