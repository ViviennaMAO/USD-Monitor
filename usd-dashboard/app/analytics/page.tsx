'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AnalyticsTabs, type AnalyticsTab } from '@/components/layout/AnalyticsTabs'
import { StatusBar } from '@/components/layout/StatusBar'
import { IcTracking } from '@/components/analytics/IcTracking'
import { ShapWaterfall } from '@/components/analytics/ShapWaterfall'
import { RegimeHeatmap } from '@/components/analytics/RegimeHeatmap'
import { CorrelationMatrix } from '@/components/analytics/CorrelationMatrix'
import { NavCurve } from '@/components/analytics/NavCurve'
import { VolAlertCard } from '@/components/cards/VolAlertCard'
import { useVolAlert, volAlertHistory } from '@/lib/useUsdData'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('factors')
  const { data: volAlert } = useVolAlert()

  // Model health state
  const [healthData, setHealthData] = useState<any>(null)
  const [cpcvData, setCpcvData] = useState<any>(null)

  useEffect(() => {
    if (activeTab === 'health') {
      Promise.all([
        fetch('/api/unified-signal').then(r => r.json()).catch(() => null),
        fetch('/api/nav').then(r => r.json()).catch(() => null),
      ]).then(([signal, nav]) => {
        setHealthData(signal)
        setCpcvData(nav)
      })
    }
  }, [activeTab])

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
              ← 总览
            </Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">分析</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">USD Valuation Model · v1.0</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-medium text-slate-300">
            {activeTab === 'factors'     && '波动率看板 — 12因子实时监控'}
            {activeTab === 'shap'        && 'SHAP 归因 — 因子边际贡献瀑布图'}
            {activeTab === 'ic'          && 'IC 追踪 — 信息系数时序'}
            {activeTab === 'regime'      && 'Regime — 利率周期因子效力热力图'}
            {activeTab === 'correlation' && '相关性矩阵 — 因子共线性分析'}
            {activeTab === 'nav'         && '净值曲线 — 信号回测账户表现'}
            {activeTab === 'health'      && '模型健康 — 诊断与熔断'}
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {activeTab === 'factors'     && 'σ_alert 波动率预警 · 跨资产隐含波动率 · 交叉复合信号'}
            {activeTab === 'shap'        && '基于 SHAP 值分解当日各因子对 γ 评分的边际贡献'}
            {activeTab === 'ic'          && '滚动 252 日信息系数时序 · Regime 背景着色'}
            {activeTab === 'regime'      && '各因子在加息期 / 降息期 / 震荡期的平均 IC 表现'}
            {activeTab === 'correlation' && '因子两两 Pearson 相关系数 · 悬停查看详情'}
            {activeTab === 'nav'         && 'γ 信号驱动的虚拟策略净值 · 不含交易成本'}
            {activeTab === 'health'      && 'OOS IC · CPCV 验证 · 熔断机制状态'}
          </p>
        </div>

        {activeTab === 'factors'     && <VolAlertCard data={volAlert} history={volAlertHistory} />}
        {activeTab === 'shap'        && <ShapWaterfall />}
        {activeTab === 'ic'          && <IcTracking />}
        {activeTab === 'regime'      && <RegimeHeatmap />}
        {activeTab === 'correlation' && <CorrelationMatrix />}
        {activeTab === 'nav'         && <NavCurve />}
        {activeTab === 'health'      && <ModelHealthPanel data={healthData} cpcv={cpcvData} />}
      </main>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <StatusBar warnings={1} messages={5} lastUpdate="17:02" modelOnline wsConnected />
    </div>
  )
}

// ── Model Health Panel ─────────────────────────────────────────────────────

function ModelHealthPanel({ data, cpcv }: { data: any; cpcv: any }) {
  if (!data && !cpcv) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-500 font-mono animate-pulse">Loading model health...</div>
      </div>
    )
  }

  const confScore = data?.conflict_score ?? 0
  const regime = data?.regime_detail?.regime ?? data?.regime_state ?? '--'
  const totalReturn = cpcv?.total_return ?? 0
  const sharpe = cpcv?.sharpe ?? 0
  const maxDD = cpcv?.max_drawdown ?? 0

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">模型运行状态</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            confScore < 0.2 ? 'bg-emerald-500/15 text-emerald-400' :
            confScore < 0.5 ? 'bg-amber-500/15 text-amber-400' :
            'bg-red-500/15 text-red-400'
          }`}>
            {confScore < 0.2 ? '正常运行' : confScore < 0.5 ? '需关注' : '高冲突'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="冲突分" value={confScore.toFixed(2)} status={confScore < 0.2 ? 'good' : confScore < 0.5 ? 'warn' : 'bad'} />
          <MetricCard label="Regime" value={regime} status="info" />
          <MetricCard label="信号源" value={data?.signal_source ?? '--'} status="info" />
          <MetricCard label="操作" value={data?.action ?? '--'} status={data?.action === 'LONG' ? 'good' : data?.action === 'SHORT' ? 'bad' : 'warn'} />
        </div>
      </div>

      {/* Backtest Stats */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">回测表现</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="总收益" value={`${(totalReturn * 100).toFixed(2)}%`} status={totalReturn > 0 ? 'good' : 'bad'} />
          <MetricCard label="Sharpe" value={sharpe.toFixed(3)} status={sharpe > 0.5 ? 'good' : sharpe > 0 ? 'warn' : 'bad'} />
          <MetricCard label="Max DD" value={`${(maxDD * 100).toFixed(2)}%`} status={maxDD > -0.1 ? 'good' : maxDD > -0.15 ? 'warn' : 'bad'} />
        </div>
      </div>

      {/* Circuit Breaker Rules */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">熔断机制规则</h2>
        <div className="space-y-3">
          <RuleRow label="DD > 5%" action="仓位减半" active={maxDD < -0.05} />
          <RuleRow label="DD > 8%" action="暂停交易" active={maxDD < -0.08} />
          <RuleRow label="DD > 15%" action="强制平仓" active={maxDD < -0.15} />
          <RuleRow label="IC < 0.05" action="休眠模式" active={false} />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, status }: { label: string; value: string; status: 'good' | 'warn' | 'bad' | 'info' }) {
  const dotColor = status === 'good' ? 'bg-emerald-400' : status === 'warn' ? 'bg-amber-400' : status === 'bad' ? 'bg-red-400' : 'bg-blue-400'
  return (
    <div className="bg-slate-800/40 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <div className="text-sm font-mono font-semibold text-slate-200">{value}</div>
    </div>
  )
}

function RuleRow({ label, action, active }: { label: string; action: string; active: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
      active ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/30'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${active ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className={`text-xs font-medium ${active ? 'text-red-400' : 'text-slate-500'}`}>{action}</span>
    </div>
  )
}
