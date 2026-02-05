'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/app/context/LanguageContext'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const handleTwitchLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/twitch'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6 sm:px-4 sm:py-6 animate-page-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="bg-background-light rounded-xl sm:rounded-2xl p-6 sm:p-6 md:p-8 max-w-md w-full border-2 border-gray-700/60 shadow-xl">
        <div className="text-center mb-6 animate-fade-in">
          <h1 className="text-xl font-extrabold mb-4 text-text-primary leading-tight sm:text-3xl md:text-4xl tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-text-secondary text-sm font-medium leading-relaxed sm:text-base">
            {t('home.subtitle')}
          </p>
        </div>
        <button
          onClick={handleTwitchLogin}
          disabled={loading}
          className="relative w-full min-h-[52px] bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-bold py-4 px-5 rounded-xl text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] button-press touch-manipulation border-2 border-transparent hover:border-primary/30"
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
    </div>
  )
}
