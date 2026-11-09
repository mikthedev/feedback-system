'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/app/context/LanguageContext'

type Role = 'curator' | 'tester' | string

type LabToggles = {
  xpAdjust: boolean
  grantXp: boolean
  totmSim: boolean
  totmManage: boolean
}

type GrantUser = { id: string; display_name: string }

type TotmStatus = {
  featured_artist: { awarded_at: string } | null
  available_skips: number
  skips: Array<{ id: string; status: string; label: string }>
}

const STORAGE_KEY = 'dfs_lab_tools_toggles'

const DEFAULT_TOGGLES: LabToggles = {
  xpAdjust: false,
  grantXp: false,
  totmSim: false,
  totmManage: false,
}

function loadToggles(): LabToggles {
  if (typeof window === 'undefined') return DEFAULT_TOGGLES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TOGGLES
    const parsed = JSON.parse(raw) as Partial<LabToggles>
    return {
      xpAdjust: !!parsed.xpAdjust,
      grantXp: !!parsed.grantXp,
      totmSim: !!parsed.totmSim,
      totmManage: !!parsed.totmManage,
    }
  } catch {
    return DEFAULT_TOGGLES
  }
}

type TesterToolsPanelProps = {
  role: Role
  className?: string
  /** page = always expanded on a dedicated Lab page (no accordion chrome) */
  variant?: 'embedded' | 'page'
  onTotmChanged?: () => void
  onXpChanged?: () => void
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-gray-700/50 bg-background/40 px-2.5 py-2 hover:border-amber-500/30 transition-colors">
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-gray-700 peer-checked:bg-amber-500/80 transition-colors" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs sm:text-sm font-bold text-text-primary leading-tight">
          {label}
        </span>
        <span className="block text-[10px] sm:text-xs text-text-muted font-medium leading-snug mt-0.5">
          {description}
        </span>
      </span>
    </label>
  )
}

