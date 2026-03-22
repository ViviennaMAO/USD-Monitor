'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { FxData } from '@/types'

interface FxTrendChartProps {
  data: FxData
}

export function FxTrendChart({ data }: FxTrendChartProps) {
  const chartData = data.trend.map(d => ({
    date: d.date.slice(5),
    'EUR/USD': parseFloat(d.eurusd.toFixed(4)),
    'DXY': parseFloat(d.dxy.toFixed(2)),
  }))

  return (
    <div className="mt-4 border-t border-slate-800/60 pt-4">
      <div className="text-xs text-slate-500 mb-2">7日汇率趋势</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData} margin={{ top: 0, right: 5, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
          <YAxis yAxisId="eur" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
          <YAxis yAxisId="dxy" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
          />
          <Line yAxisId="eur" type="monotone" dataKey="EUR/USD" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          <Line yAxisId="dxy" type="monotone" dataKey="DXY" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
