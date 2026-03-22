'use client'
import { DataRow } from '@/components/ui/DataRow'
import type { HedgeData } from '@/types'

interface HedgeCardProps {
  data: HedgeData
}

interface HedgeCellProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function HedgeCell({ label, value, sub, color = 'text-white' }: HedgeCellProps) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export function HedgeCard({ data }: HedgeCardProps) {
  const scoreColor = data.score >= 65 ? 'text-cyan-400' : data.score >= 35 ? 'text-amber-400' : 'text-red-400'

  const rows = [
    { label: 'CIP 基差偏差', value: `${data.cip_basis.toFixed(1)}bps` },
    { label: '资管 EUR 多头', value: `${data.eur_long.toFixed(1)}%` },
    { label: '资管 JPY 多头', value: `${data.jpy_long.toFixed(1)}%` },
    { label: 'DXY-利率背离', value: `+${data.dxy_rate_divergence.toFixed(1)}pts` },
    { label: 'SOFR', value: `${data.sofr.toFixed(2)}%` },
    { label: '€STR', value: `${data.estr.toFixed(2)}%` },
  ]

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-200">对冲传导效率</div>
          <div className="text-xs text-slate-500">Hedge Transmission Efficiency</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${scoreColor}`}>{data.score}</div>
          <div className="text-xs text-slate-500">/100</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
            style={{ width: `${data.score}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>低效传导</span><span>高效传导</span>
        </div>
      </div>

      {/* 6-cell grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <HedgeCell
          label="CIP 基差偏差"
          value={`${data.cip_basis.toFixed(1)}bps`}
          sub="负值=USD融资压力"
          color={data.cip_basis < -20 ? 'text-red-400' : 'text-slate-200'}
        />
        <HedgeCell
          label="资管 EUR 多头"
          value={`+${data.eur_long.toFixed(1)}%`}
          sub="相对DXY对冲"
          color="text-amber-400"
        />
        <HedgeCell
          label="资管 JPY 多头"
          value={`${data.jpy_long.toFixed(1)}%`}
          sub="净空头维持"
          color="text-slate-300"
        />
        <HedgeCell
          label="DXY-利率背离"
          value={`+${data.dxy_rate_divergence.toFixed(1)}pts`}
          sub="溢价偏高"
          color="text-orange-400"
        />
        <HedgeCell
          label="SOFR"
          value={`${data.sofr.toFixed(2)}%`}
          sub="USD隔夜基准"
          color="text-cyan-400"
        />
        <HedgeCell
          label="€STR"
          value={`${data.estr.toFixed(2)}%`}
          sub="EUR隔夜基准"
          color="text-cyan-400"
        />
      </div>

      {/* Note */}
      <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        {data.note}
      </div>
    </div>
  )
}
