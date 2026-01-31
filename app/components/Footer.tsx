'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative w-full mt-auto bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-4 md:px-6 sm:py-4 md:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs uppercase tracking-wider text-text-muted font-medium">Contact</span>
            <a
              href="mailto:michael.bbox@gmail.com"
              className="text-sm text-text-primary hover:text-primary transition-colors underline underline-offset-2 break-all"
            >
              michael.bbox@gmail.com
            </a>
            <span className="text-sm text-text-muted">© 2026 — Mikhael Baytelman</span>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <a
              href="https://mikegtc.com/live"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[48px] w-full sm:w-auto px-4 py-3 rounded-xl bg-gray-600 text-gray-300 font-semibold text-base active:bg-primary active:text-background transition-colors touch-manipulation hover:bg-gray-500 hover:text-white sm:min-h-[40px] sm:rounded-button sm:py-2 sm:text-sm sm:font-medium sm:bg-primary sm:text-background sm:hover:bg-primary-hover sm:active:bg-primary-active"
            >
              Back to Live
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
