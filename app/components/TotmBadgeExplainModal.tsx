'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '@/app/context/LanguageContext'
import { TotmMedalIcon, TotmSkipIcon } from './TotmLeaderboardIcon'

type TotmBadgeExplainModalProps = {
  isOpen: boolean
  onClose: () => void
  rank?: number | null
  songTitle?: string | null
  monthLabel?: string | null
}

type CardKey = 'why' | 'now' | 'stay' | 'drop'

function WhyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.5 2 2 5.5v14h5V22l2.5-2.5H14L20.5 13V2H4.5zm14.5 10-3.5 3.5H12l-2.5 2.5V15.5H6.5v-12H19v8.5zM15 6.5h1.5v4.5H15V6.5zm-4 0H12.5v4.5H11V6.5z" />
    </svg>
  )
}

function DropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v10m0 0-3.5-3.5M12 15l3.5-3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
    </svg>
  )
}

const CARDS: Array<{
  key: CardKey
  titleKey: string
  bodyKey: string
  tipKey: string
  accent: string
  Icon: ComponentType<{ className?: string }>
}> = [
  {
    key: 'why',
    titleKey: 'totm.explainWhyTitle',
    bodyKey: 'totm.explainWhyBody',
    tipKey: 'totm.explainWhyTip',
    accent: 'hover:border-emerald-400/50 hover:bg-emerald-500/10',
    Icon: WhyIcon,
  },
  {
    key: 'now',
    titleKey: 'totm.explainNowTitle',
    bodyKey: 'totm.explainNowBody',
    tipKey: 'totm.explainNowTip',
    accent: 'hover:border-violet-400/50 hover:bg-violet-500/10',
    Icon: TwitchIcon,
  },
  {
    key: 'stay',
    titleKey: 'totm.explainStayTitle',
    bodyKey: 'totm.explainStayBody',
    tipKey: 'totm.explainStayTip',
    accent: 'hover:border-amber-400/50 hover:bg-amber-500/10',
    Icon: TotmSkipIcon,
  },
  {
    key: 'drop',
    titleKey: 'totm.explainDropTitle',
    bodyKey: 'totm.explainDropBody',
    tipKey: 'totm.explainDropTip',
    accent: 'hover:border-sky-400/50 hover:bg-sky-500/10',
    Icon: DropIcon,
  },
]

export default function TotmBadgeExplainModal({
  isOpen,
  onClose,
  rank,
  songTitle,
  monthLabel,
}: TotmBadgeExplainModalProps) {
  const { t } = useLanguage()
  const [active, setActive] = useState<CardKey | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) setActive(null)
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const metaParts = [
    rank != null ? `#${rank}` : null,
    songTitle?.trim() || null,
    monthLabel || null,
  ].filter(Boolean)

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="totm-explain-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-background-light border-2 border-gray-700/60 shadow-2xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-gray-700/50">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
              <TotmMedalIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="totm-explain-title"
                className="text-lg sm:text-xl font-extrabold text-text-primary tracking-tight leading-snug"
              >
                {t('totm.explainTitle')}
              </h2>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                {t('totm.explainIntro')}
              </p>
              {metaParts.length > 0 && (
                <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary truncate">
                  {metaParts.join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-gray-600/50 text-text-muted hover:text-text-primary hover:bg-background-lighter transition-colors touch-manipulation"
              aria-label={t('common.close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 sm:px-7 py-5 sm:py-6 space-y-4 scrollbar-thin">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {t('totm.explainHint')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {CARDS.map((card) => {
              const isActive = active === card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  onMouseEnter={() => setActive(card.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(card.key)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive((prev) => (prev === card.key ? null : card.key))}
                  className={`group text-left rounded-2xl border border-gray-700/55 bg-background/40 px-4 sm:px-5 py-4 transition-all duration-200 touch-manipulation ${card.accent} ${
                    isActive ? 'border-primary/45 bg-primary/10 scale-[1.015] shadow-lg shadow-black/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-600/40 bg-background-light text-text-secondary transition-colors duration-200 ${
                        isActive ? 'border-primary/40 text-primary bg-primary/10' : 'group-hover:border-primary/35 group-hover:text-primary'
                      }`}
                    >
                      <card.Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </span>
                    <p className="text-[15px] font-extrabold text-text-primary leading-snug">
                      {t(card.titleKey)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                    {t(card.bodyKey)}
                  </p>
                  <div
                    className={`grid transition-all duration-200 ease-out ${
                      isActive ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs sm:text-sm font-semibold text-primary leading-snug">
                        {t(card.tipKey)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-gray-700/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl border-2 border-primary/40 bg-primary/15 text-primary text-sm font-extrabold hover:bg-primary/25 transition-colors touch-manipulation"
          >
            {t('totm.explainGotIt')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
