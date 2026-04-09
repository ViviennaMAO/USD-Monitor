'use client'

interface Props {
  gammaDir: string    // 'bull' | 'neutral' | 'bear'
  mlDir: string       // 'buy' | 'neutral' | 'sell'
  action: string
  source: string
}

const MATRIX_LABELS: Record<string, Record<string, { action: string; emoji: string; color: string }>> = {
  bull: {
    buy:     { action: 'LONG 100%',        emoji: '🟢', color: 'bg-emerald-500/30 border-emerald-500/50' },
    neutral: { action: 'LONG 50%',         emoji: '🟡', color: 'bg-emerald-500/15 border-emerald-500/30' },
    sell:    { action: 'Conflict Option',   emoji: '⚡', color: 'bg-amber-500/20 border-amber-500/50' },
  },
  neutral: {
    buy:     { action: 'LONG 50%',         emoji: '🟡', color: 'bg-emerald-500/15 border-emerald-500/30' },
    neutral: { action: 'FLAT',             emoji: '⚪', color: 'bg-slate-500/15 border-slate-500/30' },
    sell:    { action: 'SHORT 50%',        emoji: '🟡', color: 'bg-red-500/15 border-red-500/30' },
  },
  bear: {
    buy:     { action: 'Conflict Option',   emoji: '⚡', color: 'bg-amber-500/20 border-amber-500/50' },
    neutral: { action: 'SHORT 50%',        emoji: '🟡', color: 'bg-red-500/15 border-red-500/30' },
    sell:    { action: 'SHORT 100%',       emoji: '🔴', color: 'bg-red-500/30 border-red-500/50' },
  },
}

const GAMMA_ROWS = ['bull', 'neutral', 'bear'] as const
const ML_COLS = ['buy', 'neutral', 'sell'] as const
const GAMMA_LABELS: Record<string, string> = { bull: '看多', neutral: '中性', bear: '看空' }
const ML_LABELS: Record<string, string> = { buy: '看多', neutral: '中性', sell: '看空' }

export function CredibilityMatrix({ gammaDir, mlDir, action, source }: Props) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">3×3 可信度矩阵 (Dalio)</h3>
      <p className="text-[10px] text-slate-500 mb-4">行: γ方向 · 列: ML方向 · 高亮: 当前位置</p>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs">
          <thead>
            <tr>
              <th className="p-2 text-slate-500">γ \ ML</th>
              {ML_COLS.map(col => (
                <th key={col} className={`p-2 ${mlDir === col ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
                  {ML_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GAMMA_ROWS.map(row => (
              <tr key={row}>
                <td className={`p-2 ${gammaDir === row ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                  {GAMMA_LABELS[row]}
                </td>
                {ML_COLS.map(col => {
                  const cell = MATRIX_LABELS[row]?.[col]
                  const isActive = gammaDir === row && mlDir === col
                  return (
                    <td key={col} className="p-1">
                      <div className={`
                        rounded-lg p-2 border transition-all
                        ${isActive
                          ? `${cell?.color} ring-2 ring-white/30 scale-105`
                          : 'bg-slate-800/40 border-slate-700/50'
                        }
                      `}>
                        <div className="text-base">{cell?.emoji}</div>
                        <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white font-bold' : 'text-slate-500'}`}>
                          {cell?.action}
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Current decision summary */}
      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">当前决策</span>
          <span className="text-[10px] text-slate-500">信号来源: {source}</span>
        </div>
        <div className={`font-mono font-bold text-lg mt-1 ${
          action === 'LONG' ? 'text-emerald-400' :
          action === 'SHORT' ? 'text-red-400' :
          'text-slate-400'
        }`}>
          {action}
        </div>
      </div>
    </div>
  )
}
