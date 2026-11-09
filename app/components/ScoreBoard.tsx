const METRICS = [
  { key: 'sound' as const, label: 'Sound', bar: 'bg-[#64B5F6]', track: 'bg-[#1E2A4A]', text: 'text-[#64B5F6]', border: 'border-[#64B5F6]/35' },
  { key: 'structure' as const, label: 'Structure', bar: 'bg-[#66BB6A]', track: 'bg-[#1E4A2E]', text: 'text-[#66BB6A]', border: 'border-[#66BB6A]/35' },
  { key: 'mix' as const, label: 'Mix', bar: 'bg-[#F48FB1]', track: 'bg-[#4A1E3A]', text: 'text-[#F48FB1]', border: 'border-[#F48FB1]/35' },
  { key: 'vibe' as const, label: 'Vibe', bar: 'bg-[#FFD54F]', track: 'bg-[#4A3A1E]', text: 'text-[#FFD54F]', border: 'border-[#FFD54F]/35' },
]

function tone(value: number) {
  if (value >= 8) return '#CAF76F'
  if (value >= 6.5) return '#FFD54F'
  if (value >= 5) return '#64B5F6'
  return '#F48FB1'
}

function ScoreRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(10, value))
  const r = 16
  const c = 2 * Math.PI * r
  const color = tone(clamped)

  return (
    <div className="relative h-14 w-14 shrink-0" aria-hidden>
      <svg viewBox="0 0 44 44" className="h-14 w-14 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 10) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums text-text-primary">
        {clamped.toFixed(1)}
      </span>
    </div>
  )
}

export default function ScoreBoard({
  scores,
  averageLabel,
  audienceLabel,
  audience,
}: {
  scores: { sound: number | string; structure: number | string; mix: number | string; vibe: number | string }
  averageLabel?: string
  audienceLabel?: string
  audience?: number | string | null
}) {
  const nums = METRICS.map((metric) => Number(scores[metric.key]) || 0)
  const average = nums.reduce((sum, n) => sum + n, 0) / nums.length
  const audienceNum = audience == null || audience === '' ? null : Number(audience)

  return (
    <div className="rounded-lg sm:rounded-xl border-2 border-gray-700/60 bg-background p-2.5 sm:p-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <ScoreRing value={average} />
          {averageLabel && (
            <span className="max-w-[4.5rem] text-center text-[9px] font-bold uppercase leading-tight tracking-wider text-primary">
              {averageLabel}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {METRICS.map((metric, index) => {
            const value = nums[index]
            const width = `${Math.max(0, Math.min(10, value)) * 10}%`
            return (
              <div key={metric.key} className="flex items-center gap-2">
                <span className={`w-[4.25rem] shrink-0 text-[10px] font-bold uppercase leading-none ${metric.text}`}>
                  {metric.label}
                </span>
                <div className={`h-2.5 flex-1 overflow-hidden rounded-full border ${metric.border} ${metric.track}`}>
                  <div className={`h-full rounded-full ${metric.bar}`} style={{ width }} />
                </div>
                <span className={`w-7 shrink-0 text-right text-xs font-black tabular-nums ${metric.text}`}>
                  {value.toFixed(1).replace(/\.0$/, '')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      {audienceNum != null && !Number.isNaN(audienceNum) && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border-2 border-[#FFD54F]/30 bg-[#FFD54F]/10 px-2.5 py-1.5">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#FFD54F]">
            {audienceLabel || 'Audience'}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-[#FFD54F]/35 bg-[#4A3A1E]">
            <div
              className="h-full rounded-full bg-[#FFD54F]"
              style={{ width: `${Math.max(0, Math.min(10, audienceNum)) * 10}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-black tabular-nums text-[#FFD54F]">
            {audienceNum.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}
