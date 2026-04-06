'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { StatusBar } from '@/components/layout/StatusBar'
import { FomcTimeline } from '@/components/fed/FomcTimeline'
import type { FedWatchData } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function FedPage() {
  const { data } = useSWR<FedWatchData>('/api/fed/watch', fetcher, { refreshInterval: 5 * 60 * 1000 })

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/90 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-12">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← 首页</Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-slate-200">美联储</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-400">FOMC 追踪 & 鹰鸽指数</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">USD Monitor · Fed Watch</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-200">Fed Watch — FOMC 追踪</h1>
          <p className="text-xs text-slate-500 mt-1">
            FOMC 声明、官员发言时间线 · 鹰鸽指数跟踪
          </p>
        </div>

        {data ? (
          <FomcTimeline data={data} />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-slate-500 font-mono animate-pulse">Loading Fed data...</div>
          </div>
        )}
      </main>

      <StatusBar warnings={0} messages={4} lastUpdate={new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} modelOnline wsConnected />
    </div>
  )
}
