'use client'

import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'
import type { Locale } from '@/lib/translations'

type XpLogEntry = {
  id: string
  amount: number
  source: string
  description?: string
  created_at: string
}

interface MobileXpPaneProps {
  xp: number
  xpUsedThisSession: number
  usedCap: number | null
  useXpAllowed: boolean
  useXpReason: string
  useXpLoading: boolean
  useXpClicking: boolean
  onUseXp: () => void
  onShowXpHelp: () => void
  xpLog: XpLogEntry[]
  loadingLog: boolean
}

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇺🇸',
  uk: '🇺🇦',
  de: '🇩🇪',
}

const LOCALES: Locale[] = ['en', 'uk', 'de']

function formatReason(reason: string, t: (key: string) => string) {
  if (
    reason === 'NO_OPEN_SESSION' ||
    /no open session/i.test(reason) ||
    /submissions are closed/i.test(reason)
  ) {
    return t('xp.noOpenSession')
  }
  return reason || t('xpHelp.unknownReason')
}

function formatLogLabel(entry: XpLogEntry, t: (key: string) => string) {
  const key = `xpLog.source.${entry.source}`
  const translated = t(key)
  return translated !== key ? translated : entry.description || entry.source
}

export default function MobileXpPane({
  xp,
  xpUsedThisSession,
  usedCap,
  useXpAllowed,
  useXpReason,
  useXpLoading,
  useXpClicking,
  onUseXp,
  onShowXpHelp,
  xpLog,
  loadingLog,
}: MobileXpPaneProps) {
  const { t, locale, setLocale } = useLanguage()
  const charge = xp < 9999 ? (xp % 100 === 0 && xp > 0 ? 100 : xp % 100) : 0
  const preview = xpLog.slice(0, 5)

  return (
    <div className="space-y-3 animate-fade-in lg:hidden">
      {/* XP hero */}
      <section className="rounded-2xl border-2 border-gray-700/60 bg-background-light overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {t('xp.stored')}
              </p>
              <p
                className={`mt-1 text-4xl font-black text-primary tabular-nums leading-none ${
                  xp >= 100 ? 'animate-xp-number-pulse' : ''
                }`}
              >
                {xp}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {t('xp.used')}
              </p>
              <p className="mt-1 text-xl font-extrabold text-text-primary tabular-nums leading-none">
                {xpUsedThisSession}
                {usedCap != null ? (
                  <span className="text-sm font-semibold text-text-muted">/{usedCap}</span>
                ) : (
                  <span className="text-[10px] font-semibold text-text-muted ml-1">
                    ({t('common.noLimit')})
                  </span>
                )}
              </p>
            </div>
          </div>

          {xp < 9999 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {charge === 100
                    ? t('dashboard.useXpStatusReady')
                    : t('dashboard.useXpToGoLine').replace(/\{n\}/g, String(100 - charge))}
                </span>
                <span className="text-[10px] font-bold text-primary tabular-nums">{charge}/100</span>
              </div>
              <div
                className={`xp-battery h-4 w-full ${useXpAllowed ? 'xp-battery-ready' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={charge}
              >
                {charge > 0 && (
                  <div
                    className="xp-battery-fill"
                    style={{ width: `max(0px, calc(${charge}% - 4px))` }}
                  />
                )}
                <div className="xp-battery-cells" aria-hidden>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onUseXp}
            disabled={!useXpAllowed || useXpLoading}
            title={
              useXpAllowed
                ? t('dashboard.spend100XpPosition')
                : formatReason(useXpReason, t)
            }
            className={`w-full h-12 rounded-xl font-bold text-sm touch-manipulation transition-all ${
              useXpAllowed
                ? 'bg-primary text-background shadow-md shadow-primary/20 active:scale-[0.99]'
                : 'bg-background-lighter text-text-muted border border-gray-700/60 cursor-not-allowed'
            } ${useXpClicking ? 'animate-use-xp-click' : ''} ${useXpLoading ? 'opacity-70' : ''}`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {useXpLoading ? '…' : t('dashboard.useXp')}
            </span>
          </button>
        </div>
      </section>

      {/* Status */}
      <section
        className={`rounded-2xl border-2 px-4 py-3.5 ${
          useXpAllowed
            ? 'border-primary/40 bg-primary/[0.08]'
            : 'border-gray-700/60 bg-background-light'
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
          {t('xp.statusTitle')}
        </p>
        <p
          className={`text-sm font-semibold leading-snug ${
            useXpAllowed ? 'text-primary' : 'text-text-primary'
          }`}
        >
          {useXpAllowed
            ? t('dashboard.useXpStatusReady')
            : formatReason(useXpReason, t)}
        </p>
      </section>

      {/* How XP works */}
      <button
        type="button"
        onClick={onShowXpHelp}
        className="w-full min-h-[48px] flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 text-primary font-bold text-sm hover:bg-primary/15 transition-colors touch-manipulation"
      >
        <span className="inline-flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('xp.howXpWorks')}
        </span>
        <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* XP log preview */}
      <section className="rounded-2xl border-2 border-gray-700/60 bg-background-light overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-700/45">
          <p className="text-sm font-extrabold text-text-primary">{t('xp.xpLog')}</p>
          {xpLog.length > 0 && (
            <span className="text-[10px] font-bold text-text-muted tabular-nums">
              {xpLog.length} {xpLog.length === 1 ? t('xp.event') : t('xp.events')}
            </span>
          )}
        </div>
        <div className="px-3 py-2">
          {loadingLog ? (
            <p className="px-1 py-3 text-sm text-text-muted font-medium">{t('xp.loading')}</p>
          ) : preview.length === 0 ? (
            <p className="px-1 py-3 text-sm text-text-muted font-medium">{t('xp.noEvents')}</p>
          ) : (
            <ul className="divide-y divide-gray-700/35">
              {preview.map((entry) => {
                const isPositive = entry.amount > 0
                const isNegative = entry.amount < 0
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5 px-1">
                    <span
                      className={`shrink-0 min-w-[3rem] text-right text-sm font-black tabular-nums ${
                        isPositive ? 'text-primary' : isNegative ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      {entry.amount === 0
                        ? '—'
                        : `${entry.amount > 0 ? '+' : ''}${entry.amount}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {formatLogLabel(entry, t)}
                      </p>
                      <p className="text-[10px] text-text-muted tabular-nums mt-0.5">
                        {new Date(entry.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {xpLog.length > 5 && (
          <div className="px-3 pb-3">
            <Link
              href="/xp/log"
              className="w-full min-h-[40px] inline-flex items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary text-xs font-bold touch-manipulation"
            >
              {t('xp.viewFullLog')}
            </Link>
          </div>
        )}
      </section>

      {/* Compact utilities: language + live (replaces phone footer) */}
      <section className="rounded-2xl border border-gray-700/50 bg-background-light/80 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={`h-9 min-w-[2.5rem] px-2 rounded-lg border text-sm font-bold touch-manipulation transition-colors ${
                  locale === loc
                    ? 'border-primary/45 bg-primary/15 text-primary'
                    : 'border-gray-700/50 bg-background text-text-muted'
                }`}
                aria-label={loc}
                aria-pressed={locale === loc}
              >
                <span aria-hidden>{LOCALE_FLAGS[loc]}</span>
              </button>
            ))}
          </div>
          <a
            href="https://mikegtc.com/live"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-background text-xs font-extrabold touch-manipulation active:scale-[0.98]"
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-background/90" aria-hidden />
            {t('footer.backToLiveShort')}
          </a>
        </div>
      </section>
    </div>
  )
}
