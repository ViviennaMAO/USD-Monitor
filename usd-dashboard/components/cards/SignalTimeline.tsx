'use client'
import type { SignalHistoryEntry } from '@/types'

interface SignalTimelineProps {
  history: SignalHistoryEntry[]
}

export function SignalTimeline({ history }: SignalTimelineProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="text-sm font-semibold text-slate-200 mb-4">信号历史时间线 · 7日</div>
      <div className="space-y-2">
        {history.map((entry, i) => {
          const signalConfig = {
            BULLISH: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'BULLISH' },
            NEUTRAL: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'NEUTRAL' },
            BEARISH: { dot: 'bg-red-500', text: 'text-red-400', label: 'BEARISH' },
          }
          const scoreColor =
            entry.score >= 65 ? 'text-emerald-400' :
            entry.score >= 35 ? 'text-amber-400' : 'text-red-400'
          const changeColor =
            entry.change === '↑' ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' :
            entry.change === '↓' ? 'text-red-400 bg-red-500/15 border-red-500/30' :
            'text-slate-400 bg-slate-700/50 border-slate-600'
          const { dot, text, label } = signalConfig[entry.signal]

          return (
            <div key={entry.date} className={`flex items-start gap-3 p-3 rounded-lg border ${i === 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-800/60 hover:border-slate-700 transition-colors'}`}>
              {/* Timeline dot */}
              <div className="flex flex-col items-center mt-1 flex-shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                {i < history.length - 1 && <div className="w-px h-4 bg-slate-700 mt-1" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400">{entry.date}</span>
                  <span className={`text-xs font-semibold ${text}`}>{label}</span>
                  <span className={`text-xs border rounded px-1.5 py-0.5 font-mono ${changeColor}`}>
                    {entry.change} {entry.change === '↑' ? '升档' : entry.change === '↓' ? '降档' : '维持'}
                  </span>
                  <span className={`text-xs font-mono ml-auto ${scoreColor}`}>
                    {entry.score}/100
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{entry.note}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
