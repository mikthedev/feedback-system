'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Particle = {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  fall: number
  rot: number
  color: string
  w: number
  h: number
  delay: number
  duration: number
}

const COLORS = [
  'rgba(202, 247, 111, 0.75)',
  'rgba(240, 255, 176, 0.65)',
  'rgba(158, 214, 69, 0.7)',
  'rgba(255, 255, 255, 0.45)',
  'rgba(232, 212, 139, 0.55)',
]

type TotmBadgeConfettiProps = {
  origin: DOMRect | null
  active: boolean
  onDone?: () => void
}

export default function TotmBadgeConfetti({ origin, active, onDone }: TotmBadgeConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!active || !origin) return

    const cx = origin.left + origin.width / 2
    const cy = origin.top + origin.height / 2
    const next: Particle[] = Array.from({ length: 18 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95
      const speed = 40 + Math.random() * 50
      const w = 3.5 + Math.random() * 2.5
      return {
        id: i,
        x: cx + (Math.random() - 0.5) * 6,
        y: cy + (Math.random() - 0.5) * 4,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed * 0.75,
        fall: 70 + Math.random() * 60,
        rot: (Math.random() > 0.5 ? 1 : -1) * (70 + Math.random() * 120),
        color: COLORS[i % COLORS.length]!,
        w,
        h: w * (1.1 + Math.random() * 0.5),
        delay: Math.random() * 120,
        duration: 1400 + Math.random() * 400,
      }
    })
    setParticles(next)

    const timer = window.setTimeout(() => {
      setParticles([])
      onDone?.()
    }, 2100)
    return () => window.clearTimeout(timer)
  }, [active, origin, onDone])

  if (!mounted || !active || particles.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[210] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="totm-confetti-piece absolute rounded-[1px]"
          style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            ['--tx' as string]: `${p.dx}px`,
            ['--ty' as string]: `${p.dy}px`,
            ['--fall' as string]: `${p.fall}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      ))}
    </div>,
    document.body
  )
}
