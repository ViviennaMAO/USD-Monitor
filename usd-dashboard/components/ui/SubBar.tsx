'use client'

interface SubBarProps {
  label: string
  weightLabel?: string
  value: number | string
  score: number      // 0-100
  direction?: 'positive' | 'negative' | 'neutral'
  color?: string
}

export function SubBar({ label, weightLabel, value, score, direction = 'neutral', color }: SubBarProps) {
  const barColor = color
    ? color
    : direction === 'positive'
    ? 'bg-emerald-500'
    : direction === 'negative'
    ? 'bg-red-500'
    : 'bg-amber-500'

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Left indicator */}
      <div className="w-1 h-8 rounded-full bg-slate-600 flex-shrink-0" />

      {/* Label + weight */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-slate-300 truncate">{label}</span>
          {weightLabel && (
            <span className="text-xs text-slate-500 flex-shrink-0">({weightLabel})</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </div>

      {/* Value */}
      <div className="w-16 text-right flex-shrink-0">
        <span className="text-xs font-mono text-slate-200">{value}</span>
      </div>
    </div>
  )
}
