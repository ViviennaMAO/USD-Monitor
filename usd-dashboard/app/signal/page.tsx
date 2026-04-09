'use client'
import { useEffect, useState } from 'react'
import { ConflictGauge } from '@/components/signal/ConflictGauge'
import { CredibilityMatrix } from '@/components/signal/CredibilityMatrix'
import { ShapConflict } from '@/components/signal/ShapConflict'
import type { UnifiedSignalData } from '@/types'

export default function SignalPage() {
  const [data, setData] = useState<UnifiedSignalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/unified-signal')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-slate-500 text-sm">加载信号路由数据...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-red-400 text-sm">信号数据加载失败</div>
      </div>
    )
  }

  const actionColor =
    data.action === 'LONG' ? 'text-emerald-400' :
    data.action === 'SHORT' ? 'text-red-400' :
    'text-slate-400'

  const actionBg =
    data.action === 'LONG' ? 'bg-emerald-500/15 border-emerald-500/30' :
    data.action === 'SHORT' ? 'bg-red-500/15 border-red-500/30' :
    'bg-slate-500/15 border-slate-500/30'

  const regimeColors: Record<string, string> = {
    crisis: 'text-red-400 bg-red-500/15',
    policy_shock: 'text-amber-400 bg-amber-500/15',
    transition: 'text-purple-400 bg-purple-500/15',
    normal: 'text-emerald-400 bg-emerald-500/15',
  }
  const regimeLabels: Record<string, string> = {
    crisis: '危机模式',
    policy_shock: '政策冲击',
    transition: 'Regime转换',
    normal: '正常模式',
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">统一信号路由</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              双引擎信号融合 · γ规则引擎 × ML预测引擎 · 3×3可信度矩阵
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500">{data.date}</div>
            {data.dxy_price > 0 && (
              <div className="font-mono text-sm text-slate-300">DXY {data.dxy_price}</div>
            )}
          </div>
        </div>

        {/* Top stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Unified Action */}
          <div className={`${actionBg} border rounded-xl p-4 col-span-2 lg:col-span-1`}>
            <div className="text-[10px] text-slate-500 mb-1">统一决策</div>
            <div className={`font-mono font-bold text-2xl ${actionColor}`}>{data.action}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              仓位 {Math.round(data.size_mult * 100)}% · 止损 ×{data.stop_mult.toFixed(1)}
            </div>
          </div>

          {/* γ Score */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">γ 评分</div>
            <div className={`font-mono font-bold text-xl ${
              data.gamma_score >= 65 ? 'text-emerald-400' :
              data.gamma_score < 35 ? 'text-red-400' : 'text-amber-400'
            }`}>
              {data.gamma_score}<span className="text-xs text-slate-500">/100</span>
            </div>
            <div className={`text-[10px] mt-0.5 ${
              data.gamma_signal === 'BULLISH' ? 'text-emerald-400' :
              data.gamma_signal === 'BEARISH' ? 'text-red-400' : 'text-slate-400'
            }`}>{data.gamma_signal}</div>
          </div>

          {/* ML Prediction */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">ML 预测 (20d)</div>
            <div className={`font-mono font-bold text-xl ${
              data.ml_prediction > 0 ? 'text-emerald-400' :
              data.ml_prediction < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {data.ml_prediction > 0 ? '+' : ''}{data.ml_prediction.toFixed(3)}%
            </div>
            <div className={`text-[10px] mt-0.5 ${
              data.ml_signal === 'BUY' ? 'text-emerald-400' :
              data.ml_signal === 'SELL' ? 'text-red-400' : 'text-slate-400'
            }`}>{data.ml_signal}</div>
          </div>

          {/* Conflict Score */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">冲突分数</div>
            <div className={`font-mono font-bold text-xl ${
              data.conflict_level === 'high' ? 'text-red-400' :
              data.conflict_level === 'medium' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {(data.conflict_score * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{data.conflict_level}</div>
          </div>

          {/* Regime State */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">Regime 状态</div>
            <div className={`text-sm font-medium px-2 py-0.5 rounded inline-block ${regimeColors[data.regime_state] || 'text-slate-400'}`}>
              {regimeLabels[data.regime_state] || data.regime_state}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {data.regime_detail.regime} · ×{data.regime_detail.multiplier.toFixed(2)}
            </div>
          </div>

          {/* Signal Source */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">信号来源</div>
            <div className="font-mono text-sm text-blue-400">{data.signal_source}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {data.signal_source === 'consensus' ? '双引擎共识' :
               data.signal_source === 'partial_consensus' ? '部分共识' :
               data.signal_source === 'conflict_option' ? 'Taleb冲突期权' :
               data.signal_source === 'gamma_only' ? 'γ单引擎' :
               data.signal_source === 'circuit_breaker' ? '熔断器接管' :
               data.signal_source}
            </div>
          </div>
        </div>

        {/* Main content: Matrix + Gauge + Diagnosis */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: 3×3 Matrix */}
          <div className="lg:col-span-1">
            <CredibilityMatrix
              gammaDir={data.matrix_position.gamma_dir}
              mlDir={data.matrix_position.ml_dir}
              action={data.action}
              source={data.signal_source}
            />
          </div>

          {/* Center: Conflict Gauge */}
          <div className="lg:col-span-1">
            <ConflictGauge
              score={data.conflict_score}
              level={data.conflict_level}
            />

            {/* Regime routing explanation */}
            <div className="mt-4 bg-slate-900/40 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 mb-2">Regime 路由逻辑</div>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { state: 'normal', label: '正常', desc: '3×3矩阵决策', active: data.regime_state === 'normal' },
                  { state: 'transition', label: '转换', desc: 'Conflict Option (0.25×仓位)', active: data.regime_state === 'transition' },
                  { state: 'policy_shock', label: '政策冲击', desc: 'γ单引擎 (0.5×仓位)', active: data.regime_state === 'policy_shock' },
                  { state: 'crisis', label: '危机', desc: '熔断器 → 全部平仓', active: data.regime_state === 'crisis' },
                ].map(r => (
                  <div key={r.state} className={`flex items-center gap-2 p-1.5 rounded ${r.active ? 'bg-blue-500/15 border border-blue-500/30' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${r.active ? 'bg-blue-400' : 'bg-slate-600'}`} />
                    <span className={r.active ? 'text-blue-300 font-medium' : 'text-slate-500'}>
                      {r.label}: {r.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: SHAP Conflict Diagnosis */}
          <div className="lg:col-span-1">
            <ShapConflict diagnosis={data.diagnosis} />
          </div>
        </div>

        {/* Architecture explanation */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">架构说明</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-[10px] text-slate-500">
            <div>
              <div className="text-amber-400 font-medium mb-1">γ 规则引擎</div>
              <p>基于宏观因子的因果模型: r_f + π_risk - cy + σ_alert → 0-100评分。优势: 可解释、对新事件有天然响应。</p>
            </div>
            <div>
              <div className="text-blue-400 font-medium mb-1">ML 预测引擎</div>
              <p>XGBoost 10因子模型预测20日DXY回报。优势: 捕捉非线性关系、自适应权重。</p>
            </div>
            <div>
              <div className="text-purple-400 font-medium mb-1">冲突诊断</div>
              <p>Conflict Score = |norm(γ) - norm(ML)| / 2。&gt;0.6 = Regime转换领先指标 (Soros)。SHAP归因定位分歧根源 (Simons)。</p>
            </div>
            <div>
              <div className="text-emerald-400 font-medium mb-1">统一路由</div>
              <p>Normal→3×3矩阵, Transition→Conflict Option (Taleb: 0.25×仓+宽止损), Crisis→熔断器, Policy Shock→γ单引擎。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
