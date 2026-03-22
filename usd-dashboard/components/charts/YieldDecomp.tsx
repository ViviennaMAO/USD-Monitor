'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import type { YieldDecompData } from '@/types'
import { DataRow } from '@/components/ui/DataRow'

interface YieldDecompProps {
  data: YieldDecompData
  hedge: { score: number; note: string; cip_basis: number; eur_long: number; jpy_long: number; sofr: number; estr: number }
}

export function YieldDecompCard({ data, hedge }: YieldDecompProps) {
  const barData = [
    { name: '实际利率', value: data.real_rate, color: '#10b981' },
    { name: '通胀预期(BEI)', value: data.bei_10y, color: '#f59e0b' },
    { name: '期限溢价', value: data.term_premium, color: '#ef4444' },
  ]

  const driverLabel = {
    real_rate: '实际利率驱动',
    inflation: '通胀预期驱动',
    term_premium: '期限溢价驱动',
  }[data.driver]

  const dataRows = [
    { label: '实际利率 (TIPS 10Y)', value: `${data.real_rate.toFixed(2)}%` },
    { label: '5Y BEI', value: `${data.bei_5y.toFixed(2)}%` },
    { label: '10Y BEI', value: `${data.bei_10y.toFixed(2)}%` },
    { label: '期限溢价 (ACM近似)', value: `${data.term_premium > 0 ? '+' : ''}${(data.term_premium * 100).toFixed(0)}bps` },
    { label: '主要驱动', value: driverLabel },
  ]

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">10Y 收益率分解</div>
          <div className="text-xs text-slate-500">实际利率 + 通胀预期 + 期限溢价</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-cyan-400">{data.nominal_10y.toFixed(2)}%</div>
          <div className="text-xs text-slate-500">名义 10Y</div>
        </div>
      </div>

      {/* Driver badge */}
      <div className="mb-3">
        <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-full px-2.5 py-0.5">
          {driverLabel}
        </span>
      </div>

      {/* Stacked bar */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} width={90} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(val) => [`${Number(val).toFixed(2)}%`]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {barData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Data rows */}
      <div className="mt-3 border-t border-slate-800/60 pt-3">
        {dataRows.map((r) => <DataRow key={r.label} label={r.label} value={r.value} />)}
      </div>

      {/* Note */}
      <div className="mt-3 bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        {data.note}
      </div>
    </div>
  )
}
