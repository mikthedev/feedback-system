'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const handleTwitchLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/twitch'
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-4 sm:py-6 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[24rem] flex-col items-center justify-center sm:min-h-[calc(100vh-3rem)] sm:max-w-md">
        <div className="w-full bg-background-light rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border-2 border-gray-700/60 shadow-xl">
          <div className="text-center mb-4 sm:mb-6 animate-fade-in">
            <h1 className="text-lg font-extrabold mb-2 sm:mb-4 text-text-primary leading-tight sm:text-3xl md:text-4xl tracking-tight">
              {t('home.title')}
            </h1>
            <p className="text-text-secondary text-sm font-medium leading-snug sm:leading-relaxed sm:text-base">
              {t('home.subtitle')}
            </p>
          </div>
          <button
            onClick={handleTwitchLogin}
            disabled={loading}
            className="relative w-full min-h-[48px] sm:min-h-[52px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-bold py-3 px-4 sm:py-4 sm:px-5 rounded-xl text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] button-press touch-manipulation border-2 border-transparent hover:border-primary/30"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden />
            <span className="relative flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714V11.143z"/>
              </svg>
              {loading ? t('home.connecting') : t('home.loginTwitch')}
            </span>
          </button>
        </div>
        <div className="mt-4 grid w-full grid-cols-2 items-stretch gap-2">
          <Link
            href="/terms"
            className="inline-flex h-full min-h-[56px] items-center justify-center rounded-xl border-2 border-gray-600/50 bg-background-lighter px-2.5 py-2 text-center text-sm font-bold leading-tight text-text-primary transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-primary/40 hover:bg-primary/10 sm:min-h-[40px] sm:px-3"
          >
            {t('home.termsOfService')}
          </Link>
          <Link
            href="/privacy"
            className="inline-flex h-full min-h-[56px] items-center justify-center rounded-xl border-2 border-gray-600/50 bg-background-lighter px-2.5 py-2 text-center text-sm font-bold leading-tight text-text-primary transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-primary/40 hover:bg-primary/10 sm:min-h-[40px] sm:px-3"
          >
            {t('home.privacyPolicy')}
          </Link>
        </div>
        </div>
    </div>
  )
}
