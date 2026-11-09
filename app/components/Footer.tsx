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
  const phoneDropdownRef = useRef<HTMLDivElement>(null)
  const desktopDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inPhone = phoneDropdownRef.current?.contains(target)
      const inDesktop = desktopDropdownRef.current?.contains(target)
      if (!inPhone && !inDesktop) setDropdownOpen(false)
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

  // Dashboard has a fixed bottom tab bar on phone
  const clearMobileDock = pathname === '/dashboard'

  return (
    <footer
      className={`relative w-full mt-auto bg-background ${
        clearMobileDock
          ? 'pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-[env(safe-area-inset-bottom)]'
          : 'pb-[env(safe-area-inset-bottom)]'
      }`}
    >
      {/* Phone: polished utility bar — Live centered, side actions balanced */}
      <div className="sm:hidden border-t border-gray-700/60 bg-background-light/85 backdrop-blur-sm">
        <div className="px-2.5 py-2">
          <div className="rounded-xl border border-gray-700/45 bg-background/50 p-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
              {/* Left: language */}
              <div className="flex justify-start min-w-0" ref={phoneDropdownRef}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className={`inline-flex items-center gap-1.5 h-9 pl-2 pr-2.5 rounded-lg border touch-manipulation transition-colors ${
                      dropdownOpen
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-gray-600/40 bg-background-lighter text-text-secondary'
                    }`}
                    title={t('footer.language')}
                    aria-label={t('footer.language')}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="text-[16px] leading-none" aria-hidden>
                      {LOCALE_FLAGS[locale]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      {locale}
                    </span>
                  </button>
                  {dropdownOpen && (
                    <ul
                      className="absolute bottom-full left-0 mb-2 py-1 rounded-xl border border-gray-700/60 bg-background-light/95 backdrop-blur-md shadow-lg z-50 min-w-[156px] animate-dropdown-in"
                      role="listbox"
                      aria-label={t('footer.language')}
                    >
                      {LOCALES.map((loc) => (
                        <li key={loc} role="option" aria-selected={locale === loc}>
                          <button
                            type="button"
                            onClick={() => handleSelectLocale(loc)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium touch-manipulation ${
                              locale === loc
                                ? 'bg-primary/20 text-primary'
                                : 'text-text-primary hover:bg-white/5'
                            }`}
                          >
                            <span className="text-base" aria-hidden>
                              {LOCALE_FLAGS[loc]}
                            </span>
                            <span>{LOCALE_LABELS[loc]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Center: Live */}
              <a
                href="https://mikegtc.com/live"
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-background font-extrabold text-xs tracking-wide touch-manipulation active:scale-[0.98] transition-transform"
              >
                <span className="h-1.5 w-1.5 rounded-sm bg-background/90" aria-hidden />
                {t('footer.backToLiveShort')}
              </a>

              {/* Right: legal */}
              <div className="flex items-center justify-end gap-1 min-w-0">
                <Link
                  href="/terms"
                  className="inline-flex items-center justify-center h-9 px-2.5 rounded-lg border border-gray-600/40 bg-background-lighter text-[10px] font-bold text-text-secondary touch-manipulation active:border-primary/40 active:text-primary"
                >
                  {t('footer.termsShort')}
                </Link>
                <Link
                  href="/privacy"
                  className="inline-flex items-center justify-center h-9 px-2.5 rounded-lg border border-gray-600/40 bg-background-lighter text-[10px] font-bold text-text-secondary touch-manipulation active:border-primary/40 active:text-primary"
                >
                  {t('footer.privacyShort')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop / tablet: existing richer footer */}
      <div className="hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3">
          <div className="rounded-xl border border-gray-700/50 bg-background-light/30 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-1.5">
                <a
                  href="mailto:michael.bbox@gmail.com"
                  className="text-sm font-bold text-text-primary hover:text-primary transition-colors underline underline-offset-2 truncate"
                >
                  michael.bbox@gmail.com
                </a>
                <span className="text-sm text-text-muted font-medium">{t('footer.copyright')}</span>
              </div>
              <div className="flex flex-row items-center gap-2 flex-shrink-0 w-full lg:w-auto">
                <div className="relative" ref={desktopDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className={`inline-flex items-center justify-center gap-2 min-h-[40px] pl-3.5 pr-3.5 rounded-xl border-2 bg-background-lighter touch-manipulation transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      dropdownOpen
                        ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_3px_rgba(202,247,111,0.15)]'
                        : 'border-gray-600/50 hover:border-primary/40 hover:bg-primary/10'
                    }`}
                    title={t('footer.language')}
                    aria-label={t('footer.language')}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="text-2xl drop-shadow-sm" aria-hidden>
                      {LOCALE_FLAGS[locale]}
                    </span>
                    <span className="text-sm font-bold text-text-primary truncate max-w-[120px]">
                      {LOCALE_LABELS[locale]}
                    </span>
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
                      className="absolute bottom-full left-0 mb-2 py-1.5 rounded-2xl border-2 border-gray-700/60 bg-background-light/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] z-50 min-w-[200px] animate-dropdown-in"
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
                            <span className="text-xl drop-shadow-sm" aria-hidden>
                              {LOCALE_FLAGS[loc]}
                            </span>
                            <span>{LOCALE_LABELS[loc]}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <a
                  href="https://mikegtc.com/live"
                  className="inline-flex items-center justify-center min-h-[40px] px-3 py-2 rounded-lg bg-primary text-background font-bold text-sm transition-colors touch-manipulation hover:bg-primary-hover active:bg-primary-active"
                >
                  {t('footer.backToLive')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
