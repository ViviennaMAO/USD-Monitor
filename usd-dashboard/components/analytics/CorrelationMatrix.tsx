'use client'
import { useState } from 'react'
import { useCorrelation } from '@/lib/useUsdData'

function corrToColor(v: number): string {
  if (v >= 0.7)  return 'bg-red-700/80 text-red-100'
  if (v >= 0.3)  return 'bg-red-900/50 text-red-300'
  if (v > -0.3)  return 'bg-slate-700/30 text-slate-400'
  if (v > -0.7)  return 'bg-blue-900/50 text-blue-300'
  return 'bg-blue-700/80 text-blue-100'
}

function corrRisk(v: number, label: string): string | null {
  if (Math.abs(v) >= 0.7 && label !== label) return '高度相关，存在多重共线性风险'
  return null
}

export function CorrelationMatrix() {
  const { data } = useCorrelation()
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null)

  const n = data.labels.length

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[10px]">
        <span className="text-slate-500">相关程度:</span>
        {[
          { color: 'bg-red-700/80',   label: '强正相关 (≥0.7)' },
          { color: 'bg-red-900/50',   label: '中正相关 (0.3–0.7)' },
          { color: 'bg-slate-700/30', label: '低相关 (±0.3)' },
          { color: 'bg-blue-900/50',  label: '中负相关 (-0.7–-0.3)' },
          { color: 'bg-blue-700/80',  label: '强负相关 (≤-0.7)' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-slate-400">
            <span className={`w-3 h-3 rounded-sm ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Matrix */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="text-[10px] font-mono border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="w-16" />
              {data.labels.map((l, i) => (
                <th key={l} className="text-center text-slate-400 font-medium pb-1 px-0.5 min-w-[52px]">
                  <div>{l}</div>
                  <div className="text-[9px] text-slate-600 font-normal">{data.full_labels[i]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-2 text-right">
                  <div className="text-slate-300">{data.labels[ri]}</div>
                  <div className="text-[9px] text-slate-600">{data.full_labels[ri]}</div>
                </td>
                {row.map((val, ci) => {
                  const isDiag = ri === ci
                  const isHover = hovered && (hovered.r === ri || hovered.c === ci)
                  return (
                    <td key={ci}
                      onMouseEnter={() => setHovered({ r: ri, c: ci })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div className={`
                        rounded px-1 py-1.5 text-center transition-all cursor-default
                        ${isDiag ? 'bg-slate-600/50 text-slate-300 font-bold' : corrToColor(val)}
                        ${isHover && !isDiag ? 'ring-1 ring-white/20' : ''}
                      `}>
                        {val >= 0 ? '+' : ''}{val.toFixed(2)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover info */}
      {hovered && hovered.r !== hovered.c && (
        <div className="text-[11px] text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2 font-mono">
          {data.full_labels[hovered.r]} ↔ {data.full_labels[hovered.c]}:&nbsp;
          <span className={
            Math.abs(data.matrix[hovered.r][hovered.c]) >= 0.7
              ? 'text-red-400 font-semibold' : 'text-slate-300'
          }>
            ρ = {data.matrix[hovered.r][hovered.c] >= 0 ? '+' : ''}{data.matrix[hovered.r][hovered.c].toFixed(3)}
          </span>
          {Math.abs(data.matrix[hovered.r][hovered.c]) >= 0.7 && (
            <span className="text-red-400 ml-2">⚠ 多重共线性风险</span>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Pearson 相关系数矩阵，基于滚动 252 日日收益率序列计算。高度相关因子对（|ρ| ≥ 0.7）存在多重共线性，建议权重调整。
      </p>
    </div>
  )
}
