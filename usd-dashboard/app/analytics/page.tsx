'use client'
import { useState } from 'react'
import Link from 'next/link'
import { AnalyticsTabs, type AnalyticsTab } from '@/components/layout/AnalyticsTabs'
import { StatusBar } from '@/components/layout/StatusBar'
import { IcTracking } from '@/components/analytics/IcTracking'
import { ShapWaterfall } from '@/components/analytics/ShapWaterfall'
import { RegimeHeatmap } from '@/components/analytics/RegimeHeatmap'
import { CorrelationMatrix } from '@/components/analytics/CorrelationMatrix'
import { NavCurve } from '@/components/analytics/NavCurve'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('ic')

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
              ← 估值看板
            </Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">因子分析</span>
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
            {activeTab === 'shap'        && 'SHAP 归因 — 因子边际贡献瀑布图'}
            {activeTab === 'ic'          && 'IC 追踪 — 信息系数时序'}
            {activeTab === 'regime'      && 'Regime — 利率周期因子效力热力图'}
            {activeTab === 'correlation' && '相关性矩阵 — 因子共线性分析'}
            {activeTab === 'nav'         && '净值曲线 — 信号回测账户表现'}
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {activeTab === 'shap'        && '基于 SHAP 值分解当日各因子对 γ 评分的边际贡献'}
            {activeTab === 'ic'          && '滚动 252 日信息系数时序 · Regime 背景着色'}
            {activeTab === 'regime'      && '各因子在加息期 / 降息期 / 震荡期的平均 IC 表现'}
            {activeTab === 'correlation' && '因子两两 Pearson 相关系数 · 悬停查看详情'}
            {activeTab === 'nav'         && 'γ 信号驱动的虚拟策略净值 · 不含交易成本'}
          </p>
        </div>

        {activeTab === 'shap'        && <ShapWaterfall />}
        {activeTab === 'ic'          && <IcTracking />}
        {activeTab === 'regime'      && <RegimeHeatmap />}
        {activeTab === 'correlation' && <CorrelationMatrix />}
        {activeTab === 'nav'         && <NavCurve />}
      </main>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <StatusBar warnings={1} messages={5} lastUpdate="17:02" modelOnline wsConnected />
    </div>
  )
}
