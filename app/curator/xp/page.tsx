'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

type XpRow = { id: string; display_name: string; xp: number }

export default function CuratorAllUsersXpPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [rows, setRows] = useState<XpRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users/xp', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data.users) ? data.users : []
      setRows(
        list.map((u: { id: string; display_name: string; xp: number }) => ({
          id: u.id,
          display_name: typeof u.display_name === 'string' ? u.display_name : 'Unknown',
          xp: Math.max(0, Math.floor(Number(u.xp) || 0)),
        }))
      )
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.user?.role !== 'curator') {
          router.push('/dashboard')
          return
        }
      } catch {
        router.push('/')
        return
      }
      if (!cancelled) {
        setLoadingAuth(false)
        fetchList()
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [router, fetchList])

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-text-primary">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-2.5 sm:px-4 md:px-6 py-4 sm:py-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-page-transition">
      <div className="max-w-3xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/curator"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors mb-2 touch-manipulation"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('curator.backToPanel')}
            </Link>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
              {t('curator.allUsersXp')}{' '}
              <span className="text-text-muted font-semibold tabular-nums">({rows.length})</span>
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-xl leading-relaxed">{t('curator.xpListHint')}</p>
          </div>
          <button
            type="button"
            onClick={fetchList}
            disabled={loading}
            className="shrink-0 min-h-[44px] px-4 py-2.5 text-sm font-bold rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border-2 border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] button-press touch-manipulation w-full sm:w-auto"
          >
            {loading ? '…' : t('curator.refreshXp')}
          </button>
        </div>

        <div className="bg-background-light rounded-xl sm:rounded-2xl shadow-lg border-2 border-gray-700/60 overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-text-secondary">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-text-secondary">{t('curator.noUsersWithXp')}</div>
          ) : (
            <ul className="divide-y divide-gray-800/50 max-h-[min(70vh,720px)] overflow-y-auto scrollbar-hide">
              {rows.map((row, i) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-background/50 transition-colors"
                >
                  <span className="w-8 sm:w-10 shrink-0 text-center text-xs sm:text-sm font-extrabold text-text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 text-sm sm:text-base font-semibold text-text-primary truncate">
                    {row.display_name}
                  </span>
                  <span className="text-base sm:text-lg font-black text-primary tabular-nums shrink-0">{row.xp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
