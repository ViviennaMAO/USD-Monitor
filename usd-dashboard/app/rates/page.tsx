'use client'
import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { StatusBar } from '@/components/layout/StatusBar'
import { YieldCurveChart } from '@/components/rates/YieldCurveChart'
import { SofrSpreadChart } from '@/components/rates/SofrSpreadChart'
import { RepoMarketChart } from '@/components/rates/RepoMarketChart'
import type { YieldCurveData, SofrAnalysisData, RepoMarketData } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'yield' | 'sofr' | 'repo'

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: 'yield', label: '收益率曲线', sub: '多期限对比' },
  { id: 'sofr',  label: 'SOFR 分析', sub: '百分位价差' },
  { id: 'repo',  label: '回购市场', sub: '利率监控' },
]

export default function RatesPage() {
  const [tab, setTab] = useState<Tab>('yield')

  const { data: yieldData } = useSWR<YieldCurveData>('/api/rates/yield-curve', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: sofrData } = useSWR<SofrAnalysisData>('/api/rates/sofr', fetcher, { refreshInterval: 5 * 60 * 1000 })
  const { data: repoData } = useSWR<RepoMarketData>('/api/rates/repo', fetcher, { refreshInterval: 5 * 60 * 1000 })

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← 首页</Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">利率</span>
            {tab && (
              <>
                <span className="text-slate-700">/</span>
                <span className="text-sm text-slate-400">{TABS.find(t => t.id === tab)?.label}</span>
              </>
            )}
            <span className="ml-auto text-[10px] text-slate-600 font-mono">USD Monitor · Rates</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 border-b border-slate-800/50 -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="font-semibold">{t.label}</span>
                <span className="text-slate-600 ml-1">· {t.sub}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-200">
            {TABS.find(t => t.id === tab)?.label}
          </h1>
        </div>

        {tab === 'yield' && yieldData && <YieldCurveChart data={yieldData} />}
        {tab === 'yield' && !yieldData && <LoadingPlaceholder />}

        {tab === 'sofr' && sofrData && <SofrSpreadChart data={sofrData} />}
        {tab === 'sofr' && !sofrData && <LoadingPlaceholder />}

        {tab === 'repo' && repoData && <RepoMarketChart data={repoData} />}
        {tab === 'repo' && !repoData && <LoadingPlaceholder />}
      </main>

      <StatusBar warnings={0} messages={3} lastUpdate={new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} modelOnline wsConnected />
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-slate-500 font-mono animate-pulse">Loading data...</div>
    </div>
  )
}
