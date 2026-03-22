'use client'
import type { ScoreData, DxyData } from '@/types'

interface StatCardProps {
  title: string
  subtitle: string
  value: string
  sub: string
  color?: string
  glow?: boolean
}

function StatCard({ title, subtitle, value, sub, color = 'text-white', glow }: StatCardProps) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors ${glow ? 'ring-1 ring-amber-500/20' : ''}`}>
      <div className="text-xs text-slate-500 font-mono uppercase tracking-wider">{title}</div>
      <div className="text-[10px] text-slate-600 mb-2">{subtitle}</div>
      <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

interface DxyStatsGridProps {
  score: ScoreData
  dxy: DxyData
}

export function DxyStatsGrid({ score, dxy }: DxyStatsGridProps) {
  const rfColor = score.rf_score >= 65 ? 'text-emerald-400' : score.rf_score >= 35 ? 'text-amber-400' : 'text-red-400'
  const piColor = score.pi_risk_score >= 65 ? 'text-emerald-400' : score.pi_risk_score >= 35 ? 'text-amber-400' : 'text-red-400'
  const cyColor = score.cy_score >= 65 ? 'text-amber-400' : 'text-emerald-400'
  const sigColor = score.sigma_score >= 65 ? 'text-orange-400' : score.sigma_score >= 35 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        title="DXY 现价"
        subtitle="Yahoo · DX-Y.NYB"
        value={dxy.price.toFixed(2)}
        sub={`${dxy.change_1d >= 0 ? '+' : ''}${dxy.change_1d_pct.toFixed(2)}% 日涨跌`}
        color={dxy.change_1d >= 0 ? 'text-emerald-400' : 'text-red-400'}
        glow
      />
      <StatCard
        title="r_f 利率差"
        subtitle="Rate Differential"
        value={`${score.rf_score}/100`}
        sub="Fed领先ECB +1.50%"
        color={rfColor}
      />
      <StatCard
        title="π_risk 风险溢价"
        subtitle="Risk Premium"
        value={`${score.pi_risk_score}/100`}
        sub={`混合信号 · VIX 18.5`}
        color={piColor}
      />
      <StatCard
        title="cy 便利收益"
        subtitle="Convenience Yield"
        value={`${score.cy_score}/100`}
        sub="黄金上行 · 去美元化"
        color={cyColor}
      />
      <StatCard
        title="σ_alert 预警"
        subtitle="Volatility Alert"
        value={`${score.sigma_score}/100`}
        sub="RR+残差共振"
        color={sigColor}
      />
      <StatCard
        title="实际利率"
        subtitle="10Y TIPS"
        value={`${dxy.real_rate.toFixed(2)}%`}
        sub="10Y − BEI"
        color="text-cyan-400"
      />
    </div>
  )
}
