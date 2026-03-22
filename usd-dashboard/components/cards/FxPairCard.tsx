'use client'
import { SignalBadge } from '@/components/ui/Badge'
import { FxTrendChart } from '@/components/charts/FxTrendChart'
import type { FxData } from '@/types'

interface FxPairCardProps {
  data: FxData
}

export function FxPairCard({ data }: FxPairCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors h-full">
      <div className="text-sm font-semibold text-slate-200 mb-3">全球汇率对</div>

      {/* FX Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {data.pairs.map((pair) => {
          const changeColor = pair.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
          const changeSign = pair.change_pct >= 0 ? '+' : ''
          return (
            <div
              key={pair.symbol}
              className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-colors"
            >
              <div className="text-xs text-slate-500 font-mono mb-1">{pair.label}</div>
              <div className="text-base font-mono font-bold text-white">
                {pair.symbol === 'DXY'
                  ? pair.price.toFixed(2)
                  : pair.price < 10
                  ? pair.price.toFixed(4)
                  : pair.price.toFixed(2)}
              </div>
              <div className={`text-xs font-mono ${changeColor}`}>
                {changeSign}{pair.change_pct.toFixed(2)}%
              </div>
              <div className="mt-2">
                <SignalBadge signal={pair.signal} size="sm" />
              </div>
            </div>
          )
        })}
      </div>

      <FxTrendChart data={data} />
    </div>
  )
}
