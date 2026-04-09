'use client'

interface Props {
  score: number          // 0-1
  level: string          // 'low' | 'medium' | 'high'
}

export function ConflictGauge({ score, level }: Props) {
  const pct = Math.round(score * 100)
  const color = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#10b981'
  const bgColor = level === 'high' ? 'bg-red-500/15' : level === 'medium' ? 'bg-amber-500/15' : 'bg-emerald-500/15'
  const textColor = level === 'high' ? 'text-red-400' : level === 'medium' ? 'text-amber-400' : 'text-emerald-400'
  const label = level === 'high' ? '高冲突' : level === 'medium' ? '中冲突' : '低冲突'

  // SVG arc gauge
  const radius = 70
  const circumference = Math.PI * radius // half circle
  const offset = circumference - (score * circumference)

  return (
    <div className={`${bgColor} border border-slate-800 rounded-xl p-6 flex flex-col items-center`}>
      <h3 className="text-sm font-semibold text-slate-200 mb-4">冲突分数</h3>

      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Background arc */}
        <path
          d="M 10 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 10 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Center text */}
        <text x="90" y="75" textAnchor="middle" fill={color} fontSize="28" fontFamily="monospace" fontWeight="bold">
          {pct}%
        </text>
      </svg>

      <div className={`text-sm font-medium ${textColor} mt-2`}>{label}</div>
      <div className="text-[10px] text-slate-500 mt-1">
        {score > 0.6 ? 'Regime转换信号 — 建议conflict option' :
         score > 0.3 ? '信号存在分歧 — 需关注SHAP归因' :
         '双引擎信号一致'}
      </div>
    </div>
  )
}
