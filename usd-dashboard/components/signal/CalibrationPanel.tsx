'use client'
import type { CalibrationData } from '@/types'

interface Props {
  data: CalibrationData
}

const COMPONENT_LABELS: Record<string, string> = {
  rf: '利差补偿 (r_f)',
  pi_risk: '风险溢价 (π_risk)',
  cy: '便利性收益 (cy)',
  sigma: '波动率警报 (σ)',
}

export function CalibrationPanel({ data }: Props) {
  const isActive = data.status === 'calibrated'
  const components = ['rf', 'pi_risk', 'cy', 'sigma']

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Bayesian 权重校准</h3>
          <p className="text-[10px] text-slate-500">±10% 约束 · 季度频率 · Regime冻结</p>
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded ${
          isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'
        }`}>
          {isActive ? '已校准' : data.status === 'no_calibration' ? '使用基准权重' : data.status}
        </div>
      </div>

      {/* Weight comparison bars */}
      <div className="space-y-3">
        {components.map(comp => {
          const base = data.base_weights[comp] || 0
          const cal = data.calibrated_weights[comp] || base
          const shift = data.shifts[comp] || 0
          const ic = data.component_ics[comp] || 0
          const maxBar = 0.45 // Visual max
          const basePct = (base / maxBar) * 100
          const calPct = (cal / maxBar) * 100
          const shiftColor = shift > 0.01 ? 'text-emerald-400' : shift < -0.01 ? 'text-red-400' : 'text-slate-500'

          return (
            <div key={comp}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">{COMPONENT_LABELS[comp] || comp}</span>
                <span className="text-[10px] text-slate-500">IC: {ic.toFixed(3)}</span>
              </div>
              <div className="relative h-5 bg-slate-800 rounded overflow-hidden">
                {/* Base weight bar (ghost) */}
                <div
                  className="absolute inset-y-0 left-0 bg-slate-700/50 rounded"
                  style={{ width: `${basePct}%` }}
                />
                {/* Calibrated weight bar */}
                <div
                  className={`absolute inset-y-0 left-0 rounded ${
                    shift > 0.01 ? 'bg-emerald-500/40' : shift < -0.01 ? 'bg-red-500/40' : 'bg-blue-500/30'
                  }`}
                  style={{ width: `${calPct}%` }}
                />
                {/* Labels */}
                <div className="absolute inset-0 flex items-center px-2 justify-between">
                  <span className="text-[9px] font-mono text-white/80">{(cal * 100).toFixed(1)}%</span>
                  <span className={`text-[9px] font-mono ${shiftColor}`}>
                    {shift > 0 ? '+' : ''}{(shift * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
        <span className="text-[10px] text-slate-500">
          最大偏移: ±{(data.max_shift_constraint * 100).toFixed(0)}%
        </span>
        <span className="text-[10px] text-slate-500">
          {data.calibration_date ? `校准日: ${data.calibration_date}` : '未校准'}
        </span>
        <span className="text-[10px] text-slate-500">
          {data.schedule}
        </span>
      </div>
    </div>
  )
}
