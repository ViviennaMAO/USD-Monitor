'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { YieldCurveData } from '@/types'

interface Props { data: YieldCurveData }

export function YieldCurveChart({ data }: Props) {
  // Transform data: tenors as x-axis, each curve as a line
  const chartData = data.tenors.map(tenor => {
    const point: Record<string, string | number> = { tenor }
    data.curves.forEach((curve, i) => {
      const match = curve.data.find(d => d.tenor === tenor)
      point[`c${i}`] = match ? match.value : 0
    })
    return point
  })

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">收益率曲线对比</h3>
        <div className="flex items-center gap-4 text-[10px]">
          {data.curves.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: c.color }} />
              <span className="text-slate-400">{c.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-slate-600 mb-2 font-mono">%</div>

      <ResponsiveContainer width="100%" height={320}>
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
            tickFormatter={v => `${v.toFixed(1)}%`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(val, name) => {
              const idx = parseInt(String(name ?? '').replace('c', ''))
              const label = data.curves[idx]?.label ?? String(name)
              return [`${Number(val).toFixed(2)}%`, label]
            }}
          />
          {data.curves.map((curve, i) => (
            <Line
              key={i}
              dataKey={`c${i}`}
              stroke={curve.color}
              strokeWidth={i === 0 ? 2.5 : 1.5}
              dot={{ r: 3, fill: curve.color, stroke: curve.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
