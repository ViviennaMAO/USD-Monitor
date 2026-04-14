'use client'
import type { DcaSignalData, DcaRhythm } from '@/types'

// ── Rhythm config ──────────────────────────────────────────────────────────
const RHYTHM_CONFIG: Record<DcaRhythm, {
  color: string; bg: string; border: string; glow: string; icon: string; barColor: string
}> = {
  accelerate:   { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20', icon: '▲', barColor: 'bg-emerald-500' },
  normal:       { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10', icon: '●', barColor: 'bg-emerald-500' },
  hold:         { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   glow: 'shadow-amber-500/10',   icon: '■', barColor: 'bg-amber-500' },
  pause:        { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     glow: 'shadow-red-500/10',     icon: '⏸', barColor: 'bg-red-500' },
  pause_reduce: { color: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/40',     glow: 'shadow-red-500/20',     icon: '⏸▼', barColor: 'bg-red-500' },
}

// ── Confidence dots ─────────────────────────────────────────────────────────
function ConfidenceDots({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all ${
            i <= level ? color : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export function DcaSignalLight({ data }: { data: DcaSignalData }) {
  const cfg = RHYTHM_CONFIG[data.rhythm]

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 shadow-lg ${cfg.glow} transition-all`}>
      {/* Header row: signal light + label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Pulsing signal light */}
          <div className="relative">
            <div className={`w-10 h-10 rounded-full ${cfg.barColor} opacity-20 absolute inset-0 ${
              data.rhythm === 'pause_reduce' ? 'animate-ping' : data.rhythm === 'pause' ? 'animate-pulse' : ''
            }`} />
            <div className={`w-10 h-10 rounded-full ${cfg.barColor} flex items-center justify-center relative`}>
              <span className="text-white text-sm font-bold">{cfg.icon}</span>
            </div>
          </div>
          <div>
            <div className={`text-lg font-bold ${cfg.color}`}>{data.label}</div>
            <div className="text-[10px] text-slate-500 font-mono">DCA Rhythm Signal</div>
          </div>
        </div>

        {/* Confidence + Fragility */}
        <div className="text-right space-y-1">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10px] text-slate-500">信心</span>
            <ConfidenceDots level={data.confidence} color={cfg.barColor} />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10px] text-slate-500">脆弱度</span>
            <span className={`text-xs font-mono ${
              data.fragility > 70 ? 'text-red-400' : data.fragility > 45 ? 'text-amber-400' : 'text-emerald-400'
            }`}>{data.fragility}</span>
          </div>
        </div>
      </div>

      {/* Reason text */}
      <p className="text-xs text-slate-400 leading-relaxed">{data.reason}</p>
    </div>
  )
}
