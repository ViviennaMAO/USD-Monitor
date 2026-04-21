'use client'
import type { EventWindowData, EventWindowStatus, UpcomingEvent } from '@/types'

const STATUS_CONFIG: Record<EventWindowStatus, {
  color: string
  bg: string
  border: string
  icon: string
  label: string
}> = {
  imminent:    { color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/50',     icon: '⚠', label: '观察模式' },
  approaching: { color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   icon: '⏰', label: '事件临近' },
  post:        { color: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    icon: '↻', label: '信号恢复' },
  clear:       { color: 'text-slate-400',   bg: 'bg-slate-800/40',   border: 'border-slate-700/40',   icon: '📅', label: '日历' },
}

const EVENT_TYPE_COLOR: Record<UpcomingEvent['type'], string> = {
  FOMC: 'text-purple-400',
  CPI:  'text-red-400',
  PCE:  'text-orange-400',
  NFP:  'text-emerald-400',
  GDP:  'text-cyan-400',
}

function formatDaysUntil(d: number): string {
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  if (d === -1) return '昨天'
  if (d < 0) return `${-d}天前`
  return `${d}天后`
}

export function EventInterceptor({ data }: { data: EventWindowData }) {
  const cfg = STATUS_CONFIG[data.status]
  const isActive = data.status === 'imminent' || data.status === 'approaching'

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-3 ${isActive ? 'shadow-lg' : ''} transition-all`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${cfg.color} text-xl flex-shrink-0 mt-0.5 ${
          data.status === 'imminent' ? 'animate-pulse' : ''
        }`}>
          {cfg.icon}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            {isActive && (
              <span className="px-1.5 py-0.5 bg-slate-900/60 rounded text-[10px] text-slate-400 font-mono">
                narrative interceptor
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{data.message}</p>

          {/* Upcoming events list */}
          {data.upcoming.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
              {data.upcoming.map(e => (
                <div key={e.date} className="flex items-center gap-1.5 text-[11px]">
                  <span className={`font-semibold font-mono ${EVENT_TYPE_COLOR[e.type]}`}>
                    {e.type}
                  </span>
                  <span className="text-slate-500 font-mono">{e.date.slice(5)}</span>
                  <span className="text-slate-400">{formatDaysUntil(e.daysUntil)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
