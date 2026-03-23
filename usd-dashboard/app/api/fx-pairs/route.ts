import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function sig(chgPct: number): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  return chgPct > 0.3 ? 'BULLISH' : chgPct < -0.3 ? 'BEARISH' : 'NEUTRAL'
}

function safeFixed(v: number, d: number): number {
  return isFinite(v) ? parseFloat(v.toFixed(d)) : NaN
}

export async function GET() {
  try {
    const { yahoo } = await getLiveSnapshot()

    // If Yahoo Finance is unavailable, return mock fx data (prevents null crash)
    if (!isFinite(yahoo.dxy)) {
      return NextResponse.json(mockData.fx)
    }

    const fx = yahoo.fx_trend

    function trendChg(key: 'eurusd' | 'usdjpy' | 'dxy'): number {
      if (fx.length < 2) return 0
      const prev = fx[fx.length - 2][key]
      const last = fx[fx.length - 1][key]
      if (!isFinite(prev) || !isFinite(last) || prev === 0) return 0
      return parseFloat(((last - prev) / prev * 100).toFixed(2))
    }

    const dxyChg = trendChg('dxy')
    const eurChg = trendChg('eurusd')
    const jpyChg = trendChg('usdjpy')

    // Use mock price as fallback for any individual pair that failed
    const mockPairs = mockData.fx.pairs

    return NextResponse.json({
      pairs: [
        { symbol: 'DXY',    label: 'DXY Index', price: safeFixed(yahoo.dxy,    2) || mockPairs[0].price, change_pct: dxyChg, signal: sig(dxyChg) },
        { symbol: 'EURUSD', label: 'EUR/USD',   price: safeFixed(yahoo.eurusd, 4) || mockPairs[1].price, change_pct: eurChg, signal: sig(eurChg) },
        { symbol: 'USDJPY', label: 'USD/JPY',   price: safeFixed(yahoo.usdjpy, 2) || mockPairs[2].price, change_pct: jpyChg, signal: sig(jpyChg) },
        { symbol: 'USDCNY', label: 'USD/CNY',   price: safeFixed(yahoo.usdcny, 4) || mockPairs[3].price, change_pct: 0,      signal: 'NEUTRAL' },
        { symbol: 'USDMXN', label: 'USD/MXN',   price: safeFixed(yahoo.usdmxn, 2) || mockPairs[4].price, change_pct: 0,      signal: 'NEUTRAL' },
      ],
      trend: fx.length > 0 ? fx : mockData.fx.trend,
    })
  } catch (e) {
    console.error('[/api/fx-pairs]', e)
    return NextResponse.json(mockData.fx)
  }
}
