'use client'

import { useEffect } from 'react'

interface IndicatorsHelpModalProps {
  isOpen: boolean
  onClose: () => void
  followingMikegtcoff?: boolean | null
  timeXpActive?: boolean | null
  externalXpThisSession?: number
}

const MIKEY_TWITCH_URL = 'https://www.twitch.tv/mikegtcoff'

export default function IndicatorsHelpModal({
  isOpen,
  onClose,
  followingMikegtcoff,
  timeXpActive,
  externalXpThisSession = 0,
}: IndicatorsHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicators-help-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl bg-background-light border border-gray-800 shadow-xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800/50 shrink-0">
          <h2 id="indicators-help-title" className="text-base font-bold text-text-primary flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">?</span>
            Live indicators
          </h2>
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

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 scrollbar-thin text-sm">
          <p className="text-text-secondary text-xs">
            These indicators update in real time. They show your current XP-related status for this session.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-gray-800/50 bg-background-lighter/50">
              <p className="font-semibold text-text-primary text-xs uppercase tracking-wider mb-2">Time XP</p>
              <p className="text-text-secondary text-xs leading-relaxed mb-2">
                <span className={timeXpActive ? 'text-emerald-400' : 'text-text-muted'}>
                  {timeXpActive ? '✓ On' : '○ Off'}
                </span>
                — You earn <strong className="text-primary">+5 XP every 5 minutes</strong> while MikeGTC is live on Twitch and submissions are open. Tune in to the stream to earn Time XP.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-gray-800/50 bg-background-lighter/50">
              <p className="font-semibold text-text-primary text-xs uppercase tracking-wider mb-2">MikeGTC (Follow)</p>
              <p className="text-text-secondary text-xs leading-relaxed mb-2">
                <span className={
                  followingMikegtcoff === true ? 'text-emerald-400' : followingMikegtcoff === false ? 'text-amber-400' : 'text-text-muted'
                }>
                  {followingMikegtcoff === true ? '✓ Following' : followingMikegtcoff === false ? '✗ Not following' : '— Unknown'}
                </span>
                — Follow MikeGTC on Twitch for a one-time <strong className="text-primary">+10 XP</strong> bonus.
              </p>
              {followingMikegtcoff !== true && (
                <a
                  href={MIKEY_TWITCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium border border-primary/30 transition-colors"
                >
                  Follow on Twitch
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            <div className="p-3 rounded-lg border border-gray-800/50 bg-background-lighter/50">
              <p className="font-semibold text-text-primary text-xs uppercase tracking-wider mb-2">Sub / Donation</p>
              <p className="text-text-secondary text-xs leading-relaxed">
                Shows <strong className="text-text-primary">{externalXpThisSession}</strong> XP from subscriptions or donations this session. Subscribe to MikeGTC on Twitch or donate during the stream to earn <strong className="text-primary">+20 XP</strong> (each once per session).
              </p>
            </div>

            <div className="p-3 rounded-lg border border-gray-800/50 bg-background-lighter/50">
              <p className="font-semibold text-text-primary text-xs uppercase tracking-wider mb-2">Ratings</p>
              <p className="text-text-secondary text-xs leading-relaxed">
                <span className="text-text-muted">✓ / ○</span> — Whether your review scores from the curator have been counted toward your XP. After your track is reviewed, the ratings XP is added to your total.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-gray-800/50 bg-background-lighter/50">
              <p className="font-semibold text-text-primary text-xs uppercase tracking-wider mb-2">Carry</p>
              <p className="text-text-secondary text-xs leading-relaxed">
                Number of your tracks in carryover (skipped or moved to another session). Click to view details.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
