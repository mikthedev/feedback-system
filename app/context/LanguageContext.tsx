'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  type Locale,
  getStoredLocale,
  setStoredLocale,
  getTranslation,
} from '@/lib/translations'

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return ctx
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLocaleState(getStoredLocale())
    setMounted(true)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    setStoredLocale(next)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next === 'uk' ? 'uk' : next === 'de' ? 'de' : 'en'
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = locale === 'uk' ? 'uk' : locale === 'de' ? 'de' : 'en'
  }, [mounted, locale])

  const t = useCallback(
    (key: string) => getTranslation(locale, key),
    [locale]
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
