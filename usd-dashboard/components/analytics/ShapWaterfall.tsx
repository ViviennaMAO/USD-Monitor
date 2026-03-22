'use client'
import { useShap } from '@/lib/useUsdData'
import type { ShapFactor } from '@/types'

function WaterfallBar({ factor, runningStart, baseValue, total }: {
  factor: ShapFactor
  runningStart: number
  baseValue: number
  total: number
}) {
  const isPositive = factor.shap_value >= 0
  const barWidth = Math.abs(factor.shap_value) / total * 100

  return (
    <div className="flex items-center gap-3 h-9">
      {/* Factor name */}
      <div className="w-28 text-right text-[11px] text-slate-400 font-mono truncate shrink-0">
        {factor.name}
      </div>

      {/* Bar track */}
      <div className="flex-1 relative h-5 bg-slate-800/50 rounded-sm overflow-hidden">
        {/* Offset spacer */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: 0, width: `${((runningStart - baseValue) / total * 100)}%` }}
        />
        {/* Actual bar */}
        <div
          className={`absolute top-0.5 bottom-0.5 rounded-sm ${isPositive ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}
          style={{
            left: `${((runningStart - baseValue) / total * 100)}%`,
            width: `${barWidth}%`,
          }}
        />
      </div>

      {/* Value */}
      <div className={`w-12 text-right text-[11px] font-mono shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{factor.shap_value.toFixed(2)}
      </div>
    </div>
  )
}

export function ShapWaterfall() {
  const { data } = useShap()

  // Sort by absolute shap_value descending
  const sorted = [...data.factors].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
  const totalSpan = data.output_value - data.base_value
  const maxSpread = Math.max(...data.factors.map(f => Math.abs(f.shap_value)))
  const totalWidth = maxSpread * 2 + 2

  // Compute running cumulative starts
  const runs: number[] = []
  let cur = data.base_value
  for (const f of sorted) {
    runs.push(cur)
    cur += f.shap_value
  }

  return (
    <div className="space-y-4">
      {/* Header cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">基准值 E[γ]</div>
          <div className="font-mono font-semibold text-slate-300">{data.base_value.toFixed(1)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">SHAP 合计贡献</div>
          <div className={`font-mono font-semibold ${totalSpan >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalSpan >= 0 ? '+' : ''}{totalSpan.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">当日 γ 输出值</div>
          <div className="font-mono font-semibold text-amber-400">{data.output_value.toFixed(1)}</div>
        </div>
      </div>

      {/* Waterfall */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="text-xs text-slate-400 mb-4 font-mono">因子 SHAP 边际贡献 · 按绝对值降序排列</div>

        {/* Base row */}
        <div className="flex items-center gap-3 h-9 border-b border-slate-800 mb-2">
          <div className="w-28 text-right text-[11px] text-slate-500 font-mono shrink-0">E[γ] 基准</div>
          <div className="flex-1 relative h-5">
            <div
              className="absolute top-0.5 bottom-0.5 bg-slate-600/60 rounded-sm"
              style={{ left: 0, width: `${data.base_value / (data.base_value + maxSpread + 4) * 100}%` }}
            />
          </div>
          <div className="w-12 text-right text-[11px] font-mono text-slate-400 shrink-0">{data.base_value.toFixed(1)}</div>
        </div>

        {/* Factor rows */}
        <div className="space-y-0.5">
          {sorted.map((factor, i) => (
            <WaterfallBar
              key={factor.name}
              factor={factor}
              runningStart={runs[i]}
              baseValue={data.base_value}
              total={totalWidth}
            />
          ))}
        </div>

        {/* Output row */}
        <div className="flex items-center gap-3 h-9 border-t border-slate-800 mt-2">
          <div className="w-28 text-right text-[11px] text-amber-400 font-mono shrink-0">γ 输出</div>
          <div className="flex-1 relative h-5">
            <div
              className="absolute top-0.5 bottom-0.5 bg-amber-500/60 rounded-sm"
              style={{ left: 0, width: `${data.output_value / (data.base_value + maxSpread + 4) * 100}%` }}
            />
          </div>
          <div className="w-12 text-right text-[11px] font-mono text-amber-400 shrink-0">{data.output_value.toFixed(1)}</div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-500/80" /> 正向贡献（推升 USD）</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-500/80" /> 负向贡献（压制 USD）</span>
        </div>
      </div>
    </div>
  )
}
