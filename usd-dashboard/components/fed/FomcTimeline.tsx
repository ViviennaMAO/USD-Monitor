'use client'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { FedWatchData, FomcEntry, HawkDoveScore } from '@/types'

interface Props { data: FedWatchData }

const HAWKDOVE_LABELS: Record<HawkDoveScore, { text: string; color: string; bg: string }> = {
  [-2]: { text: '极鸽', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  [-1]: { text: '偏鸽', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  [0]:  { text: '中性', color: 'text-slate-400', bg: 'bg-slate-500/15 border-slate-500/30' },
  [1]:  { text: '偏鹰', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  [2]:  { text: '极鹰', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
}

const HAWKDOVE_BAR_COLORS: Record<number, string> = {
  [-2]: '#3b82f6',
  [-1]: '#06b6d4',
  [0]:  '#64748b',
  [1]:  '#f59e0b',
  [2]:  '#ef4444',
}

function TypeBadge({ type }: { type: FomcEntry['type'] }) {
  const styles: Record<string, string> = {
    meeting: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    minutes: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    speech:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  const labels: Record<string, string> = {
    meeting: 'FOMC会议',
    minutes: '会议纪要',
    speech:  '官员发言',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

export function FomcTimeline({ data }: Props) {
  const { timeline, hawkdove_trend, current_rate, next_meeting, dot_plot_median } = data

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '当前利率', value: `${current_rate.toFixed(3)}%`, color: 'text-blue-400' },
          { label: '点阵图中位数', value: `${dot_plot_median.toFixed(3)}%`, color: 'text-amber-400' },
          { label: '下次会议', value: next_meeting, color: 'text-emerald-400' },
          { label: '鹰鸽均值 (MA5)', value: hawkdove_trend.length > 0 ? `${hawkdove_trend[hawkdove_trend.length - 1].ma5 > 0 ? '+' : ''}${hawkdove_trend[hawkdove_trend.length - 1].ma5.toFixed(1)}` : '0', color: hawkdove_trend.length > 0 && hawkdove_trend[hawkdove_trend.length - 1].ma5 > 0 ? 'text-red-400' : 'text-blue-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-1">{c.label}</div>
            <div className={`font-mono font-semibold text-sm ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Hawk/Dove trend chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">鹰鸽指数时序</h3>
        <p className="text-[10px] text-slate-500 mb-3">&gt;0 偏鹰 · &lt;0 偏鸽 · MA5 移动均值</p>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={hawkdove_trend} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              domain={[-2.5, 2.5]}
              ticks={[-2, -1, 0, 1, 2]}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              formatter={(val, name) => {
                if (name === 'score') return [Number(val), '鹰鸽值']
                return [Number(val).toFixed(2), 'MA5']
              }}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="2 2" />
            <Bar dataKey="score" barSize={16} radius={[2, 2, 0, 0]}>
              {hawkdove_trend.map((entry, idx) => (
                <Cell key={idx} fill={HAWKDOVE_BAR_COLORS[entry.score] ?? '#64748b'} fillOpacity={0.6} />
              ))}
            </Bar>
            <Line dataKey="ma5" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/60" />鹰派</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/60" />偏鹰</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500/60" />中性</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-500/60" />偏鸽</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/60" />鸽派</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 rounded" />MA5</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">FOMC 声明 & 官员发言时间线</h3>

        <div className="space-y-4">
          {timeline.map((entry, i) => {
            const hd = HAWKDOVE_LABELS[entry.hawkdove]
            return (
              <div key={i} className="relative pl-6 border-l-2 border-slate-700/50 pb-2">
                {/* Timeline dot */}
                <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${
                  entry.type === 'meeting' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />

                {/* Header */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-slate-500">{entry.date}</span>
                  <TypeBadge type={entry.type} />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${hd.bg}`}>{hd.text}</span>
                  {entry.has_vote && (
                    <span className="text-[9px] text-emerald-500/70">有投票权</span>
                  )}
                </div>

                {/* Speaker + Title */}
                <div className="text-xs font-medium text-slate-200 mb-1">
                  {entry.speaker && <span className="text-blue-400">{entry.speaker}: </span>}
                  {entry.title}
                </div>

                {/* Summary */}
                <p className="text-[11px] text-slate-400 leading-relaxed">{entry.summary}</p>

                {/* Key quotes */}
                {entry.key_quotes && entry.key_quotes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {entry.key_quotes.map((q, j) => (
                      <blockquote key={j} className="text-[10px] text-slate-500 italic border-l-2 border-slate-700 pl-2">
                        {q}
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Overall assessment */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
        <div className="text-[10px] text-slate-500 mb-1">🔍 联储立场综合评估</div>
        <div className="text-xs text-slate-300 leading-relaxed">{data.assessment}</div>
      </div>
    </div>
  )
}
