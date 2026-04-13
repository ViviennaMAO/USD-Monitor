'use client'
import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { StatusBar } from '@/components/layout/StatusBar'
import { CorrelationMatrix } from '@/components/analytics/CorrelationMatrix'
import { YieldCurveChart } from '@/components/rates/YieldCurveChart'
import { SofrSpreadChart } from '@/components/rates/SofrSpreadChart'
import { RepoMarketChart } from '@/components/rates/RepoMarketChart'
import { FxSwapChart } from '@/components/liquidity/FxSwapChart'
import { FomcTimeline } from '@/components/fed/FomcTimeline'
import type {
  YieldCurveData, SofrAnalysisData, RepoMarketData,
  FxSwapData, FedWatchData,
} from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'correlation' | 'rates' | 'liquidity' | 'fed'

const TABS: { id: Tab; label: string; color: string; activeColor: string }[] = [
  { id: 'correlation', label: '跨资产相关性', color: 'text-slate-500', activeColor: 'border-cyan-500 text-cyan-400' },
  { id: 'rates',       label: '利率验证',     color: 'text-slate-500', activeColor: 'border-emerald-500 text-emerald-400' },
  { id: 'liquidity',   label: '流动性验证',   color: 'text-slate-500', activeColor: 'border-blue-500 text-blue-400' },
  { id: 'fed',         label: '美联储',       color: 'text-slate-500', activeColor: 'border-amber-500 text-amber-400' },
]

export default function MarketPage() {
  const [tab, setTab] = useState<Tab>('correlation')

  // Data fetching
  const { data: corrData }  = useSWR('/api/correlation', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: yieldData } = useSWR<YieldCurveData>('/api/rates/yield-curve', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: sofrData }  = useSWR<SofrAnalysisData>('/api/rates/sofr', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: repoData }  = useSWR<RepoMarketData>('/api/rates/repo', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: swapData }  = useSWR<FxSwapData>('/api/liquidity/fx-swap', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: fedData }   = useSWR<FedWatchData>('/api/fed/watch', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: unified }   = useSWR('/api/unified-signal', fetcher, { refreshInterval: 5 * 60 * 1000 })

  // Rates sub-tab
  const [ratesSub, setRatesSub] = useState<'yield' | 'sofr' | 'repo'>('yield')

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← 总览</Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">市场</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-400">{TABS.find(t => t.id === tab)?.label}</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">USD Monitor · Market</span>
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 border-b border-slate-800/50 -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id ? t.activeColor : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">

        {/* ═══ Tab: Cross-Asset Correlation ═══ */}
        {tab === 'correlation' && (
          <div>
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-200">跨资产相关性矩阵</h1>
              <p className="text-xs text-slate-500 mt-1">
                因子间 Pearson 相关系数 · 检测多重共线性与分散化机会
              </p>
            </div>
            {corrData ? (
              <CorrelationMatrix />
            ) : (
              <LoadingPlaceholder />
            )}

            {/* Verification summary */}
            {unified && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <VerifyCard
                  title="美元-黄金"
                  value={corrData?.matrix?.[3]?.[2]?.toFixed(2) || '--'}
                  desc="负相关 → 对冲价值高"
                  status={corrData?.matrix?.[3]?.[2] < -0.4 ? 'confirmed' : 'pending'}
                />
                <VerifyCard
                  title="美元-新兴市场"
                  value={corrData?.matrix?.[3]?.[0]?.toFixed(2) || '--'}
                  desc="正相关 → 资金回流效应"
                  status={corrData?.matrix?.[3]?.[0] > 0.3 ? 'confirmed' : 'pending'}
                />
                <VerifyCard
                  title="股债相关性"
                  value={corrData?.matrix?.[0]?.[1]?.toFixed(2) || '--'}
                  desc="决定风险平价有效性"
                  status="info"
                />
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab: Rates ═══ */}
        {tab === 'rates' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-200">利率验证</h1>
                <p className="text-xs text-slate-500 mt-1">收益率曲线 · SOFR · 回购市场</p>
              </div>
              <div className="flex gap-2">
                {(['yield', 'sofr', 'repo'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setRatesSub(s)}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      ratesSub === s
                        ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                        : 'border-slate-700 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {s === 'yield' ? '收益率曲线' : s === 'sofr' ? 'SOFR' : '回购市场'}
                  </button>
                ))}
              </div>
            </div>

            {/* Rates verification indicators */}
            {unified && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <IndicatorPill label="利差 (US-EU)" value={fmtFactor(unified.factors?.F1_RateDiff)} action={unified.action} factor="F1" />
                <IndicatorPill label="实际利率" value={fmtFactor(unified.factors?.F2_RealRate)} action={unified.action} factor="F2" />
                <IndicatorPill label="期限利差" value={fmtFactor(unified.factors?.F3_TermSpread)} action={unified.action} factor="F3" />
                <IndicatorPill label="通胀预期" value={fmtFactor(unified.factors?.F5_BEI)} action={unified.action} factor="F5" />
                <IndicatorPill label="加息路径" value={fmtFactor(unified.factors?.F6_RatePath)} action={unified.action} factor="F6" />
              </div>
            )}

            {ratesSub === 'yield' && (yieldData ? <YieldCurveChart data={yieldData} /> : <LoadingPlaceholder />)}
            {ratesSub === 'sofr' && (sofrData ? <SofrSpreadChart data={sofrData} /> : <LoadingPlaceholder />)}
            {ratesSub === 'repo' && (repoData ? <RepoMarketChart data={repoData} /> : <LoadingPlaceholder />)}
          </div>
        )}

        {/* ═══ Tab: Liquidity ═══ */}
        {tab === 'liquidity' && (
          <div>
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-200">流动性验证</h1>
              <p className="text-xs text-slate-500 mt-1">
                FX Swap 期限结构 · SOFR/IORB 压力 · 波动率价差
              </p>
            </div>

            {/* Liquidity verification indicators */}
            {unified && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <IndicatorPill label="信用利差" value={fmtFactor(unified.factors?.F8_CreditSpread)} action={unified.action} factor="F8" />
                <IndicatorPill label="波动率价差" value={fmtFactor(unified.factors?.F9_VolSpread)} action={unified.action} factor="F9" />
                <IndicatorPill label="SOFR压力" value={fmtFactor(unified.factors?.F10_FundingStress)} action={unified.action} factor="F10" />
                <IndicatorPill label="VIX" value={fmtFactor(unified.factors?.F4_VIX)} action={unified.action} factor="F4" />
              </div>
            )}

            {swapData ? <FxSwapChart data={swapData} /> : <LoadingPlaceholder />}
          </div>
        )}

        {/* ═══ Tab: Fed ═══ */}
        {tab === 'fed' && (
          <div>
            <div className="mb-4">
              <h1 className="text-lg font-semibold text-slate-200">Fed Watch — FOMC 追踪</h1>
              <p className="text-xs text-slate-500 mt-1">
                FOMC 声明、官员发言时间线 · 鹰鸽指数跟踪
              </p>
            </div>
            {fedData ? <FomcTimeline data={fedData} /> : <LoadingPlaceholder />}
          </div>
        )}

      </main>

      <StatusBar
        warnings={0}
        messages={3}
        lastUpdate={new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        modelOnline
        wsConnected
      />
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────────────

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-slate-500 font-mono animate-pulse">Loading data...</div>
    </div>
  )
}

