'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

type XpLogEntry = {
  id: string
  amount: number
  source: string
  description?: string
  created_at: string
}

type AmountFilter = 'all' | 'gains' | 'spends'

const SOURCE_KEYS = [
  'time',
  'follow',
  'curator_review',
  'audience_review',
  'carryover',
  'sub',
  'donation',
  'queue_move',
  'queue_bump',
  'curator_grant',
  'adjust',
] as const

function labelFor(entry: XpLogEntry, t: (key: string) => string) {
  const key = `xpLog.source.${entry.source}`
  const translated = t(key)
  return translated !== key ? translated : entry.description || entry.source
}

export default function XpLogPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState<XpLogEntry[]>([])
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const me = await fetch('/api/auth/me')
        if (!me.ok) {
          router.push('/')
          return
        }
        const res = await fetch('/api/xp/log?limit=300', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setLog(data.log ?? [])
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [router])

  const availableSources = useMemo(() => {
    const present = new Set(log.map((e) => e.source))
    return SOURCE_KEYS.filter((s) => present.has(s))
  }, [log])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return log.filter((entry) => {
      if (amountFilter === 'gains' && entry.amount <= 0) return false
      if (amountFilter === 'spends' && entry.amount >= 0) return false
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false
      if (q) {
        const label = labelFor(entry, t).toLowerCase()
        const desc = (entry.description || '').toLowerCase()
        if (!label.includes(q) && !desc.includes(q) && !entry.source.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [log, amountFilter, sourceFilter, query, t])

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-8 pb-24">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm font-bold text-primary hover:underline"
            >
              {t('xp.logBack')}
            </Link>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight">
              {t('xp.logPageTitle')}
            </h1>
            <p className="mt-1 text-xs text-text-muted font-medium tabular-nums">
              {filtered.length}
              {filtered.length !== log.length ? ` / ${log.length}` : ''}{' '}
              {filtered.length === 1 ? t('xp.event') : t('xp.events')}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-gray-700/60 bg-background-light p-3 sm:p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-background border border-gray-700/50">
            {(
              [
                ['all', t('xp.logFilterAll')],
                ['gains', t('xp.logFilterGains')],
                ['spends', t('xp.logFilterSpends')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAmountFilter(id)}
                className={`min-h-[36px] rounded-lg text-xs font-bold transition-colors touch-manipulation ${
                  amountFilter === id
                    ? 'bg-primary/15 text-primary border border-primary/35'
                    : 'text-text-secondary border border-transparent hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="sr-only">{t('xp.logFilterSource')}</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-600/60 bg-background px-3 text-sm font-semibold text-text-primary"
              >
                <option value="all">{t('xp.logFilterAll')}</option>
                {availableSources.map((source) => {
                  const key = `xpLog.source.${source}`
                  const label = t(key)
                  return (
                    <option key={source} value={source}>
                      {label !== key ? label : source}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">{t('xp.logSearch')}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('xp.logSearch')}
                className="w-full h-10 rounded-xl border border-gray-600/60 bg-background px-3 text-sm font-medium text-text-primary placeholder:text-text-muted"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-gray-700/60 bg-background-light overflow-hidden">
          {loading ? (
            <p className="px-4 py-8 text-sm font-medium text-text-muted">{t('xp.loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm font-medium text-text-muted text-center">
              {log.length === 0 ? t('xp.noEvents') : t('xp.logEmptyFilter')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-700/40">
              {filtered.map((entry) => {
                const isPositive = entry.amount > 0
                const isNegative = entry.amount < 0
                return (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 px-3.5 sm:px-4 py-3 hover:bg-background-lighter/40 transition-colors"
                  >
                    <span
                      className={`shrink-0 mt-0.5 min-w-[3.5rem] text-right text-base font-black tabular-nums ${
                        isPositive ? 'text-primary' : isNegative ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      {entry.amount === 0
                        ? '—'
                        : `${entry.amount > 0 ? '+' : ''}${entry.amount}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-primary leading-snug">
                        {labelFor(entry, t)}
                      </p>
                      {entry.description &&
                        entry.description !== labelFor(entry, t) && (
                          <p className="mt-0.5 text-xs text-text-secondary leading-snug">
                            {entry.description}
                          </p>
                        )}
                      <p className="mt-1 text-[11px] text-text-muted font-medium tabular-nums">
                        {new Date(entry.created_at).toLocaleString(undefined, {
                          year: 'numeric',
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
      </div>
    </div>
  )
}
