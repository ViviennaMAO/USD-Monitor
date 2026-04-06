'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { StatusBar } from '@/components/layout/StatusBar'
import { FxSwapChart } from '@/components/liquidity/FxSwapChart'
import type { FxSwapData } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function LiquidityPage() {
  const { data } = useSWR<FxSwapData>('/api/liquidity/fx-swap', fetcher, { refreshInterval: 5 * 60 * 1000 })

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← 首页</Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">流动性</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-400">FX Swap 期限结构</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">USD Monitor · Liquidity</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-200">FX Swap 期限结构</h1>
          <p className="text-xs text-slate-500 mt-1">
            各主要货币对的掉期点期限结构 · 评估离岸美元融资松紧
          </p>
        </div>

        {data ? (
          <FxSwapChart data={data} />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-slate-500 font-mono animate-pulse">Loading swap data...</div>
          </div>
        )}
      </main>

      <StatusBar warnings={0} messages={2} lastUpdate={new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} modelOnline wsConnected />
    </div>
  )
}
