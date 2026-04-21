'use client'
import type { MultiAssetSignalData, AssetSignal, AssetDirection } from '@/types'

// ── Direction config ──────────────────────────────────────────────────────
const DIR_CONFIG: Record<AssetDirection, {
  label: string
  color: string
  bg: string
  border: string
  arrow: string
}> = {
  strong_bullish:  { label: '强看多', color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', arrow: '▲▲' },
  bullish:         { label: '看多',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', arrow: '▲'  },
  neutral:         { label: '中性',   color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   arrow: '●'  },
  bearish:         { label: '看空',   color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     arrow: '▼'  },
  strong_bearish:  { label: '强看空', color: 'text-red-300',     bg: 'bg-red-500/20',     border: 'border-red-500/50',     arrow: '▼▼' },
}

// ── Confidence stars ───────────────────────────────────────────────────────
function Stars({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`text-[10px] leading-none ${i <= level ? color : 'text-slate-700'}`}
        >★</span>
      ))}
    </div>
  )
}

// ── Asset card ─────────────────────────────────────────────────────────────
function AssetCard({ signal }: { signal: AssetSignal }) {
  const cfg = DIR_CONFIG[signal.direction]

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-lg p-3 hover:border-opacity-60 transition-colors`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-slate-200">{signal.label}</div>
          <div className="text-[10px] text-slate-500 font-mono">{signal.symbol}</div>
        </div>
        <div className={`flex items-center gap-1 ${cfg.color}`}>
          <span className="text-sm font-bold">{cfg.arrow}</span>
          <span className="text-xs font-semibold">{cfg.label}</span>
        </div>
      </div>

      {/* Confidence + time window */}
      <div className="flex items-center justify-between mb-2">
        <Stars level={signal.confidence} color={cfg.color} />
        <span className="text-[10px] text-slate-500 font-mono">{signal.timeWindow}</span>
      </div>

      {/* Price (if available) */}
      {signal.price != null && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-sm font-mono text-slate-300">
            {signal.asset === 'Bonds' ? `${signal.price.toFixed(2)}%` : signal.price.toFixed(2)}
          </span>
          {signal.change_1d_pct != null && signal.change_1d_pct !== 0 && (
            <span className={`text-[10px] font-mono ${
              signal.change_1d_pct > 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {signal.change_1d_pct > 0 ? '+' : ''}{signal.change_1d_pct.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {/* Reason */}
      <p className="text-[11px] text-slate-400 leading-relaxed">{signal.reason}</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MultiAssetSignals({ data }: { data: MultiAssetSignalData }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      {/* Regime header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">通胀 Regime</span>
            <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-full text-[11px] font-semibold">
              {data.regimeLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{data.regimeReason}</p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[10px] text-slate-500">5Y5Y锚</span>
            <span className="text-xs font-mono text-slate-300">{data.inflationAnchor.toFixed(2)}%</span>
          </div>
          {data.wageGrowth != null && (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] text-slate-500">工资增长</span>
              <span className={`text-xs font-mono ${
                data.wageGrowth > 4.5 ? 'text-red-400' : data.wageGrowth > 4.0 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{data.wageGrowth.toFixed(2)}%</span>
            </div>
          )}
          {data.fiscal && (
            <div className="flex items-center gap-1.5 justify-end" title={data.fiscal.note}>
              <span className="text-[10px] text-slate-500">财政压力</span>
              <span className={`text-xs font-mono ${
                data.fiscal.level === 'extreme' ? 'text-red-400' :
                data.fiscal.level === 'high' ? 'text-amber-400' :
                data.fiscal.level === 'moderate' ? 'text-slate-300' : 'text-emerald-400'
              }`}>{data.fiscal.debtGdp.toFixed(0)}% ({data.fiscal.pressureScore})</span>
            </div>
          )}
        </div>
      </div>

      {/* 4-asset grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.assets.map(asset => (
          <AssetCard key={asset.asset} signal={asset} />
        ))}
      </div>

      {/* Footer disclaimer */}
      <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
        * 四资产信号基于通胀 regime 映射。时间窗口因资产而异：美元/美股1-3月、黄金3-6月、美债6-12月。
      </p>
    </div>
  )
}
