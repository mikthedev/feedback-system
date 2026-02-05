'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/app/context/LanguageContext'
import type { Locale } from '@/lib/translations'

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇺🇸',
  uk: '🇺🇦',
  de: '🇩🇪',
}

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
  de: 'Deutsch',
}

const LOCALES: Locale[] = ['en', 'uk', 'de']

export default function Footer() {
  const pathname = usePathname()
  const { locale, setLocale, t } = useLanguage()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [dropdownOpen])

  // Hide footer on login page
  if (pathname === '/') {
    return null
  }

  const handleSelectLocale = (loc: Locale) => {
    setLocale(loc)
    setDropdownOpen(false)
  }

  return (
    <footer className="relative w-full mt-auto bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-4 md:px-6 sm:py-4 md:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="text-xs uppercase tracking-wider text-text-muted font-bold">{t('footer.contact')}</span>
            <a
              href="mailto:michael.bbox@gmail.com"
              className="text-sm font-bold text-text-primary hover:text-primary transition-colors underline underline-offset-2 break-all"
            >
              michael.bbox@gmail.com
            </a>
            <span className="text-sm text-text-muted font-medium">{t('footer.copyright')}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0 w-full sm:w-auto">
            {/* Language dropdown: flag + label, opens list of languages */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className={`inline-flex items-center justify-center gap-2 min-h-[44px] pl-3 pr-3 sm:pl-4 sm:pr-4 rounded-xl border-2 bg-background-lighter touch-manipulation w-full sm:w-auto transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  dropdownOpen
                    ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_3px_rgba(202,247,111,0.15)]'
                    : 'border-gray-600/50 hover:border-primary/40 hover:bg-primary/10'
                }`}
                title={t('footer.language')}
                aria-label={t('footer.language')}
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
              >
                <span className="text-2xl drop-shadow-sm" aria-hidden>{LOCALE_FLAGS[locale]}</span>
                <span className="text-sm font-bold text-text-primary truncate max-w-[120px]">{LOCALE_LABELS[locale]}</span>
                <svg
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <ul
                  className="absolute bottom-full left-0 right-0 mb-2 py-1.5 rounded-2xl border-2 border-gray-700/60 bg-background-light/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] z-50 sm:left-0 sm:right-auto sm:min-w-[200px] animate-dropdown-in"
                  role="listbox"
                  aria-label={t('footer.language')}
                >
                  {LOCALES.map((loc, index) => (
                    <li
                      key={loc}
                      role="option"
                      aria-selected={locale === loc}
                      className="opacity-0 animate-dropdown-item-in px-1.5"
                      style={{ animationDelay: `${60 + index * 50}ms` }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectLocale(loc)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl text-sm font-medium touch-manipulation transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
                          locale === loc
                            ? 'bg-primary/25 text-primary shadow-sm'
                            : 'text-text-primary hover:bg-white/5 hover:text-primary/90'
                        }`}
                      >
                        <span className="text-xl drop-shadow-sm" aria-hidden>{LOCALE_FLAGS[loc]}</span>
                        <span>{LOCALE_LABELS[loc]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <a
              href="https://mikegtc.com/live"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[48px] w-full sm:w-auto px-4 py-3 rounded-xl bg-gray-600 text-gray-300 font-bold text-sm active:bg-primary active:text-background transition-colors touch-manipulation hover:bg-gray-500 hover:text-white sm:min-h-[44px] sm:rounded-lg border-2 border-transparent hover:border-primary/30 sm:bg-primary sm:text-background sm:hover:bg-primary-hover sm:active:bg-primary-active"
            >
              {t('footer.backToLive')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
