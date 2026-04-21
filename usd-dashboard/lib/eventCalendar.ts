/**
 * Event Calendar — Narrative Event Interceptor (Volcker + Keynes consensus)
 *
 * Known US macro events that cause narrative updates. When within the window:
 *   - imminent (±1 day): suspend signal output, enter observation mode
 *   - approaching (2-3 days): reduce confidence
 *   - post (1-2 days after): allow narrative to settle
 *   - clear: normal operation
 */

import type { UpcomingEvent, EventWindowData } from '@/types'

// ── Known 2026 events (placeholder — update quarterly) ─────────────────────
// Sources: Fed.gov FOMC calendar, BLS release schedule, BEA PCE schedule
const EVENT_CALENDAR_2026: Omit<UpcomingEvent, 'daysUntil'>[] = [
  // FOMC Meetings (8 per year, typically Tue-Wed)
  { date: '2026-01-28', type: 'FOMC',  name: 'FOMC 会议 + 新闻发布会' },
  { date: '2026-03-18', type: 'FOMC',  name: 'FOMC 会议 + SEP 点阵图' },
  { date: '2026-04-29', type: 'FOMC',  name: 'FOMC 会议' },
  { date: '2026-06-17', type: 'FOMC',  name: 'FOMC 会议 + SEP 点阵图' },
  { date: '2026-07-29', type: 'FOMC',  name: 'FOMC 会议' },
  { date: '2026-09-16', type: 'FOMC',  name: 'FOMC 会议 + SEP 点阵图' },
  { date: '2026-11-04', type: 'FOMC',  name: 'FOMC 会议' },
  { date: '2026-12-16', type: 'FOMC',  name: 'FOMC 会议 + SEP 点阵图' },

  // CPI releases (monthly, usually 2nd week of following month)
  { date: '2026-04-10', type: 'CPI', name: '3月 CPI 发布' },
  { date: '2026-05-13', type: 'CPI', name: '4月 CPI 发布' },
  { date: '2026-06-11', type: 'CPI', name: '5月 CPI 发布' },
  { date: '2026-07-15', type: 'CPI', name: '6月 CPI 发布' },
  { date: '2026-08-12', type: 'CPI', name: '7月 CPI 发布' },
  { date: '2026-09-11', type: 'CPI', name: '8月 CPI 发布' },
  { date: '2026-10-15', type: 'CPI', name: '9月 CPI 发布' },
  { date: '2026-11-13', type: 'CPI', name: '10月 CPI 发布' },
  { date: '2026-12-10', type: 'CPI', name: '11月 CPI 发布' },

  // Core PCE (monthly, last week of following month — Fed's preferred gauge)
  { date: '2026-04-30', type: 'PCE', name: '3月 PCE 发布' },
  { date: '2026-05-30', type: 'PCE', name: '4月 PCE 发布' },
  { date: '2026-06-26', type: 'PCE', name: '5月 PCE 发布' },
  { date: '2026-07-31', type: 'PCE', name: '6月 PCE 发布' },
  { date: '2026-08-29', type: 'PCE', name: '7月 PCE 发布' },
  { date: '2026-09-26', type: 'PCE', name: '8月 PCE 发布' },
  { date: '2026-10-31', type: 'PCE', name: '9月 PCE 发布' },
  { date: '2026-11-26', type: 'PCE', name: '10月 PCE 发布' },
  { date: '2026-12-19', type: 'PCE', name: '11月 PCE 发布' },

  // NFP (monthly, first Friday)
  { date: '2026-05-01', type: 'NFP', name: '4月非农就业' },
  { date: '2026-06-05', type: 'NFP', name: '5月非农就业' },
  { date: '2026-07-02', type: 'NFP', name: '6月非农就业' },
  { date: '2026-08-07', type: 'NFP', name: '7月非农就业' },
  { date: '2026-09-04', type: 'NFP', name: '8月非农就业' },
  { date: '2026-10-02', type: 'NFP', name: '9月非农就业' },
  { date: '2026-11-06', type: 'NFP', name: '10月非农就业' },
  { date: '2026-12-04', type: 'NFP', name: '11月非农就业' },
]

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/** Returns current event window status relative to today (ET calendar date). */
export function computeEventWindow(now: Date = new Date()): EventWindowData {
  // Work in calendar-day granularity
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const enriched: UpcomingEvent[] = EVENT_CALENDAR_2026.map(e => {
    const eDate = new Date(e.date + 'T00:00:00')
    return { ...e, daysUntil: daysBetween(today, eDate) }
  })

  // Find events in relevant windows
  const future = enriched.filter(e => e.daysUntil >= -2).sort((a, b) => a.daysUntil - b.daysUntil)
  const upcoming = future.slice(0, 3)

  // Determine status based on nearest event
  const nearest = future[0]
  if (!nearest) {
    return {
      status: 'clear',
      upcoming: [],
      activeEvent: null,
      message: '无即将到来的重大事件',
    }
  }

  const d = nearest.daysUntil

  if (d >= -1 && d <= 1) {
    // Imminent: today or tomorrow
    return {
      status: 'imminent',
      upcoming,
      activeEvent: nearest,
      message: d === 0
        ? `今天: ${nearest.name} — 信号进入观察模式,等待叙事更新`
        : d === 1
        ? `明天: ${nearest.name} — 建议暂缓决策,等待数据发布`
        : `昨天: ${nearest.name} — 市场仍在消化,信号权重降低`,
    }
  }

  if (d >= 2 && d <= 3) {
    return {
      status: 'approaching',
      upcoming,
      activeEvent: nearest,
      message: `${d}天后: ${nearest.name} — 建议降低仓位敏感度`,
    }
  }

  if (d === -2) {
    return {
      status: 'post',
      upcoming,
      activeEvent: nearest,
      message: `${nearest.name}已过2天 — 叙事基本消化,信号恢复常态`,
    }
  }

  return {
    status: 'clear',
    upcoming,
    activeEvent: null,
    message: `下一重大事件: ${nearest.name} (${d}天后)`,
  }
}