export default function TesterToolsPanel({
  role,
  className = '',
  variant = 'embedded',
  onTotmChanged,
  onXpChanged,
}: TesterToolsPanelProps) {
  const { t } = useLanguage()
  const isCurator = role === 'curator'
  const isTester = role === 'tester'
  const canUseLab = isCurator || isTester
  const isPage = variant === 'page'

  const [open, setOpen] = useState(variant === 'page')
  const [toggles, setToggles] = useState<LabToggles>(DEFAULT_TOGGLES)

  const [xpValue, setXpValue] = useState('')
  const [xpLoading, setXpLoading] = useState(false)
  const [xpMessage, setXpMessage] = useState<string | null>(null)

  const [grantTargetId, setGrantTargetId] = useState('self')
  const [grantAmount, setGrantAmount] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantMessage, setGrantMessage] = useState<string | null>(null)

  const [simLoading, setSimLoading] = useState(false)
  const [simMessage, setSimMessage] = useState<string | null>(null)

  const [users, setUsers] = useState<GrantUser[]>([])
  const [targetId, setTargetId] = useState('self')
  const [status, setStatus] = useState<TotmStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageMessage, setManageMessage] = useState<string | null>(null)
  const [selfUserId, setSelfUserId] = useState<string | null>(null)

  useEffect(() => {
    setToggles(loadToggles())
  }, [])

  const setToggle = (key: keyof LabToggles, value: boolean) => {
    setToggles((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const resolveTargetId = useCallback(async () => {
    if (targetId !== 'self' && targetId) return targetId
    if (selfUserId) return selfUserId
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    const json = await res.json()
    const id = json?.user?.id as string | undefined
    if (id) setSelfUserId(id)
    return id ?? null
  }, [targetId, selfUserId])

  const fetchUsers = useCallback(async () => {
    if (!isCurator) return
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      setUsers(json.users ?? [])
    } catch {
      setUsers([])
    }
  }, [isCurator])

  const fetchStatus = useCallback(async () => {
    if (!isCurator || !toggles.totmManage) return
    setStatusLoading(true)
    setManageMessage(null)
    try {
      const uid = await resolveTargetId()
      if (!uid) {
        setStatus(null)
        return
      }
      const res = await fetch(`/api/totm/manage?user_id=${encodeURIComponent(uid)}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        setStatus(null)
        return
      }
      const json = await res.json()
      setStatus({
        featured_artist: json.featured_artist ?? null,
        available_skips: json.available_skips ?? 0,
        skips: json.skips ?? [],
      })
    } catch {
      setStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [isCurator, toggles.totmManage, resolveTargetId])

  const panelOpen = isPage || open

  useEffect(() => {
    if (!panelOpen || !isCurator) return
    if (toggles.grantXp || toggles.totmManage) {
      void fetchUsers()
    }
    if (toggles.totmManage) {
      void fetchStatus()
    }
  }, [
    panelOpen,
    isCurator,
    toggles.grantXp,
    toggles.totmManage,
    fetchUsers,
    fetchStatus,
    targetId,
  ])

  if (!canUseLab) return null

  const handleXpAdjust = async (delta: number) => {
    if (!isTester) return
    setXpMessage(null)
    setXpLoading(true)
    try {
      const res = await fetch('/api/xp/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setXpMessage(data?.error || t('dashboard.adjustXpFailed'))
        return
      }
      setXpValue('')
      setXpMessage(t('dashboard.xpUpdatedUseXp'))
      onXpChanged?.()
    } catch {
      setXpMessage(t('dashboard.adjustXpFailed'))
    } finally {
      setXpLoading(false)
    }
  }

  const handleXpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const n = parseInt(xpValue, 10)
    if (Number.isNaN(n) || n === 0) return
    await handleXpAdjust(n)
  }

  const handleGrantXp = async (e: FormEvent) => {
    e.preventDefault()
    if (!isCurator) return
    setGrantMessage(null)
    setGrantLoading(true)
    try {
      const amount = parseInt(grantAmount, 10)
      if (Number.isNaN(amount) || amount === 0) {
        setGrantMessage(t('dashboard.grantEnterAmount'))
        return
      }
      const res = await fetch('/api/xp/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: grantTargetId === 'self' || !grantTargetId ? undefined : grantTargetId,
          amount,
        }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGrantMessage(data?.error ?? t('dashboard.grantFailed'))
        return
      }
      setGrantMessage(data.message ?? t('dashboard.done'))
      setGrantAmount('')
      if (grantTargetId === 'self' || !grantTargetId) {
        onXpChanged?.()
      }
    } catch {
      setGrantMessage(t('common.somethingWentWrong'))
    } finally {
      setGrantLoading(false)
    }
  }

  const runSimulate = async (action: 'seed' | 'clear') => {
    setSimLoading(true)
    setSimMessage(null)
    try {
      const res = await fetch('/api/totm/simulate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSimMessage(json.detail || json.error || t('totm.simFailed'))
        return
      }
      setSimMessage(json.message || (action === 'seed' ? t('totm.simReady') : t('totm.simCleared')))
      onTotmChanged?.()
    } catch {
      setSimMessage(t('totm.simFailed'))
    } finally {
      setSimLoading(false)
    }
  }

  const runManage = async (action: string, skipId?: string) => {
    setManageLoading(true)
    setManageMessage(null)
    try {
      const uid = await resolveTargetId()
      if (!uid) {
        setManageMessage(t('totm.manageFailed'))
        return
      }
      const res = await fetch('/api/totm/manage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: uid, skip_id: skipId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setManageMessage(json.error || t('totm.manageFailed'))
        return
      }
      setManageMessage(json.message || t('dashboard.done'))
      await fetchStatus()
      onTotmChanged?.()
    } catch {
      setManageMessage(t('totm.manageFailed'))
    } finally {
      setManageLoading(false)
    }
  }

  const anyEnabled =
    (isTester && toggles.xpAdjust) ||
    (isCurator && toggles.grantXp) ||
    toggles.totmSim ||
    (isCurator && toggles.totmManage)

  const body = (
        <div className={`space-y-3 ${isPage ? '' : 'px-3 sm:px-4 pb-3 sm:pb-4 border-t border-amber-500/20 pt-3'}`}>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-0.5">
              {t('lab.features')}
            </p>
            {isTester && (
              <ToggleRow
                label={t('lab.toggleXp')}
                description={t('lab.toggleXpDesc')}
                checked={toggles.xpAdjust}
                onChange={(v) => setToggle('xpAdjust', v)}
              />
            )}
            {isCurator && (
              <ToggleRow
                label={t('lab.toggleGrantXp')}
                description={t('lab.toggleGrantXpDesc')}
                checked={toggles.grantXp}
                onChange={(v) => setToggle('grantXp', v)}
              />
            )}
            <ToggleRow
              label={t('lab.toggleTotmSim')}
              description={t('lab.toggleTotmSimDesc')}
              checked={toggles.totmSim}
              onChange={(v) => setToggle('totmSim', v)}
            />
            {isCurator && (
              <ToggleRow
                label={t('lab.toggleTotmManage')}
                description={t('lab.toggleTotmManageDesc')}
                checked={toggles.totmManage}
                onChange={(v) => setToggle('totmManage', v)}
              />
            )}
          </div>

          {!anyEnabled && (
            <p className="text-[11px] text-text-muted font-medium px-0.5">{t('lab.enableHint')}</p>
          )}

          {isTester && toggles.xpAdjust && (
            <div className="rounded-lg border border-amber-500/25 bg-background/50 p-2.5 sm:p-3 space-y-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-text-primary">
                {t('dashboard.adjustXp')}
              </h3>
              <p className="text-[11px] text-text-secondary font-medium">
                {t('dashboard.adjustXpDesc')}
              </p>
              <form onSubmit={handleXpSubmit} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  value={xpValue}
                  onChange={(e) => setXpValue(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-24 sm:w-28 px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-sm font-semibold focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none min-h-[40px]"
                />
                <button
                  type="submit"
                  disabled={xpLoading || !xpValue.trim()}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-background text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {xpLoading ? '…' : t('common.apply')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleXpAdjust(50)}
                  disabled={xpLoading}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => void handleXpAdjust(-50)}
                  disabled={xpLoading}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  −50
                </button>
              </form>
              {xpMessage && (
                <p className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-md px-2.5 py-1.5">
                  {xpMessage}
                </p>
              )}
            </div>
          )}

          {isCurator && toggles.grantXp && (
            <div className="rounded-lg border border-amber-500/25 bg-background/50 p-2.5 sm:p-3 space-y-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-text-primary">
                {t('dashboard.grantXp')}
              </h3>
              <p className="text-[11px] text-text-secondary font-medium">
                {t('dashboard.grantXpDesc')}
              </p>
              <form onSubmit={handleGrantXp} className="flex flex-wrap items-center gap-2">
                <select
                  value={grantTargetId}
                  onChange={(e) => setGrantTargetId(e.target.value)}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-sm font-medium focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                >
                  <option value="self">{t('dashboard.myself')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  placeholder="e.g. 50 or -25"
                  className="w-24 sm:w-28 px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-sm font-semibold focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none min-h-[40px]"
                />
                <button
                  type="submit"
                  disabled={grantLoading || !grantAmount.trim()}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-background text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {grantLoading ? '…' : t('common.apply')}
                </button>
              </form>
              {grantMessage && (
                <p className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-md px-2.5 py-1.5">
                  {grantMessage}
                </p>
              )}
            </div>
          )}

          {toggles.totmSim && (
            <div className="rounded-lg border border-amber-500/25 bg-background/50 p-2.5 sm:p-3 space-y-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-text-primary">
                {t('totm.simTitle')}
              </h3>
              <p className="text-[11px] text-text-secondary font-medium leading-snug">
                {t('totm.simHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={simLoading}
                  onClick={() => void runSimulate('seed')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/35 text-primary text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {simLoading ? '…' : t('totm.simSeed')}
                </button>
                <button
                  type="button"
                  disabled={simLoading}
                  onClick={() => void runSimulate('clear')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-background-lighter border border-gray-600/60 text-text-secondary text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {t('totm.simClear')}
                </button>
              </div>
              {simMessage && (
                <p className="text-[11px] font-medium text-text-secondary leading-snug">
                  {simMessage}
                </p>
              )}
            </div>
          )}

          {isCurator && toggles.totmManage && (
            <div className="rounded-lg border border-amber-500/25 bg-background/50 p-2.5 sm:p-3 space-y-2.5">
              <h3 className="text-xs sm:text-sm font-extrabold text-text-primary">
                {t('totm.manageTitle')}
              </h3>
              <p className="text-[11px] text-text-secondary font-medium leading-snug">
                {t('totm.manageHint')}
              </p>

              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-background-lighter border-2 border-gray-600 text-text-primary text-sm font-medium focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
              >
                <option value="self">{t('dashboard.myself')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name}
                  </option>
                ))}
              </select>

              <div className="rounded-md border border-gray-700/50 bg-background/40 px-2.5 py-2 text-[11px] space-y-1">
                {statusLoading ? (
                  <p className="text-text-muted font-medium">{t('common.loading')}</p>
                ) : status ? (
                  <>
                    <p className="font-bold text-text-primary">
                      {t('totm.featuredBadge')}:{' '}
                      <span className={status.featured_artist ? 'text-primary' : 'text-text-muted'}>
                        {status.featured_artist ? t('totm.featuredYes') : t('totm.featuredNo')}
                      </span>
                    </p>
                    <p className="font-bold text-text-primary">
                      {t('totm.queueSkips')}:{' '}
                      <span className="text-text-secondary tabular-nums">
                        {status.available_skips} {t('totm.skipAvailable').toLowerCase()}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-text-muted font-medium">{t('totm.manageNoStatus')}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => void runManage('grant_featured')}
                  className="min-h-[36px] px-2 py-1.5 rounded-lg bg-primary/15 border border-primary/35 text-primary text-[11px] sm:text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {t('totm.grantFeatured')}
                </button>
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => void runManage('revoke_featured')}
                  className="min-h-[36px] px-2 py-1.5 rounded-lg bg-background-lighter border border-gray-600/60 text-text-secondary text-[11px] sm:text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {t('totm.revokeFeatured')}
                </button>
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => void runManage('grant_skip')}
                  className="min-h-[36px] px-2 py-1.5 rounded-lg bg-primary/15 border border-primary/35 text-primary text-[11px] sm:text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {t('totm.grantSkip')}
                </button>
                <button
                  type="button"
                  disabled={manageLoading}
                  onClick={() => void runManage('revoke_skip')}
                  className="min-h-[36px] px-2 py-1.5 rounded-lg bg-background-lighter border border-gray-600/60 text-text-secondary text-[11px] sm:text-xs font-bold disabled:opacity-50 touch-manipulation"
                >
                  {t('totm.revokeSkip')}
                </button>
              </div>

              {manageMessage && (
                <p className="text-[11px] font-medium text-text-secondary leading-snug">
                  {manageMessage}
                </p>
              )}
            </div>
          )}
        </div>
  )

  if (isPage) {
    return <div className={className}>{body}</div>
  }

  return (
    <section
      className={`rounded-lg sm:rounded-xl border-2 border-amber-500/35 bg-amber-500/[0.04] shadow-lg animate-fade-in ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-left touch-manipulation"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            {isCurator ? t('lab.curatorBadge') : t('lab.testerBadge')}
          </p>
          <h2 className="text-sm sm:text-base font-extrabold text-text-primary leading-tight">
            {t('lab.title')}
          </h2>
          <p className="text-[11px] sm:text-xs text-text-muted font-medium mt-0.5">
            {open ? t('lab.hintOpen') : t('lab.hintClosed')}
          </p>
        </div>
        <span
          className={`shrink-0 text-amber-400/90 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && body}
    </section>
  )
}
