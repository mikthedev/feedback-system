'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative w-full mt-auto bg-background">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-wider text-text-muted font-medium">Contact</span>
            <a
              href="mailto:michael.bbox@gmail.com"
              className="text-text-primary hover:text-primary transition-colors underline underline-offset-2"
            >
              michael.bbox@gmail.com
            </a>
            <span className="text-text-muted">© 2026 — Mikhael Baytelman</span>
          </div>
          <div className="flex-shrink-0">
            <a
              href="https://mikegtc.com/live"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 rounded-button bg-primary text-background font-medium text-sm hover:bg-primary-hover transition-colors"
            >
              Back to Live
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
