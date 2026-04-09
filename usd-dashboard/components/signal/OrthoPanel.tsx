'use client'
import type { OrthogonalizationData } from '@/types'

interface Props {
  data: OrthogonalizationData
}

export function OrthoPanel({ data }: Props) {
  const { ols_params, orthogonalization: ortho } = data
  const hasData = ols_params.n_obs > 0

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">OLS 正交化</h3>
          <p className="text-[10px] text-slate-500">ml_ortho = ml_pred − β × γ_norm</p>
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded ${
          hasData ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-700/50 text-slate-500'
        }`}>
          {hasData ? `n=${ols_params.n_obs}` : '数据不足'}
        </div>
      </div>

      {/* Signal decomposition visual */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* ML Raw */}
          <div>
            <div className="text-[10px] text-slate-500 mb-1">ML 原始</div>
            <div className={`font-mono text-lg font-bold ${
              ortho.ml_raw > 0 ? 'text-emerald-400' : ortho.ml_raw < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {ortho.ml_raw > 0 ? '+' : ''}{ortho.ml_raw.toFixed(3)}%
            </div>
          </div>

          {/* Arrow + Beta */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-slate-500 text-lg">→</div>
            <div className="text-[9px] text-slate-600">−β×γ</div>
            <div className="text-[9px] font-mono text-amber-400">β={ols_params.beta.toFixed(3)}</div>
          </div>

          {/* ML Ortho */}
          <div>
            <div className="text-[10px] text-blue-400 mb-1">ML 正交</div>
            <div className={`font-mono text-lg font-bold ${
              ortho.ml_ortho_pct > 0 ? 'text-emerald-400' : ortho.ml_ortho_pct < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {ortho.ml_ortho_pct > 0 ? '+' : ''}{ortho.ml_ortho_pct.toFixed(3)}%
            </div>
          </div>
        </div>
      </div>

      {/* Information decomposition pie-chart-like */}
      <div className="mb-4">
        <div className="text-[10px] text-slate-500 mb-2">信息分解</div>
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="bg-amber-500/50 h-full transition-all"
            style={{ width: `${ortho.explained_by_gamma_pct}%` }}
            title={`γ解释: ${ortho.explained_by_gamma_pct.toFixed(1)}%`}
          />
          <div
            className="bg-blue-500/50 h-full transition-all"
            style={{ width: `${ortho.independent_info_pct}%` }}
            title={`独立信息: ${ortho.independent_info_pct.toFixed(1)}%`}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-amber-400">
            γ已解释: {ortho.explained_by_gamma_pct.toFixed(1)}%
          </span>
          <span className="text-[9px] text-blue-400">
            独立信息: {ortho.independent_info_pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* OLS Parameters */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'α', value: ols_params.alpha.toFixed(4), color: 'text-slate-300' },
          { label: 'β', value: ols_params.beta.toFixed(4), color: 'text-amber-400' },
          { label: 'R²', value: ols_params.r_squared.toFixed(4), color: 'text-blue-400' },
          { label: 'n', value: String(ols_params.n_obs), color: 'text-slate-300' },
        ].map(p => (
          <div key={p.label} className="bg-slate-800/40 rounded p-2 text-center">
            <div className="text-[9px] text-slate-500">{p.label}</div>
            <div className={`font-mono text-xs ${p.color}`}>{p.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[10px] text-slate-600">
        正交化消除γ与ML的冗余信息，使冲突分数反映真实分歧而非双重计数
      </div>
    </div>
  )
}
