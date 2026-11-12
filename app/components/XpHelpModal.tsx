'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

const CARD_ACCENT =
  'border-2 border-gray-700/60 bg-background-lighter hover:border-primary/40 hover:bg-primary/[0.06]'
const CARD_VALUE = 'text-primary'

const XP_BLOCK_KEYS = [
  {
    labelKey: 'xpHelp.timeXpLabel',
    subKey: 'xpHelp.timeXpSub',
    valueKey: null as string | null,
    value: '+5',
  },
  {
    labelKey: 'xpHelp.carryoverLabel',
    subKey: 'xpHelp.carryoverSub',
    valueKey: null,
    value: '+25',
  },
  {
    labelKey: 'xpHelp.followLabel',
    subKey: 'xpHelp.followSub',
    valueKey: null,
    value: '+25',
  },
  {
    labelKey: 'xpHelp.subDonationLabel',
    subKey: 'xpHelp.subDonationSub',
    valueKey: null,
    value: '+20',
  },
  {
    labelKey: 'xpHelp.reviewLabel',
    subKey: 'xpHelp.reviewSub',
    valueKey: null,
    value: '10–60',
  },
  {
    labelKey: 'xpHelp.communityLabel',
    subKey: 'xpHelp.communitySub',
    valueKey: null,
    value: '10–20',
  },
  {
    labelKey: 'xpHelp.useXpLabel',
    subKey: 'xpHelp.useXpSub',
    valueKey: 'xpHelp.valueUseXp',
    value: '100 XP = 1 spot',
  },
] as const

export default function XpHelpModal({ isOpen, onClose }: XpHelpModalProps) {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
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
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss closes modal
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in"
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
        <div className="shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-gray-700/50">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="xp-help-title"
                className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight"
              >
                {t('xp.howXpWorks')}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl">
                {t('xpHelp.intro1')}
              </p>
              <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
                {t('xpHelp.intro2')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-gray-600/50 text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors touch-manipulation"
              aria-label={t('common.close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 sm:px-7 py-5 sm:py-6 space-y-6 scrollbar-thin">
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
              {t('xpHelp.typesLabel')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
              {blocks.map((b) => (
                <div
                  key={b.labelKey}
                  className={`rounded-xl border px-4 py-3.5 transition-all duration-200 hover:scale-[1.015] hover:shadow-md hover:shadow-black/15 ${CARD_ACCENT}`}
                >
                  <p className={`text-2xl font-black tabular-nums leading-none ${CARD_VALUE}`}>
                    {b.displayValue}
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-text-primary leading-snug">
                    {b.label}
                  </p>
                  {b.sub && (
                    <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{b.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            <section className="rounded-xl border-2 border-primary/30 bg-background-lighter p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-primary/35 bg-primary/10 text-primary">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </span>
                <p className="text-base font-extrabold text-text-primary leading-snug">
                  {t('xpHelp.communitySection')}
                </p>
              </div>
              <p className="text-sm text-text-primary/90 leading-relaxed">
                {t('xpHelp.communityIntroLead')}
              </p>
              <div className="mt-3 mb-3 flex flex-wrap items-center gap-2">
                <code className="inline-flex items-center rounded-lg border-2 border-primary/40 bg-primary/10 px-2.5 py-1.5 font-mono text-sm font-bold text-primary tracking-tight">
                  {t('xpHelp.communityCommand')}
                </code>
                <span className="text-sm text-text-secondary font-medium">
                  {t('xpHelp.communityCommandHint')}
                </span>
              </div>
              <p className="text-sm text-text-primary/90 leading-relaxed mb-4">
                {t('xpHelp.communityIntroTail')}
              </p>
              <ul className="space-y-2.5">
                <li className="flex gap-3 rounded-xl border-2 border-gray-700/55 bg-background px-3.5 py-3 text-sm text-text-primary leading-relaxed">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/10 text-primary" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </span>
                  <span>{t('xpHelp.communityViewersNote')}</span>
                </li>
                <li className="flex gap-3 rounded-xl border-2 border-gray-700/55 bg-background px-3.5 py-3 text-sm text-text-primary leading-relaxed">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/10 text-primary" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </span>
                  <span>{t('xpHelp.communityParticipantsNote')}</span>
                </li>
              </ul>
            </section>

            <section className="rounded-xl border-2 border-primary/30 bg-background-lighter p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-primary/35 bg-primary/10 text-primary">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </span>
                <p className="text-base font-extrabold text-text-primary leading-snug">
                  {t('xpHelp.howItWorks')}
                </p>
              </div>
              <ul className="space-y-2.5">
                {(
                  [
                    {
                      key: 'order',
                      text: t('xpHelp.ruleOrder'),
                      icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h6" />
                        </svg>
                      ),
                    },
                    {
                      key: 'future',
                      text: t('xpHelp.ruleFuture'),
                      icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                    },
                    {
                      key: 'use',
                      text: t('xpHelp.ruleUse'),
                      icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ),
                    },
                    {
                      key: 'follow',
                      text: t('xpHelp.ruleFollow'),
                      icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ),
                    },
                  ] as const
                ).map((row) => (
                  <li
                    key={row.key}
                    className="flex gap-3 rounded-xl border-2 border-gray-700/55 bg-background px-3.5 py-3 text-sm text-text-primary leading-relaxed"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/10 text-primary" aria-hidden>
                      {row.icon}
                    </span>
                    <span>{row.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-gray-700/50 bg-background-light">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full min-h-[48px] rounded-xl border border-gray-600/55 bg-background-lighter text-text-primary text-sm font-extrabold hover:border-primary/45 hover:bg-primary/10 transition-colors touch-manipulation"
          >
            {t('xpHelp.gotIt')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
