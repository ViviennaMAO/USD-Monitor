'use client'
import { useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts'
import { useIcTracking } from '@/lib/useUsdData'

const FACTORS: { id: string; label: string; group?: string }[] = [
  // F-series: 基本面因子
  { id: 'F1',  label: '利率差',     group: 'F' },
  { id: 'F2',  label: '实际利率Δ',  group: 'F' },
  { id: 'F3',  label: '期限利差',   group: 'F' },
  { id: 'F4',  label: 'VIX',       group: 'F' },
  { id: 'F5',  label: '通胀预期',   group: 'F' },
  { id: 'F6',  label: '曲线动量',   group: 'F' },
  { id: 'F7',  label: '长端利率Δ',  group: 'F' },
  { id: 'F8',  label: '信用残差',   group: 'F' },
  { id: 'F9',  label: '波动率差',   group: 'F' },
  { id: 'F10', label: '资金压力',   group: 'F' },
  // σ-series: 波动率因子
  { id: 'σ1',  label: 'RR',        group: 'σ' },
  { id: 'σ2',  label: '汇率残差',   group: 'σ' },
  { id: 'σ3',  label: 'OVX',       group: 'σ' },
  { id: 'σ4',  label: 'VVIX/VIX',  group: 'σ' },
  { id: 'σ5',  label: 'VXN-VIX',   group: 'σ' },
  { id: 'σ6',  label: 'VXHYG',     group: 'σ' },
  { id: 'σ7',  label: 'GVZ',       group: 'σ' },
  { id: 'σ8',  label: 'RR×残差',    group: 'σ' },
  { id: 'σ9',  label: '滞胀',      group: 'σ' },
  { id: 'σ10', label: '尾部风险',   group: 'σ' },
  { id: 'σ11', label: '科技溢出',   group: 'σ' },
  { id: 'σ12', label: '信用修复',   group: 'σ' },
]

const REGIME_COLORS: Record<string, string> = {
  '加息期': 'rgba(239,68,68,0.12)',
  '降息期': 'rgba(16,185,129,0.12)',
  '震荡期': 'rgba(100,116,139,0.08)',
}

function icColor(v: number) {
  if (v > 0.1) return 'text-emerald-400'
  if (v > 0) return 'text-emerald-300'
  if (v > -0.1) return 'text-red-300'
  return 'text-red-400'
}

// Build ReferenceArea spans from history
function buildRegimeSpans(history: { date: string; regime: string }[]) {
  const spans: { regime: string; x1: string; x2: string }[] = []
  if (!history.length) return spans
  let cur = history[0].regime, x1 = history[0].date
  for (let i = 1; i < history.length; i++) {
    if (history[i].regime !== cur) {
      spans.push({ regime: cur, x1, x2: history[i - 1].date })
      cur = history[i].regime
      x1 = history[i].date
    }
  }
  spans.push({ regime: cur, x1, x2: history[history.length - 1].date })
  return spans
}

// Thin out to ~120 points for perf
function thin(arr: unknown[], n = 120) {
  if (arr.length <= n) return arr
  const step = Math.ceil(arr.length / n)
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1)
}

export function IcTracking() {
  const [factor, setFactor] = useState('F5')
  const { data } = useIcTracking(factor)

  const chartData = thin(
    data.history.map(h => ({
      date: h.date.slice(5),   // MM-DD
      ic: +h.ic.toFixed(3),
      ma: +h.ic_ma20.toFixed(3),
      regime: h.regime,
    }))
  ) as { date: string; ic: number; ma: number; regime: string }[]

  const spans = buildRegimeSpans(data.history)

  return (
    <div className="space-y-4">
      {/* Factor selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {FACTORS.filter(f => f.group === 'F').map(f => (
          <button
            key={f.id}
            onClick={() => setFactor(f.id)}
            className={`px-3 py-1 rounded text-xs font-mono border transition-colors
              ${factor === f.id
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            {f.id} {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-700" />
        {FACTORS.filter(f => f.group === 'σ').map(f => (
          <button
            key={f.id}
            onClick={() => setFactor(f.id)}
            className={`px-3 py-1 rounded text-xs font-mono border transition-colors
              ${factor === f.id
                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500'}`}
          >
            {f.id} {f.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'IC (20d均值)', value: data.ic_ma20.toFixed(4), color: icColor(data.ic_ma20) },
          { label: 'ICIR', value: data.icir.toFixed(3), color: data.icir > 2 ? 'text-emerald-400' : data.icir > 1 ? 'text-amber-400' : 'text-red-400' },
          { label: '当日 IC', value: data.ic_today.toFixed(4), color: icColor(data.ic_today) },
          { label: '因子', value: data.factor_name, color: 'text-blue-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-1">{c.label}</div>
            <div className={`font-mono font-semibold text-sm truncate ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400 font-mono">滚动 252 日信息系数时序 · Regime 背景着色</span>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/30 border border-red-500/40" />加息期</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />降息期</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500/30 border border-slate-500/40" />震荡期</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(chartData.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(2)}
              domain={[-0.3, 0.3]}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val, name) => [Number(val).toFixed(4), name === 'ic' ? '日IC' : 'MA20']}
            />

            {/* Regime backgrounds */}
            {spans.map((s, i) => (
              <ReferenceArea
                key={i}
                x1={s.x1.slice(5)}
                x2={s.x2.slice(5)}
                fill={REGIME_COLORS[s.regime]}
                strokeOpacity={0}
              />
            ))}

            {/* Reference lines */}
            <ReferenceLine y={0}    stroke="#334155" strokeDasharray="2 2" />
            <ReferenceLine y={0.05}  stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={-0.05} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine y={0.10}  stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.3} />
            <ReferenceLine y={-0.10} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.3} />

            {/* IC lines */}
            <Line dataKey="ic" stroke="#3b82f6" strokeWidth={1.2} dot={false} name="ic" />
            <Line dataKey="ma" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="ma" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
