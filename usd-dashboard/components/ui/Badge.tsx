'use client'
import type { Signal, AlertLevel } from '@/types'

interface SignalBadgeProps {
  signal: Signal
  size?: 'sm' | 'md' | 'lg'
}

export function SignalBadge({ signal, size = 'md' }: SignalBadgeProps) {
  const config = {
    BULLISH: { label: 'BULLISH 看多', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    NEUTRAL: { label: 'NEUTRAL 中性', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    BEARISH: { label: 'BEARISH 看空', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
  }
  const sizeMap = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-1.5' }
  const { label, cls } = config[signal]
  return (
    <span className={`inline-flex items-center rounded-full border font-mono font-semibold tracking-wide ${cls} ${sizeMap[size]}`}>
      {label}
    </span>
  )
}

interface AlertBadgeProps {
  level: AlertLevel
}

export function AlertBadge({ level }: AlertBadgeProps) {
  const config = {
    alert:   { label: '🔴 警报', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
    warning: { label: '🟠 预警', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
    watch:   { label: '🟡 关注', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    calm:    { label: '🟢 平静', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  }
  const { label, cls } = config[level]
  return (
    <span className={`inline-flex items-center rounded-full border text-sm px-3 py-1 font-mono font-semibold ${cls}`}>
      {label}
    </span>
  )
}

interface ScoreBadgeProps {
  score: number
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const cls =
    score >= 65 ? 'text-emerald-400' :
    score >= 35 ? 'text-amber-400' :
    'text-red-400'
  return <span className={`font-mono font-bold ${cls}`}>{score}</span>
}
