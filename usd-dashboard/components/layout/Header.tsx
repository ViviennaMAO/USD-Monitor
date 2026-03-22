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
              因子分析 →
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
          </div>
        </div>
      </div>
    </header>
  )
}
