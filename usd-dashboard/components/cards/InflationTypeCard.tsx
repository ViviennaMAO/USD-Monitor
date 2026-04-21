'use client'
import type { InflationDiagnosis, InflationComponent, InflationType } from '@/types'

// ── Zone config ────────────────────────────────────────────────────────────
const ZONE_CONFIG: Record<InflationComponent['zone'], {
  color: string
  bar: string
  label: string
}> = {
  hot:      { color: 'text-red-400',     bar: 'bg-red-500',     label: '偏热' },
  elevated: { color: 'text-amber-400',   bar: 'bg-amber-500',   label: '偏高' },
  normal:   { color: 'text-slate-300',   bar: 'bg-slate-500',   label: '正常' },
  cool:     { color: 'text-emerald-400', bar: 'bg-emerald-500', label: '回落' },
}

// ── Type badge color ───────────────────────────────────────────────────────
const TYPE_BADGE: Record<InflationType, string> = {
  energy_driven:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  wage_spiral:    'bg-red-500/15 text-red-400 border-red-500/30',
  monetary:       'bg-purple-500/15 text-purple-400 border-purple-500/30',
  demand_pull:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  supply_chain:   'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  shelter_driven: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  mixed:          'bg-slate-500/15 text-slate-400 border-slate-500/30',
  cooling:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

// ── Component row ──────────────────────────────────────────────────────────
function ComponentRow({ comp }: { comp: InflationComponent }) {
  const cfg = ZONE_CONFIG[comp.zone]
  const barPct = Math.min(100, Math.max(0, (comp.yoy / 8) * 100))  // 0-8% maps to 0-100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 w-10">{comp.label}</span>
          <span className="text-[10px] text-slate-500 font-mono">{comp.symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${cfg.color}`}>
            {comp.yoy > 0 ? '+' : ''}{comp.yoy.toFixed(2)}%
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.color} bg-slate-900/40`}>
            {cfg.label}
          </span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${cfg.bar} transition-all duration-500`}
          style={{ width: `${barPct}%`, opacity: 0.7 }}
        />
      </div>
      <p className="text-[10px] text-slate-500">{comp.note}</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function InflationTypeCard({ data }: { data: InflationDiagnosis }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">通胀类型诊断</span>
            <span className={`px-2 py-0.5 border rounded-full text-[11px] font-semibold ${TYPE_BADGE[data.type]}`}>
              {data.typeLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{data.headline}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">主导驱动</div>
          <div className="text-xs font-semibold text-slate-300">{data.dominantDriver}</div>
        </div>
      </div>

      {/* Components list */}
      <div className="space-y-2.5">
        {data.components.map(c => (
          <ComponentRow key={c.symbol} comp={c} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
        * Blanchard 6型分类:能源/工资螺旋/货币/需求/供给链/住房。分类影响四资产的反应模式。
      </p>
    </div>
  )
}
