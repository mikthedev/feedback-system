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

const XP_BLOCKS = [
  { label: 'Time XP', value: '+5', sub: 'per 5 min (live + open)', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
  { label: 'Carryover', value: '+25', sub: 'when track moves to carryover', color: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
  { label: 'Follow', value: '+10', sub: 'one-time (MikeGTC)', color: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
  { label: 'Sub / Donation', value: '+20', sub: 'each per session', color: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
  { label: 'Review (curator)', value: '10–60', sub: 'by average score', color: 'bg-primary/20 border-primary/40 text-primary' },
  { label: 'Use XP', value: '100 = 1 spot', sub: 'max 3 moves per session', color: 'bg-gray-600/30 border-gray-600/50 text-text-primary' },
]

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

        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4 scrollbar-thin text-xs">
          {/* Section 1: Visual blocks */}
          <div>
            <p className="text-text-muted font-medium mb-2 uppercase tracking-wider text-[10px]">XP types</p>
            <div className="grid grid-cols-2 gap-2">
              {XP_BLOCKS.map((b) => (
                <div
                  key={b.label}
                  className={`rounded-lg border p-2 ${b.color}`}
                >
                  <p className="font-bold leading-tight">{b.value}</p>
                  <p className="font-medium opacity-90">{b.label}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{b.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Plain text instructions */}
          <div className="border-t border-gray-800/50 pt-3">
            <p className="text-text-muted font-medium mb-2 uppercase tracking-wider text-[10px]">How it works</p>
            <ul className="space-y-1.5 text-text-secondary leading-snug list-none">
              <li>· 100 XP = move up 1 spot in queue (max 3 per session). Queue order is by submit time; XP only moves you up.</li>
              <li>· Time XP: only when <strong className="text-text-primary">mikegtcoff</strong> is live and submissions are open.</li>
              <li>· Carryover: +25 once when your track moves to carryover. Follow: +10 one-time. Sub/donation: +20 each per session.</li>
              <li>· After review: curator average 9–10 → +60, 8–8.9 → +40, 7–7.9 → +25, 6–6.9 → +10.</li>
              <li>· Stored XP carries over; up to 300 XP can be used per session via &quot;Use my XP&quot;.</li>
            </ul>
          </div>
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
