'use client'
import type { DcaSignalData } from '@/types'

/**
 * Factor Consensus Bar (因子共识条)
 *
 * Shows how many of the 12 σ factors agree on direction.
 * Replaces Z-score numbers with an intuitive visual:
 *   ██████████░░░░  8/12 看多  │  一致性: 高
 */
export function FactorConsensusBar({ data }: { data: DcaSignalData['consensus'] }) {
  const { bullish, neutral, bearish, total, alignment } = data

  const bullPct = (bullish / total) * 100
  const neutPct = (neutral / total) * 100
  const bearPct = (bearish / total) * 100

  // Determine majority direction
  const majority = bullish >= bearish ? '推升' : '压制'
  const majorityCount = Math.max(bullish, bearish)

  // Alignment label
  const alignLabel = alignment >= 0.67 ? '高' : alignment >= 0.42 ? '中' : '低'
  const alignColor = alignment >= 0.67
    ? 'text-emerald-400'
    : alignment >= 0.42
    ? 'text-amber-400'
    : 'text-red-400'

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">因子共识</span>
          <span className="text-xs text-slate-400">
            {majorityCount}/{total} <span className={bullish >= bearish ? 'text-emerald-400' : 'text-red-400'}>{majority}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">一致性:</span>
          <span className={`text-xs font-semibold ${alignColor}`}>{alignLabel}</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800">
        {bullPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${bullPct}%` }}
            title={`推升: ${bullish}`}
          />
        )}
        {neutPct > 0 && (
          <div
            className="bg-slate-600 transition-all duration-500"
            style={{ width: `${neutPct}%` }}
            title={`中性: ${neutral}`}
          />
        )}
        {bearPct > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${bearPct}%` }}
            title={`压制: ${bearish}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          推升 {bullish}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
          中性 {neutral}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          压制 {bearish}
        </span>
      </div>
    </div>
  )
}
