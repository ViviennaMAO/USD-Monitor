'use client'
import {
  ComposedChart, AreaChart, Area, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useNavCurve } from '@/lib/useUsdData'

function thin<T>(arr: T[], n = 120): T[] {
  if (arr.length <= n) return arr
  const step = Math.ceil(arr.length / n)
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1)
}

function pct(v: number, sign = true) {
  const s = (v * 100).toFixed(2)
  return sign && v > 0 ? `+${s}%` : `${s}%`
}

export function NavCurve() {
  const { data } = useNavCurve()

  const chartData = thin(
    data.history.map(h => ({
      date: h.date.slice(5),
      nav: +h.nav.toFixed(4),
      dxy: +h.dxy_norm.toFixed(4),
      dd: +h.drawdown.toFixed(4),
    }))
  ) as { date: string; nav: number; dxy: number; dd: number }[]

  const stats = [
    { label: '累计收益',   value: pct(data.total_return),    color: data.total_return >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: '年化 Sharpe', value: data.sharpe.toFixed(2),   color: data.sharpe >= 1.5 ? 'text-emerald-400' : data.sharpe >= 1 ? 'text-amber-400' : 'text-red-400' },
    { label: '最大回撤',   value: pct(data.max_drawdown, false), color: 'text-red-400' },
    { label: '胜率',       value: pct(data.win_rate, false),  color: data.win_rate >= 0.5 ? 'text-emerald-400' : 'text-amber-400' },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-1">{s.label}</div>
            <div className={`font-mono font-semibold text-lg ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* NAV chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400 font-mono">策略净值 vs DXY 归一化价格</span>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-400 inline-block" /> 策略净值</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-400 inline-block" /> DXY 归一化</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
              interval={Math.floor(chartData.length / 6)} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
              tickFormatter={v => v.toFixed(2)} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val, name) => [Number(val).toFixed(4), name === 'nav' ? '策略净值' : 'DXY']}
            />
            <ReferenceLine y={1} stroke="#334155" strokeDasharray="3 3" />
            <Line dataKey="nav" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="nav" />
            <Line dataKey="dxy" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="4 2" name="dxy" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="text-xs text-slate-400 font-mono mb-3">策略回撤</div>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
              interval={Math.floor(chartData.length / 6)} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val) => [`${(Number(val) * 100).toFixed(2)}%`, '回撤']}
            />
            <ReferenceLine y={0} stroke="#334155" />
            <Area dataKey="dd" stroke="#ef4444" fill="#ef444430" strokeWidth={1} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-slate-500">
        信号映射: γ &gt; 65 → 做多 DXY · 35 ≤ γ ≤ 65 → 空仓 · γ &lt; 35 → 做空 DXY。净值以期初 1.0 为基准，不含交易成本。
      </p>
    </div>
  )
}
