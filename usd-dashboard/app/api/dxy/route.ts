import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { yahoo, fred } = await getLiveSnapshot()

    const hist = yahoo.dxy_history
    const price = yahoo.dxy
    const prevPrice = hist.length >= 2 ? hist[hist.length - 2].price : price
    const change1d    = parseFloat((price - prevPrice).toFixed(3))
    const change1dPct = parseFloat((change1d / prevPrice * 100).toFixed(3))

    const prices = hist.map((h) => h.price).filter(isFinite)
    const high52w = prices.length > 0 ? parseFloat(Math.max(...prices).toFixed(2)) : mockData.dxy.high_52w
    const low52w  = prices.length > 0 ? parseFloat(Math.min(...prices).toFixed(2)) : mockData.dxy.low_52w

    return NextResponse.json({
      price:          parseFloat(price.toFixed(3)),
      change_1d:      change1d,
      change_1d_pct:  change1dPct,
      high_52w:       high52w,
      low_52w:        low52w,
      real_rate:      parseFloat((fred.tips10y ?? mockData.dxy.real_rate).toFixed(2)),
      sofr:           parseFloat((fred.sofr    ?? mockData.dxy.sofr).toFixed(2)),
      history:        hist,
    })
  } catch (e) {
    console.error('[/api/dxy]', e)
    return NextResponse.json(mockData.dxy)
  }
}
