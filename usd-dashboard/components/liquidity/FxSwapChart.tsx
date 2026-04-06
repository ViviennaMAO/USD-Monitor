'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { FxSwapData } from '@/types'

interface Props { data: FxSwapData }

export function FxSwapChart({ data }: Props) {
  // Group pairs into 2 charts: [USD/JPY + GBP/USD] and [EUR/USD + USD/CNH]
  const group1 = data.pairs.filter(p => p.pair === 'USD/JPY' || p.pair === 'GBP/USD')
  const group2 = data.pairs.filter(p => p.pair === 'EUR/USD' || p.pair === 'USD/CNH')

  return (
    <div className="space-y-6">
      {/* Charts in 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Group 1: USD/JPY + GBP/USD */}
        <SwapGroupChart
          title="USD/JPY + GBP/USD 期限结构"
          pairs={group1}
          colors={['#3b82f6', '#10b981']}
        />
        {/* Group 2: EUR/USD + USD/CNH */}
        <SwapGroupChart
          title="EUR/USD + USD/CNH 期限结构"
          pairs={group2}
          colors={['#f59e0b', '#ef4444']}
        />
      </div>

      {/* Pair assessments */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <span>🌐</span> 各货币对信号解读
        </h3>
        <div className="space-y-5">
          {data.pairs.map(pair => (
            <div key={pair.pair}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{pair.flag}</span>
                <span className="text-sm font-semibold text-blue-400">{pair.pair}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-7">
                {pair.assessment}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Offshore assessment */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        <div className="text-[10px] text-slate-500 mb-1">🔍 综合评估</div>
        <div className="text-xs text-slate-300 leading-relaxed">{data.offshore_assessment}</div>
      </div>
    </div>
  )
}

// Sub-component: renders one swap chart for 2 pairs
function SwapGroupChart({
  title,
  pairs,
  colors,
}: {
  title: string
  pairs: { pair: string; data: { tenor: string; points: number }[] }[]
  colors: string[]
}) {
  // Build chart data with tenors as x-axis
  const tenors = pairs[0]?.data.map(d => d.tenor) ?? ['1W', '1M', '3M', '6M', '1Y']
  const chartData = tenors.map(tenor => {
    const point: Record<string, string | number> = { tenor }
    pairs.forEach((p, i) => {
      const match = p.data.find(d => d.tenor === tenor)
      point[`p${i}`] = match ? match.points : 0
    })
    return point
  })

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {pairs.map((p, i) => (
            <span key={p.pair} className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: colors[i] }} />
              {p.pair}
            </span>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-slate-600 mb-2 font-mono">掉期点</div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <XAxis
            dataKey="tenor"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
            formatter={(val, name) => {
              const idx = parseInt(String(name ?? '').replace('p', ''))
              return [`${Number(val).toFixed(2)}`, pairs[idx]?.pair ?? String(name)]
            }}
          />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="2 2" />
          {pairs.map((_, i) => (
            <Line
              key={i}
              dataKey={`p${i}`}
              stroke={colors[i]}
              strokeWidth={2}
              dot={{ r: 4, fill: colors[i], stroke: '#0a0e1a', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
