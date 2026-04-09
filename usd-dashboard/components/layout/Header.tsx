'use client'
import Link from 'next/link'
import { SignalBadge } from '@/components/ui/Badge'
import type { ScoreData, DxyData } from '@/types'

interface HeaderProps {
  score: ScoreData
  dxy: DxyData
}

export function Header({ score, dxy }: HeaderProps) {
  const changeColor = dxy.change_1d >= 0 ? 'text-emerald-400' : 'text-red-400'
  const changeSign = dxy.change_1d >= 0 ? '+' : ''

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0a0e1a]/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">

          {/* Left: title + formula */}
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              ← Daily Dashboard
            </button>
            <Link
              href="/analytics"
              className="text-xs text-slate-500 hover:text-blue-400 transition-colors border border-slate-700 hover:border-blue-500/50 rounded px-2 py-0.5"
            >
              因子分析
            </Link>
            <Link
              href="/rates"
              className="text-xs text-slate-500 hover:text-emerald-400 transition-colors border border-slate-700 hover:border-emerald-500/50 rounded px-2 py-0.5"
            >
              利率
            </Link>
            <Link
              href="/liquidity"
              className="text-xs text-slate-500 hover:text-cyan-400 transition-colors border border-slate-700 hover:border-cyan-500/50 rounded px-2 py-0.5"
            >
              流动性
            </Link>
            <Link
              href="/fed"
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors border border-slate-700 hover:border-amber-500/50 rounded px-2 py-0.5"
            >
              美联储
            </Link>
            <Link
              href="/signal"
              className="text-xs text-slate-500 hover:text-purple-400 transition-colors border border-slate-700 hover:border-purple-500/50 rounded px-2 py-0.5"
            >
              信号路由
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-amber-400 font-mono font-bold text-base tracking-wide">
                  γ = r<sub>f</sub> + π<sub>risk</sub> − cy + σ<sub>alert</sub>
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                USD Valuation Model · v1.0 · {score.data_date} · {score.data_time}
              </div>
            </div>
          </div>

          {/* Right: DXY price + signal + score */}
          <div className="flex items-center gap-6">
            {/* DXY price */}
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">{dxy.price.toFixed(2)}</div>
              <div className={`text-xs font-mono ${changeColor}`}>
                {changeSign}{dxy.change_1d.toFixed(2)} ({changeSign}{dxy.change_1d_pct.toFixed(2)}%)
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            {/* Signal badge */}
            <SignalBadge signal={score.signal} size="md" />

            {/* Score */}
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-0.5">Score</div>
              <div className={`text-xl font-mono font-bold ${score.gamma >= 65 ? 'text-emerald-400' : score.gamma >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                {score.gamma}<span className="text-sm text-slate-500">/100</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            {/* VSTAR trading button */}
            <a
              href="https://share.vstarau.com/sign-page/?lang=zh_CN&inviteCode=s7f5qfhy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/50 transition-all text-sm font-medium whitespace-nowrap"
            >
              <span className="hidden sm:inline">VSTAR</span> 交易
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
