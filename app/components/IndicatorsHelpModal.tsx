'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'

interface IndicatorsHelpModalProps {
  isOpen: boolean
  onClose: () => void
  followingMikegtcoff?: boolean | null
  timeXpActive?: boolean | null
  externalXpThisSession?: number
}

const MIKEY_TWITCH_URL = 'https://www.twitch.tv/mikegtcoff'

export default function IndicatorsHelpModal({
  isOpen,
  onClose,
  followingMikegtcoff,
  timeXpActive,
  externalXpThisSession = 0,
}: IndicatorsHelpModalProps) {
  const { t } = useLanguage()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicators-help-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[82vh] sm:max-h-[90vh] overflow-hidden rounded-xl bg-background-light border border-gray-800 shadow-xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-800/50 shrink-0 sm:px-4 sm:py-3">
          <h2 id="indicators-help-title" className="text-sm font-bold text-text-primary flex items-center gap-1.5 sm:text-base sm:gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 text-primary text-[10px] sm:text-xs font-bold">?</span>
            {t('indicators.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors touch-manipulation"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-2.5 scrollbar-thin sm:px-4 sm:py-4 sm:space-y-4">
          <p className="text-text-secondary text-[11px] leading-snug sm:text-xs">
            {t('indicators.intro')}
          </p>

          <div className="space-y-2 sm:space-y-3">
            <div className="p-2 rounded-lg border border-gray-800/50 bg-background-lighter/50 sm:p-3">
              <p className="font-semibold text-text-primary text-[10px] uppercase tracking-wider mb-1.5 sm:text-xs sm:mb-2">{t('indicators.timeXp')}</p>
              <p className="text-text-secondary text-[11px] leading-relaxed mb-1.5 sm:text-xs sm:mb-2">
                <span className={timeXpActive ? 'text-emerald-400' : 'text-text-muted'}>
                  {timeXpActive ? t('indicators.timeOn') : t('indicators.timeOff')}
                </span>
                — {t('indicators.timeXpDesc')}
              </p>
            </div>

            <div className="p-2 rounded-lg border border-gray-800/50 bg-background-lighter/50 sm:p-3">
              <p className="font-semibold text-text-primary text-[10px] uppercase tracking-wider mb-1.5 sm:text-xs sm:mb-2">{t('indicators.follow')}</p>
              <p className="text-text-secondary text-[11px] leading-relaxed mb-1.5 sm:text-xs sm:mb-2">
                <span className={
                  followingMikegtcoff === true ? 'text-emerald-400' : followingMikegtcoff === false ? 'text-amber-400' : 'text-text-muted'
                }>
                  {followingMikegtcoff === true ? t('indicators.following') : followingMikegtcoff === false ? t('indicators.notFollowing') : `— ${t('xp.unknown')}`}
                </span>
                — {t('indicators.followDesc')}
              </p>
              {followingMikegtcoff !== true && (
                <a
                  href={MIKEY_TWITCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-button bg-primary/20 hover:bg-primary/30 text-primary text-[11px] sm:text-xs font-medium border border-primary/30 transition-colors touch-manipulation sm:px-2.5 sm:py-1.5"
                >
                  {t('indicators.followBtn')}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            <div className="p-2 rounded-lg border border-gray-800/50 bg-background-lighter/50 sm:p-3">
              <p className="font-semibold text-text-primary text-[10px] uppercase tracking-wider mb-1.5 sm:text-xs sm:mb-2">{t('indicators.subDonation')}</p>
              <p className="text-text-secondary text-[11px] leading-relaxed sm:text-xs">
                {t('indicators.subDonationDesc').replace('{n}', String(externalXpThisSession))}
              </p>
            </div>

            <div className="p-2 rounded-lg border border-gray-800/50 bg-background-lighter/50 sm:p-3">
              <p className="font-semibold text-text-primary text-[10px] uppercase tracking-wider mb-1.5 sm:text-xs sm:mb-2">{t('indicators.ratings')}</p>
              <p className="text-text-secondary text-[11px] leading-relaxed sm:text-xs">
                <span className="text-text-muted">✓ / ○</span> — {t('indicators.ratingsDesc')}
              </p>
            </div>

            <div className="p-2 rounded-lg border border-gray-800/50 bg-background-lighter/50 sm:p-3">
              <p className="font-semibold text-text-primary text-[10px] uppercase tracking-wider mb-1.5 sm:text-xs sm:mb-2">{t('indicators.carry')}</p>
              <p className="text-text-secondary text-[11px] leading-relaxed sm:text-xs">
                {t('indicators.carryDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-gray-800/50 shrink-0 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-primary hover:bg-primary-hover text-background font-medium text-sm transition-colors touch-manipulation sm:py-2.5"
          >
            {t('indicators.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
