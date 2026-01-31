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
  {
    label: 'Time XP',
    value: '+5',
    sub: 'per 5 min while mikegtcoff is live and submissions are open',
    color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    hover: 'hover:bg-emerald-500/30 hover:border-emerald-500/60 hover:ring-2 hover:ring-emerald-500/40',
  },
  {
    label: 'Carryover',
    value: '+25',
    sub: 'when your track moves to carryover',
    color: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
    hover: 'hover:bg-amber-500/30 hover:border-amber-500/60 hover:ring-2 hover:ring-amber-500/40',
  },
  {
    label: 'Follow',
    value: '+10',
    sub: 'one-time bonus for following MikeGTC',
    color: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    hover: 'hover:bg-blue-500/30 hover:border-blue-500/60 hover:ring-2 hover:ring-blue-500/40',
  },
  {
    label: 'Sub / Donation',
    value: '+20',
    sub: 'each once per session',
    color: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    hover: 'hover:bg-purple-500/30 hover:border-purple-500/60 hover:ring-2 hover:ring-purple-500/40',
  },
  {
    label: 'Review (curator)',
    value: '10–60',
    sub: 'based on average score',
    color: 'bg-primary/20 border-primary/40 text-primary',
    hover: 'hover:bg-primary/30 hover:border-primary/60 hover:ring-2 hover:ring-primary/50',
  },
  {
    label: 'Use XP',
    value: '100 XP = 1 spot',
    sub: 'max 3 moves per session',
    color: 'bg-gray-600/30 border-gray-600/50 text-text-primary',
    hover: 'hover:bg-gray-600/40 hover:border-gray-600/70 hover:ring-2 hover:ring-gray-500/30',
  },
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="xp-help-title"
    >
      <div
        className="relative w-full max-w-md max-h-[82vh] sm:max-h-[90vh] overflow-hidden rounded-xl bg-background-light border border-gray-800 shadow-xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-800/50 shrink-0 sm:px-4 sm:py-3">
          <h2 id="xp-help-title" className="text-sm font-bold text-text-primary flex items-center gap-1.5 sm:text-base sm:gap-2">
            <span className="text-primary drop-shadow-[0_0_8px_rgba(255,85,0,0.4)]">⚡</span> How XP works
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors duration-200 touch-manipulation"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-3 scrollbar-thin text-sm sm:px-4 sm:py-4 sm:space-y-5 sm:text-sm">
          {/* Intro */}
          <div className="space-y-1.5 text-text-secondary leading-snug text-xs sm:space-y-2 sm:text-sm">
            <p>
              XP is a fairness system that gently helps your track move forward in the queue.
              The queue always starts by submit time and XP never breaks that rule.
              It only gives your track the right to move up step by step, never instantly.
            </p>
            <p>
              XP is tied to your Twitch account and carries over between sessions.
            </p>
          </div>

          {/* XP types — visual blocks with hover animation */}
          <div>
            <p className="text-text-muted font-semibold mb-1.5 uppercase tracking-wider text-[10px] sm:mb-2.5">XP types</p>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {XP_BLOCKS.map((b) => (
                <div
                  key={b.label}
                  className={`rounded-lg border p-2 transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-lg cursor-default sm:p-2.5 ${b.color} ${b.hover}`}
                >
                  <p className="font-bold text-sm leading-tight sm:text-base">{b.value}</p>
                  <p className="font-medium opacity-95 text-[11px] mt-0.5 sm:text-xs">{b.label}</p>
                  {b.sub && <p className="text-[10px] opacity-85 mt-0.5 leading-snug sm:mt-1">{b.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* How it works — only nuances not covered above */}
          <div className="border-t border-gray-800/50 pt-3 sm:pt-4">
            <p className="text-text-muted font-semibold mb-1.5 uppercase tracking-wider text-[10px] sm:mb-2.5">How it works</p>
            <ul className="space-y-1.5 text-text-secondary leading-snug text-[11px] sm:space-y-2 sm:text-xs">
              <li className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>Follow bonus is once ever — unfollow/refollow doesn&apos;t repeat it</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>After review, curator scores grant XP for future submissions only</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>Up to 300 XP can be used per session via &quot;Use my XP&quot;</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-gray-800/50 shrink-0 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium text-sm transition-colors duration-200 touch-manipulation sm:py-2.5"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
