'use client'
import type { ConflictDiagnosis } from '@/types'

interface Props {
  diagnosis: ConflictDiagnosis
}

export function ShapConflict({ diagnosis }: Props) {
  if (!diagnosis.has_conflict) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-emerald-300 mb-2">SHAP 冲突诊断</h3>
        <p className="text-xs text-emerald-400/80">{diagnosis.diagnosis}</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">SHAP 冲突诊断 (Simons)</h3>
      <p className="text-[10px] text-slate-500 mb-3">当γ与ML信号矛盾时，通过SHAP归因定位分歧根源</p>

      {/* Main diagnosis */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
        <div className="text-xs text-amber-300 leading-relaxed">{diagnosis.diagnosis}</div>
      </div>

      {/* Driver comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="text-[10px] text-amber-400 mb-1">γ 主驱动</div>
          <div className="font-mono text-sm text-white">{diagnosis.gamma_driver || 'N/A'}</div>
          {diagnosis.gamma_driver_score != null && (
            <div className="text-[10px] text-slate-400 mt-0.5">{diagnosis.gamma_driver_score}分</div>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="text-[10px] text-blue-400 mb-1">ML 对抗因子</div>
          <div className="font-mono text-sm text-white">{diagnosis.ml_opposing_factor || 'N/A'}</div>
          {diagnosis.ml_opposing_shap != null && (
            <div className={`text-[10px] mt-0.5 ${diagnosis.ml_opposing_shap > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              SHAP: {diagnosis.ml_opposing_shap > 0 ? '+' : ''}{diagnosis.ml_opposing_shap.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Top SHAP factors bar chart */}
      {diagnosis.top_shap_factors && diagnosis.top_shap_factors.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-2">Top SHAP 因子</div>
          <div className="space-y-1.5">
            {diagnosis.top_shap_factors.map((f, i) => {
              const maxAbs = Math.max(...diagnosis.top_shap_factors!.map(x => Math.abs(x.shap)), 0.001)
              const widthPct = Math.abs(f.shap) / maxAbs * 100
              const isPositive = f.shap > 0
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-24 text-[10px] text-slate-400 truncate text-right">{f.name}</div>
                  <div className="flex-1 h-4 relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-1 bg-slate-800 rounded" />
                    </div>
                    <div
                      className={`absolute top-0 h-4 rounded ${isPositive ? 'bg-emerald-500/40 left-1/2' : 'bg-red-500/40 right-1/2'}`}
                      style={{
                        width: `${widthPct / 2}%`,
                        ...(isPositive ? { left: '50%' } : { right: '50%' }),
                      }}
                    />
                  </div>
                  <div className={`w-14 text-[10px] font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {f.shap > 0 ? '+' : ''}{f.shap.toFixed(3)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
