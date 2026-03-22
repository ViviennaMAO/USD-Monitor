'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import type { CftcData } from '@/types'

interface CftcBarsProps {
  data: CftcData
}

export function CftcBars({ data }: CftcBarsProps) {
  // Show latest net position for each currency
  const latestData = data.currencies.map(c => ({
    label: c.label,
    net: c.net,
    change: c.net - c.prev,
  }))

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">CFTC 持仓分析</div>
          <div className="text-xs text-slate-500">资管机构净持仓 (手) · 周度</div>
        </div>
      </div>

      {/* Net position bar chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={latestData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(val) => [`${Number(val) > 0 ? '+' : ''}${(Number(val) / 1000).toFixed(1)}K 手`]}
          />
          <ReferenceLine x={0} stroke="#475569" />
          <Bar dataKey="net" radius={[0, 4, 4, 0]}>
            {latestData.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.net > 0 ? '#10b981' : '#ef4444'}
                fillOpacity={0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 7-week sparklines for USD Index */}
      <div className="mt-3 border-t border-slate-800/60 pt-3">
        {data.currencies.slice(0, 3).map(c => (
          <div key={c.label} className="flex items-center gap-3 py-1">
            <span className="text-xs text-slate-400 w-24 flex-shrink-0">{c.label}</span>
            <div className="flex-1 flex items-end gap-0.5 h-6">
              {c.history.map((v, i) => {
                const maxAbs = Math.max(...c.history.map(Math.abs))
                const pct = maxAbs > 0 ? (Math.abs(v) / maxAbs) * 100 : 50
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ height: `${Math.max(10, pct)}%`, opacity: 0.7 }}
                  />
                )
              })}
            </div>
            <span className={`text-xs font-mono w-16 text-right flex-shrink-0 ${c.net - c.prev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {c.net - c.prev >= 0 ? '+' : ''}{((c.net - c.prev) / 1000).toFixed(1)}K
            </span>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="mt-3 bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        {data.note}
      </div>
    </div>
  )
}