function fmtFactor(v: number | undefined): string {
  if (v === undefined || v === null) return '--'
  return v.toFixed(2) + 'σ'
}

function IndicatorPill({ label, value, action, factor }: { label: string; value: string; action?: string; factor: string }) {
  const v = parseFloat(value) || 0
  const act = (action || '').toUpperCase()
  const isAligned = (act === 'LONG' && v > 0.5) || (act === 'SHORT' && v < -0.5)
  const statusColor = isAligned ? 'border-emerald-500/40 bg-emerald-500/5' : Math.abs(v) > 0.3 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700 bg-slate-900/60'
  const dotColor = isAligned ? 'bg-emerald-400' : Math.abs(v) > 0.3 ? 'bg-amber-400' : 'bg-slate-600'

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${statusColor}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-500 truncate">{label}</div>
        <div className="text-xs font-mono font-semibold text-slate-200">{value}</div>
      </div>
    </div>
  )
}

function VerifyCard({ title, value, desc, status }: { title: string; value: string; desc: string; status: 'confirmed' | 'pending' | 'info' }) {
  const borderColor = status === 'confirmed' ? 'border-emerald-500/30' : status === 'pending' ? 'border-amber-500/30' : 'border-slate-700'
  const badgeColor = status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400' : status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700 text-slate-400'
  const badgeText = status === 'confirmed' ? '已确认' : status === 'pending' ? '待确认' : '参考'

  return (
    <div className={`bg-slate-900/60 border ${borderColor} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{title}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badgeText}</span>
      </div>
      <div className="text-xl font-mono font-bold text-slate-200 mb-1">{value}</div>
      <div className="text-[10px] text-slate-500">{desc}</div>
    </div>
  )
}
