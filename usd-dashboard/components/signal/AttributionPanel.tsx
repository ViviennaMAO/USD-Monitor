'use client'
import type { SignalAttributionData } from '@/types'

interface Props {
  data: SignalAttributionData
}

const STRATEGY_COLORS: Record<string, string> = {
  ml_only: 'text-blue-400',
  gamma_only: 'text-amber-400',
  matrix_3x3: 'text-cyan-400',
  matrix_conflict: 'text-purple-400',
  full_router: 'text-emerald-400',
}

export function AttributionPanel({ data }: Props) {
  if (!data.strategies?.length) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-500">信号归因数据未就绪 (运行 pipeline --p2)</p>
      </div>
    )
  }

  // Find best strategy by Sharpe
  const bestSharpe = Math.max(...data.strategies.map(s => s.sharpe))

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-200">信号路由绩效归因</h3>
        <span className="text-[10px] text-slate-500">阈值: {data.optimal_threshold.toFixed(2)}</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-4">
        五种策略对比: 单引擎 vs 3×3矩阵 vs 冲突期权 vs 完整路由
      </p>

      {/* Strategy comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="text-left p-1.5">策略</th>
              <th className="text-right p-1.5">回报</th>
              <th className="text-right p-1.5">Sharpe</th>
              <th className="text-right p-1.5">MaxDD</th>
              <th className="text-right p-1.5">命中率</th>
              <th className="text-right p-1.5">交易数</th>
            </tr>
          </thead>
          <tbody>
            {data.strategies.map(s => {
              const isBest = s.sharpe === bestSharpe
              const color = STRATEGY_COLORS[s.strategy] || 'text-slate-300'
              return (
                <tr key={s.strategy} className={`border-b border-slate-800/50 ${isBest ? 'bg-emerald-500/5' : ''}`}>
                  <td className={`p-1.5 ${color} font-medium`}>
                    {isBest && <span className="text-[8px] mr-1">★</span>}
                    {s.label}
                  </td>
                  <td className={`text-right p-1.5 font-mono ${s.total_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.total_return > 0 ? '+' : ''}{s.total_return.toFixed(2)}%
                  </td>
                  <td className={`text-right p-1.5 font-mono ${isBest ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                    {s.sharpe.toFixed(3)}
                  </td>
                  <td className="text-right p-1.5 font-mono text-red-400">
                    {(s.max_drawdown * 100).toFixed(1)}%
                  </td>
                  <td className="text-right p-1.5 font-mono text-slate-300">
                    {(s.hit_rate * 100).toFixed(0)}%
                  </td>
                  <td className="text-right p-1.5 font-mono text-slate-500">
                    {s.n_trades}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mini NAV chart (text-based sparkline) */}
      <div className="mt-4 space-y-2">
        <div className="text-[10px] text-slate-500">NAV 曲线对比</div>
        {data.strategies.map(s => {
          if (!s.nav_series?.length) return null
          const min = Math.min(...s.nav_series)
          const max = Math.max(...s.nav_series)
          const range = max - min || 1
          const color = STRATEGY_COLORS[s.strategy] || 'text-slate-300'
          const bgColor = s.strategy === 'full_router' ? 'bg-emerald-500/30' :
                          s.strategy === 'matrix_conflict' ? 'bg-purple-500/30' :
                          s.strategy === 'ml_only' ? 'bg-blue-500/30' :
                          s.strategy === 'gamma_only' ? 'bg-amber-500/30' : 'bg-cyan-500/30'

          return (
            <div key={s.strategy} className="flex items-center gap-2">
              <div className={`w-20 text-[9px] ${color} truncate`}>{s.label.split(' ')[0]}</div>
              <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden flex items-end gap-px">
                {s.nav_series.map((v, i) => (
                  <div
                    key={i}
                    className={`flex-1 ${bgColor} rounded-t`}
                    style={{ height: `${((v - min) / range) * 100}%`, minHeight: '1px' }}
                  />
                ))}
              </div>
              <div className={`w-16 text-[9px] font-mono text-right ${
                s.nav_series[s.nav_series.length - 1] >= 1 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {((s.nav_series[s.nav_series.length - 1] - 1) * 100).toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Insight */}
      <div className="mt-3 p-2 bg-slate-800/30 rounded text-[9px] text-slate-500">
        {(() => {
          const full = data.strategies.find(s => s.strategy === 'full_router')
          const ml = data.strategies.find(s => s.strategy === 'ml_only')
          if (full && ml) {
            const improvement = full.sharpe - ml.sharpe
            return improvement > 0
              ? `完整路由 Sharpe 比 ML单引擎高 ${improvement.toFixed(3)}，信号融合产生正向增益`
              : `ML单引擎 Sharpe 更高，建议检查 regime 路由和冲突阈值参数`
          }
          return '需要更多数据评估策略优劣'
        })()}
      </div>
    </div>
  )
}
