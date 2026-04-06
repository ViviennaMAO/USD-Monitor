import { NextResponse } from 'next/server'
import { fredLatest, fredHistoryDated } from '@/lib/fredApi'
import type { YieldCurveData, YieldCurveSnapshot } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// FRED series for each Treasury tenor
const TENOR_SERIES: Record<string, string> = {
  '1M':  'DGS1MO',
  '2M':  'DGS2MO',  // Note: may not exist, fallback
  '3M':  'DGS3MO',
  '4M':  'DGS4MO',  // Note: may not exist
  '6M':  'DGS6MO',
  '1Y':  'DGS1',
  '2Y':  'DGS2',
  '3Y':  'DGS3',
  '5Y':  'DGS5',
  '7Y':  'DGS7',
  '10Y': 'DGS10',
  '20Y': 'DGS20',
  '30Y': 'DGS30',
}

const TENORS = Object.keys(TENOR_SERIES)

// Snapshot offsets in business days
const SNAPSHOTS: { label: string; daysBack: number; color: string }[] = [
  { label: '当前',    daysBack: 0,   color: '#3b82f6' },
  { label: '1个月前', daysBack: 22,  color: '#f59e0b' },
  { label: '6个月前', daysBack: 126, color: '#10b981' },
  { label: '1年前',   daysBack: 252, color: '#ef4444' },
]

export async function GET() {
  try {
    // Fetch all tenor histories in parallel (limit 300 = ~14 months)
    const entries = Object.entries(TENOR_SERIES)
    const histories = await Promise.all(
      entries.map(([, series]) => fredHistoryDated(series, 300))
    )

    // Build map: tenor -> { date -> value }
    const tenorMap: Record<string, Map<string, number>> = {}
    entries.forEach(([tenor], i) => {
      const map = new Map<string, number>()
      histories[i].forEach(h => map.set(h.date, h.value))
      tenorMap[tenor] = map
    })

    // Get all available dates, sorted
    const allDates = [...new Set(histories.flatMap(h => h.map(x => x.date)))].sort()
    if (allDates.length === 0) throw new Error('No FRED data')

    // Build snapshots
    const curves: YieldCurveSnapshot[] = SNAPSHOTS.map(snap => {
      const targetIdx = Math.max(0, allDates.length - 1 - snap.daysBack)
      const targetDate = allDates[targetIdx]

      // Find closest date with data for each tenor
      const data = TENORS.map(tenor => {
        const map = tenorMap[tenor]
        if (!map) return { tenor, value: 0 }
        // Try exact date, then search backward
        if (map.has(targetDate)) return { tenor, value: map.get(targetDate)! }
        for (let j = Math.min(targetIdx, allDates.length - 1); j >= Math.max(0, targetIdx - 5); j--) {
          if (map.has(allDates[j])) return { tenor, value: map.get(allDates[j])! }
        }
        return { tenor, value: 0 }
      }).filter(d => d.value > 0)

      const dateLabel = targetDate.slice(0, 10)
      return {
        label: `${snap.label} (${dateLabel})`,
        date: dateLabel,
        color: snap.color,
        data,
      }
    })

    // Only include tenors that have data in the current snapshot
    const validTenors = curves[0]?.data.map(d => d.tenor) ?? TENORS

    const result: YieldCurveData = { curves, tenors: validTenors }
    return NextResponse.json(result)
  } catch (e) {
    console.error('[yield-curve]', e)
    return NextResponse.json(mockYieldCurve())
  }
}

function mockYieldCurve(): YieldCurveData {
  const tenors = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y']
  const base = [3.75, 3.72, 3.78, 3.80, 3.85, 3.90, 4.05, 4.15, 4.90, 4.95, 4.92]
  return {
    tenors,
    curves: [
      { label: '当前 (2026-04-03)', date: '2026-04-03', color: '#3b82f6', data: tenors.map((t, i) => ({ tenor: t, value: base[i] })) },
      { label: '1个月前 (2026-03-06)', date: '2026-03-06', color: '#f59e0b', data: tenors.map((t, i) => ({ tenor: t, value: base[i] - 0.05 + Math.random() * 0.1 })) },
      { label: '6个月前 (2025-10-08)', date: '2025-10-08', color: '#10b981', data: tenors.map((t, i) => ({ tenor: t, value: base[i] - 0.1 + Math.random() * 0.15 })) },
      { label: '1年前 (2025-04-04)', date: '2025-04-04', color: '#ef4444', data: tenors.map((t, i) => ({ tenor: t, value: base[i] + 0.3 - i * 0.05 })) },
    ],
  }
}
