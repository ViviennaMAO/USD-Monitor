'use client'
import { useRegimeIc } from '@/lib/useUsdData'

function icToColor(v: number): string {
  if (v > 0.15)  return 'bg-emerald-600/80 text-emerald-100'
  if (v > 0.05)  return 'bg-emerald-800/60 text-emerald-300'
  if (v > -0.05) return 'bg-slate-700/40 text-slate-400'
  if (v > -0.15) return 'bg-red-900/40 text-red-300'
  return 'bg-red-700/70 text-red-100'
}

function icLabel(v: number): string {
  if (v > 0.15)  return '强有效'
  if (v > 0.05)  return '有效'
  if (v > -0.05) return '无效'
  if (v > -0.15) return '负效'
  return '强负效'
}

export function RegimeHeatmap() {
  const { data } = useRegimeIc()

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[10px]">
        <span className="text-slate-500">IC 效力:</span>
        {[
          { color: 'bg-emerald-600/80', label: '强有效 (>0.15)' },
          { color: 'bg-emerald-800/60', label: '有效 (0.05–0.15)' },
          { color: 'bg-slate-700/40',   label: '无效 (±0.05)' },
          { color: 'bg-red-900/40',     label: '负效 (<-0.05)' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-slate-400">
            <span className={`w-3 h-3 rounded-sm ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Heatmap table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-normal pb-3 pr-4 w-28">因子</th>
              {data.regimes.map(r => (
                <th key={r} className="text-center text-slate-400 font-medium pb-3 px-2">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.factors.map((fid, fi) => (
              <tr key={fid}>
                <td className="py-2 pr-4">
                  <div className="font-mono text-slate-300">{fid}</div>
                  <div className="text-[10px] text-slate-500">{data.factor_names[fi]}</div>
                </td>
                {data.matrix[fi].map((val, ri) => (
                  <td key={ri} className="py-1.5 px-2">
                    <div className={`rounded px-2 py-1.5 text-center font-mono ${icToColor(val)}`}>
                      <div className="font-semibold">{val >= 0 ? '+' : ''}{val.toFixed(2)}</div>
                      <div className="text-[9px] opacity-70">{icLabel(val)}</div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        各单元格为该因子在对应利率周期内的平均 IC（滚动 252 日）。IC &gt; 0.05 视为有统计学意义的预测能力。
      </p>
    </div>
  )
}
