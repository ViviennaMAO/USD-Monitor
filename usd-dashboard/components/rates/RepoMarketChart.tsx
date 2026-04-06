'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { RepoMarketData } from '@/types'

interface Props { data: RepoMarketData }

export function RepoMarketChart({ data }: Props) {
  const chartData = data.history.map(h => ({
    date: h.date.slice(5),
    sofr: h.sofr,
    effr: h.effr,
    iorb: h.iorb,
    bgcr: h.bgcr,
    tgcr: h.tgcr,
    rrp: h.rrp,
  }))

  const thinned = chartData.length > 90
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 90) === 0 || i === chartData.length - 1)
    : chartData

  const { current } = data

  const rates = [
    { label: 'SOFR', value: current.sofr, color: 'text-blue-400', desc: '担保隔夜融资利率' },
    { label: 'EFFR', value: current.effr, color: 'text-emerald-400', desc: '有效联邦基金利率' },
    { label: 'IORB', value: current.iorb, color: 'text-purple-400', desc: '准备金余额利率' },
    { label: 'BGCR', value: current.bgcr, color: 'text-amber-400', desc: '广义一般抵押品利率' },
    { label: 'TGCR', value: current.tgcr, color: 'text-cyan-400', desc: '三方一般抵押品利率' },
    { label: 'ON RRP', value: current.rrp, color: 'text-rose-400', desc: '隔夜逆回购利率' },
  ]

  return (
    <div className="space-y-4">
      {/* Rate cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {rates.map(r => (
          <div key={r.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-0.5">{r.label}</div>
            <div className={`font-mono font-semibold text-sm ${r.color}`}>
              {r.value > 0 ? `${r.value.toFixed(2)}%` : '—'}
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">回购市场利率走势</h3>
        <p className="text-[10px] text-slate-500 mb-3">SOFR · EFFR · IORB · BGCR · TGCR · ON RRP</p>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={thinned} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(thinned.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(2)}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val, name) => {
                const labels: Record<string, string> = {
                  sofr: 'SOFR', effr: 'EFFR', iorb: 'IORB',
                  bgcr: 'BGCR', tgcr: 'TGCR', rrp: 'ON RRP',
                }
                return [`${Number(val).toFixed(3)}%`, labels[String(name)] ?? String(name)]
              }}
            />
            <Line dataKey="sofr" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line dataKey="effr" stroke="#10b981" strokeWidth={1.5} dot={false} />
            <Line dataKey="iorb" stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            <Line dataKey="bgcr" stroke="#f59e0b" strokeWidth={1} dot={false} />
            <Line dataKey="tgcr" stroke="#06b6d4" strokeWidth={1} dot={false} />
            <Line dataKey="rrp" stroke="#f43f5e" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded" />SOFR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded" />EFFR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 rounded" />IORB</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 rounded" />BGCR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-500 rounded" />TGCR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-500 rounded" />ON RRP</span>
        </div>
      </div>

      {/* Assessment */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        <div className="text-[10px] text-slate-500 mb-1">🔍 回购市场解读</div>
        <div className="text-xs text-slate-300 leading-relaxed">{data.assessment}</div>
      </div>
    </div>
  )
}
