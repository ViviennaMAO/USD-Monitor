import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function signal(chgPct: number): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  return chgPct > 0.3 ? 'BULLISH' : chgPct < -0.3 ? 'BEARISH' : 'NEUTRAL'
}

export async function GET() {
  try {
    const { yahoo } = await getLiveSnapshot()
    const fx = yahoo.fx_trend

    // 1-day change from 7-day trend (last two entries)
    function trendChg(key: 'eurusd' | 'usdjpy' | 'dxy'): number {
      if (fx.length < 2) return 0
      const prev = fx[fx.length - 2][key]
      const last = fx[fx.length - 1][key]
      if (!isFinite(prev) || !isFinite(last) || prev === 0) return 0
      return parseFloat(((last - prev) / prev * 100).toFixed(2))
    }

    const dxyChg  = trendChg('dxy')
    const eurChg  = trendChg('eurusd')
    const jpyChg  = trendChg('usdjpy')

    return NextResponse.json({
      pairs: [
        { symbol: 'DXY',    label: 'DXY Index', price: parseFloat(yahoo.dxy.toFixed(2)),    change_pct: dxyChg, signal: signal(dxyChg) },
        { symbol: 'EURUSD', label: 'EUR/USD',   price: parseFloat(yahoo.eurusd.toFixed(4)),  change_pct: eurChg, signal: signal(eurChg) },
        { symbol: 'USDJPY', label: 'USD/JPY',   price: parseFloat(yahoo.usdjpy.toFixed(2)),  change_pct: jpyChg, signal: signal(jpyChg) },
        { symbol: 'USDCNY', label: 'USD/CNY',   price: parseFloat(yahoo.usdcny.toFixed(4)),  change_pct: 0,      signal: 'NEUTRAL' },
        { symbol: 'USDMXN', label: 'USD/MXN',   price: parseFloat(yahoo.usdmxn.toFixed(2)),  change_pct: 0,      signal: 'NEUTRAL' },
      ],
      trend: fx,
    })
  } catch (e) {
    console.error('[/api/fx-pairs]', e)
    return NextResponse.json(mockData.fx)
  }
}
