'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'
import TesterToolsPanel from '../components/TesterToolsPanel'

export default function LabToolsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'curator' | 'tester' | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        const r = data.user?.role as string | undefined
        if (r !== 'curator' && r !== 'tester') {
          router.push('/dashboard')
          return
        }
        if (!cancelled) setRole(r)
      } catch {
        router.push('/')
        return
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-text-primary">{t('common.loading')}</div>
      </div>
    )
  }

  const backHref = role === 'curator' ? '/curator' : '/dashboard'
  const backLabel = role === 'curator' ? t('curator.backToPanel') : t('common.dashboard')

  return (
    <div className="min-h-screen bg-background px-2.5 sm:px-4 md:px-6 py-4 sm:py-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-page-transition">
      <div className="max-w-3xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors mb-2 touch-manipulation"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            {role === 'curator' ? t('lab.curatorBadge') : t('lab.testerBadge')}
          </p>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            {t('lab.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-2 max-w-xl leading-relaxed">
            {t('lab.pageHint')}
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border-2 border-amber-500/35 bg-amber-500/[0.04] shadow-lg p-3 sm:p-5">
          <TesterToolsPanel role={role} variant="page" />
        </div>
      </div>
    </div>
  )
}
