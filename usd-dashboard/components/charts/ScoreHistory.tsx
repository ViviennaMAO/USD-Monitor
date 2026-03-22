'use client'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { DxyData } from '@/types'

interface ScoreHistoryProps {
  dxy: DxyData
  // In real usage scores would come from signal_history, here we generate mock
}

function generateScoreHistory(dxy: DxyData) {
  return dxy.history.map((d, i) => ({
    date: d.date.slice(5),  // MM-DD
    dxy: parseFloat(d.price.toFixed(2)),
    score: Math.round(45 + Math.sin(i / 4) * 15 + i * 0.3),
  }))
}

export function ScoreHistory({ dxy }: ScoreHistoryProps) {
  const data = generateScoreHistory(dxy)

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-200">评分历史 · 30日</div>
          <div className="text-xs text-slate-500">USD Score (左轴) vs DXY (右轴)</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            yAxisId="score"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="dxy"
            orientation="right"
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <ReferenceLine yAxisId="score" y={65} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine yAxisId="score" y={35} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Area
            yAxisId="score"
            type="monotone"
            dataKey="score"
            fill="#f59e0b"
            fillOpacity={0.15}
            stroke="#f59e0b"
            strokeWidth={2}
            name="USD Score"
            dot={false}
          />
          <Line
            yAxisId="dxy"
            type="monotone"
            dataKey="dxy"
            stroke="#06b6d4"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            name="DXY"
            dot={false}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
