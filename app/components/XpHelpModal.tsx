'use client'

import { useEffect, useMemo } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'

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

const XP_BLOCK_KEYS = [
  {
    labelKey: 'xpHelp.timeXpLabel',
    subKey: 'xpHelp.timeXpSub',
    valueKey: null as string | null,
    value: '+5',
    accent: 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-400',
  },
  {
    labelKey: 'xpHelp.carryoverLabel',
    subKey: 'xpHelp.carryoverSub',
    valueKey: null,
    value: '+25',
    accent: 'border-amber-500/35 bg-amber-500/[0.08] text-amber-400',
  },
  {
    labelKey: 'xpHelp.followLabel',
    subKey: 'xpHelp.followSub',
    valueKey: null,
    value: '+25',
    accent: 'border-sky-500/35 bg-sky-500/[0.08] text-sky-400',
  },
  {
    labelKey: 'xpHelp.subDonationLabel',
    subKey: 'xpHelp.subDonationSub',
    valueKey: null,
    value: '+20',
    accent: 'border-fuchsia-500/35 bg-fuchsia-500/[0.08] text-fuchsia-400',
  },
  {
    labelKey: 'xpHelp.reviewLabel',
    subKey: 'xpHelp.reviewSub',
    valueKey: null,
    value: '10–60',
    accent: 'border-primary/40 bg-primary/[0.08] text-primary',
  },
  {
    labelKey: 'xpHelp.communityLabel',
    subKey: 'xpHelp.communitySub',
    valueKey: null,
    value: '10–20',
    accent: 'border-cyan-500/35 bg-cyan-500/[0.08] text-cyan-400',
  },
  {
    labelKey: 'xpHelp.useXpLabel',
    subKey: 'xpHelp.useXpSub',
    valueKey: 'xpHelp.valueUseXp',
    value: '100 XP = 1 spot',
    accent: 'border-gray-600/50 bg-background/50 text-text-primary',
  },
] as const

export default function XpHelpModal({ isOpen, onClose }: XpHelpModalProps) {
  const { t } = useLanguage()
  const blocks = useMemo(
    () =>
      XP_BLOCK_KEYS.map((b) => ({
        ...b,
        label: t(b.labelKey),
        sub: t(b.subKey),
        displayValue: b.valueKey ? t(b.valueKey) : b.value,
      })),
    [t]
  )

  const handleDismiss = () => {
    setXpHelpDismissed()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss closes modal
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="xp-help-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-background-light border-2 border-gray-700/60 shadow-2xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-700/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="xp-help-title"
                className="text-lg sm:text-xl font-extrabold text-text-primary tracking-tight"
              >
                {t('xp.howXpWorks')}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-text-secondary leading-relaxed max-w-2xl">
                {t('xpHelp.intro1')}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-text-muted leading-relaxed">
                {t('xpHelp.intro2')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-gray-600/50 text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors touch-manipulation"
              aria-label={t('common.close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6 scrollbar-thin">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
              {t('xpHelp.typesLabel')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {blocks.map((b) => (
                <div
                  key={b.labelKey}
                  className={`rounded-xl border px-3.5 py-3 ${b.accent}`}
                >
                  <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">
                    {b.displayValue}
                  </p>
                  <p className="mt-2 text-sm font-bold text-text-primary">{b.label}</p>
                  {b.sub && (
                    <p className="mt-1 text-[11px] sm:text-xs text-text-secondary leading-snug">
                      {b.sub}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <section className="rounded-xl border border-gray-700/50 bg-background/35 p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/90 mb-2">
                {t('xpHelp.communitySection')}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mb-3">
                {t('xpHelp.communityIntro')}
              </p>
              <ul className="space-y-2.5">
                <li className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2.5 text-xs sm:text-sm text-text-secondary leading-snug">
                  {t('xpHelp.communityViewersNote')}
                </li>
                <li className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2.5 text-xs sm:text-sm text-text-secondary leading-snug">
                  {t('xpHelp.communityParticipantsNote')}
                </li>
              </ul>
            </section>

            <section className="rounded-xl border border-gray-700/50 bg-background/35 p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                {t('xpHelp.howItWorks')}
              </p>
              <ul className="space-y-2.5">
                {[
                  t('xpHelp.followNote'),
                  t('xpHelp.reviewNote'),
                  t('xpHelp.communityXpNote'),
                  t('xpHelp.useXpNote'),
                ].map((note) => (
                  <li
                    key={note}
                    className="flex gap-2.5 text-xs sm:text-sm text-text-secondary leading-snug"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-700/50 bg-background-light">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto sm:min-w-[160px] sm:mx-auto sm:flex h-11 rounded-xl bg-primary hover:bg-primary-hover text-background font-bold text-sm transition-colors touch-manipulation items-center justify-center"
          >
            {t('xpHelp.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
