'use client'

import { useEffect } from 'react'

const XP_HELP_DISMISSED_KEY = 'xp-help-dismissed'

export function getXpHelpDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(XP_HELP_DISMISSED_KEY)
}

export function setXpHelpDismissed(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(XP_HELP_DISMISSED_KEY, '1')
}

interface XpHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function XpHelpModal({ isOpen, onClose }: XpHelpModalProps) {
  const handleDismiss = () => {
    setXpHelpDismissed()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setXpHelpDismissed()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    handleDismiss()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="xp-help-title"
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-lg bg-background-light border border-gray-800 shadow-xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-800/50 shrink-0">
          <h2 id="xp-help-title" className="text-sm font-bold text-text-primary flex items-center gap-1.5">
            <span className="text-primary">⚡</span> How XP works
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-2.5 space-y-2.5 scrollbar-thin text-xs">
          <p className="text-text-primary leading-snug">
            <strong className="text-primary">100 XP = move up 1 spot</strong> (max 3 per session). Queue order is by submit time; XP only moves you up, never down.
          </p>
          <p className="text-text-secondary leading-snug">
            <strong className="text-text-primary">Earn XP:</strong> waiting live (+5 per 5 min) · carryover (+25) · follow (+10) · sub/donation (+20 each per session) · ratings after review.
          </p>
          <details className="rounded bg-background-lighter/60 border border-gray-700/40">
            <summary className="px-2.5 py-1.5 cursor-pointer text-primary font-medium list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
              ▸ Full rules
            </summary>
            <ul className="px-2.5 pb-2 pt-0 space-y-1 text-text-muted leading-snug">
              <li>· Time XP: only when <strong>mikegtcoff</strong> is live and submissions open.</li>
              <li>· Carryover: +25 once when your track moves to carryover.</li>
              <li>· Follow: +10 one-time. Sub/donation: +20 each per session.</li>
              <li>· Curator (after played): avg 9–10 → +60, 8–8.9 → +40, 7–7.9 → +25, 6–6.9 → +10.</li>
              <li>· Audience (live & present): 8–10 → +20, 6–7.9 → +10.</li>
              <li>· Tie-break: when Δxp &lt; 100, watch time counts. Ratings never affect current queue.</li>
            </ul>
          </details>
        </div>

        <div className="px-3 py-2 border-t border-gray-800/50 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2 rounded-button bg-primary hover:bg-primary-hover text-background font-medium text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
