'use client'
import { SubBar } from '@/components/ui/SubBar'
import { DataGrid } from '@/components/ui/DataRow'
import type { RfData, PiRiskData, CyData, RiskType } from '@/types'

// ─── Shared Card Shell ─────────────────────────────────────────────────────
interface CardShellProps {
  symbol: string
  title: string
  subtitle: string
  score: number
  signal: string
  children: React.ReactNode
}

function CardShell({ symbol, title, subtitle, score, signal, children }: CardShellProps) {
  const scoreColor = score >= 65 ? 'text-emerald-400' : score >= 35 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/60 flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-amber-400 font-mono font-bold text-lg">{symbol}</span>
            <span className="text-sm text-slate-300">{title}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${scoreColor}`}>{score}</div>
          <div className="text-xs text-slate-500">/100</div>
          <div className={`text-xs font-semibold mt-0.5 ${scoreColor}`}>{signal}</div>
        </div>
      </div>
      {/* Body */}
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── r_f Card ──────────────────────────────────────────────────────────────
export function RfCard({ data }: { data: RfData }) {
  return (
    <CardShell
      symbol="r_f"
      title="Rate Differential Support"
      subtitle="利率差异支撑"
      score={data.score}
      signal={data.signal}
    >
      <div className="space-y-0.5 mb-4">
        {data.sub_factors.map((sf) => (
          <SubBar
            key={sf.label}
            label={sf.label}
            weightLabel={sf.weight_label}
            value={sf.value}
            score={sf.score}
            direction={sf.direction}
          />
        ))}
      </div>
      <div className="border-t border-slate-800/60 pt-3">
        <DataGrid rows={data.data_rows} />
      </div>
    </CardShell>
  )
}

// ─── π_risk Card ───────────────────────────────────────────────────────────
interface RiskTypeBoxProps {
  activeType: RiskType
}

function RiskTypeBox({ activeType }: RiskTypeBoxProps) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className={`rounded-lg border p-3 transition-all ${
        activeType === 'global_risk'
          ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
          : 'border-slate-700 bg-slate-800/40 opacity-50'
      }`}>
        <div className="text-xs font-semibold text-emerald-400 mb-1">全球风险 → USD 看多</div>
        <div className="text-[10px] text-slate-400">VIX↑ + TP↓ = 飞向安全</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Flight to Safety</div>
      </div>
      <div className={`rounded-lg border p-3 transition-all ${
        activeType === 'us_specific'
          ? 'border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30'
          : 'border-slate-700 bg-slate-800/40 opacity-50'
      }`}>
        <div className="text-xs font-semibold text-red-400 mb-1">美国特有风险 → USD 看空</div>
        <div className="text-[10px] text-slate-400">VIX↑ + TP↑ = 财政恐惧</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Fiscal Fear</div>
      </div>
    </div>
  )
}

export function PiRiskCard({ data }: { data: PiRiskData }) {
  return (
    <CardShell
      symbol="π_risk"
      title="Risk Premium"
      subtitle="风险溢价"
      score={data.score}
      signal={data.signal}
    >
      <RiskTypeBox activeType={data.risk_type} />
      <div className="space-y-0.5 mb-4">
        {data.sub_factors.map((sf) => (
          <SubBar
            key={sf.label}
            label={sf.label}
            weightLabel={sf.weight_label}
            value={sf.value}
            score={sf.score}
            direction={sf.direction}
          />
        ))}
      </div>
      <div className="border-t border-slate-800/60 pt-3 mb-3">
        <DataGrid rows={data.data_rows} />
      </div>
      <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        {data.note}
      </div>
    </CardShell>
  )
}

// ─── cy Card ───────────────────────────────────────────────────────────────
export function CyCard({ data }: { data: CyData }) {
  return (
    <CardShell
      symbol="cy"
      title="Convenience Yield"
      subtitle="便利收益 (拖累项)"
      score={data.score}
      signal={data.signal}
    >
      <div className="space-y-0.5 mb-4">
        {data.sub_factors.map((sf) => (
          <SubBar
            key={sf.label}
            label={sf.label}
            weightLabel={sf.weight_label}
            value={sf.value}
            score={sf.score}
            direction={sf.direction}
          />
        ))}
      </div>
      <div className="border-t border-slate-800/60 pt-3 mb-3">
        <DataGrid rows={data.data_rows} />
      </div>
      <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
        {data.note}
      </div>
    </CardShell>
  )
}
