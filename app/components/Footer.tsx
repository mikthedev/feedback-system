'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'

  return (
    <footer className="relative w-full mt-auto bg-background">
      {/* Subtle divider edge that appears during scroll reveal */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/60 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-800/40 to-transparent opacity-50" />

      {/* Upper footer: How XP works (dashboard only) */}
      {isDashboard && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-5">
          <div className="flex justify-end">
            <Link
              href="/dashboard#show-xp-help"
              className="text-xs font-medium text-text-secondary hover:text-primary transition-colors duration-200 underline underline-offset-2"
            >
              How XP works
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
          {/* Left side: Contact info */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-text-secondary font-medium">
                CONTACT
              </span>
              <a
                href="mailto:michael.bbox@gmail.com"
                className="text-sm text-text-primary hover:text-primary transition-colors duration-200 underline underline-offset-2 decoration-text-secondary hover:decoration-primary"
              >
                michael.bbox@gmail.com
              </a>
            </div>
            <p className="text-xs text-text-muted mt-2">
              © 2026 — Mikhael Baytelman
            </p>
          </div>

          {/* Right side: Back to Live button */}
          <div className="flex-shrink-0">
            <a
              href="https://mikegtc.com/live"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-button bg-primary text-background font-medium text-sm hover:bg-primary-hover active:bg-primary-active transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] button-press"
            >
              Back to Live
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
