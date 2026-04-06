'use client'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { SofrAnalysisData } from '@/types'

interface Props { data: SofrAnalysisData }

export function SofrSpreadChart({ data }: Props) {
  // Chart: SOFR band (p1-p99) with SOFR median, IORB, EFFR lines
  const chartData = data.history.map(h => ({
    date: h.date.slice(5),
    p1: h.p1,
    p25: h.p25,
    sofr: h.sofr,
    p75: h.p75,
    p99: h.p99,
    spread: h.spread_1_99 * 100, // Convert to bps
    iorb: h.iorb,
    effr: h.effr,
  }))

  // Thin for performance
  const thinned = chartData.length > 90
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 90) === 0 || i === chartData.length - 1)
    : chartData

  const { current } = data

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'SOFR', value: `${current.sofr.toFixed(2)}%`, color: 'text-blue-400' },
          { label: 'P1 (1st)', value: `${current.p1.toFixed(2)}%`, color: 'text-slate-400' },
          { label: 'P99 (99th)', value: `${current.p99.toFixed(2)}%`, color: 'text-slate-400' },
          { label: '1st-99th 价差', value: `${(current.spread_1_99 * 100).toFixed(1)} bp`, color: current.spread_1_99 > 0.08 ? 'text-red-400' : current.spread_1_99 > 0.04 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'IORB', value: `${current.iorb.toFixed(2)}%`, color: 'text-purple-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-1">{c.label}</div>
            <div className={`font-mono font-semibold text-sm ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* SOFR Band Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">SOFR 百分位分布带</h3>
        <p className="text-[10px] text-slate-500 mb-3">1st-99th百分位区间 · SOFR vs IORB vs EFFR</p>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={thinned} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
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
              tickFormatter={v => `${v.toFixed(1)}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val, name) => {
                const labels: Record<string, string> = {
                  p1: 'P1 (1st)', p25: 'P25', sofr: 'SOFR',
                  p75: 'P75', p99: 'P99 (99th)', iorb: 'IORB', effr: 'EFFR',
                }
                return [`${Number(val).toFixed(3)}%`, labels[String(name)] ?? String(name)]
              }}
            />
            {/* P1-P99 band */}
            <Area dataKey="p99" stroke="none" fill="#3b82f6" fillOpacity={0.08} />
            <Area dataKey="p1" stroke="none" fill="#0a0e1a" fillOpacity={1} />
            {/* P25-P75 band */}
            <Area dataKey="p75" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
            <Area dataKey="p25" stroke="none" fill="#0a0e1a" fillOpacity={1} />
            {/* Lines */}
            <Line dataKey="sofr" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line dataKey="iorb" stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            <Line dataKey="effr" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded" />SOFR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 rounded" style={{ borderTop: '1px dashed' }} />IORB</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '1px dashed' }} />EFFR</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500/15 rounded" />P25-P75</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500/08 rounded border border-blue-500/20" />P1-P99</span>
        </div>
      </div>

      {/* Spread history */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">1st-99th 百分位价差 (bps)</h3>
        <p className="text-[10px] text-slate-500 mb-3">价差扩大 = 回购市场定价分散度上升</p>

        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={thinned} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
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
              tickFormatter={v => `${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val) => [`${Number(val).toFixed(1)} bp`, '1st-99th价差']}
            />
            <ReferenceLine y={5} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.5} />
            <Area dataKey="spread" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Assessment */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        <div className="text-[10px] text-slate-500 mb-1">🔍 SOFR 分析</div>
        <div className="text-xs text-slate-300 leading-relaxed">{data.assessment}</div>
      </div>
    </div>
  )
}
