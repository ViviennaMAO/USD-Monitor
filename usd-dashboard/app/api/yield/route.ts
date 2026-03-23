import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { fred } = await getLiveSnapshot()

    const dgs10  = isFinite(fred.dgs10)  ? fred.dgs10  : mockData.yield_decomp.nominal_10y
    const tips10 = isFinite(fred.tips10y) ? fred.tips10y : mockData.yield_decomp.real_rate
    const bei10  = isFinite(fred.bei10y) ? fred.bei10y  : mockData.yield_decomp.bei_10y
    const bei5   = isFinite(fred.bei5y)  ? fred.bei5y   : mockData.yield_decomp.bei_5y
    const dgs2   = isFinite(fred.dgs2)   ? fred.dgs2    : 4.62

    const tpApprox = parseFloat(((dgs10 - dgs2) * 100).toFixed(1))
    const drivers: Record<string, number> = {
      real_rate:    tips10,
      inflation:    bei10,
      term_premium: Math.max(0, tpApprox / 100),
    }
    const driver = Object.entries(drivers).sort((a, b) => b[1] - a[1])[0][0] as
      'real_rate' | 'inflation' | 'term_premium'
    const driverLabel =
      driver === 'real_rate' ? '实际利率' : driver === 'inflation' ? '通胀预期' : '期限溢价'

    return NextResponse.json({
      nominal_10y:  parseFloat(dgs10.toFixed(2)),
      real_rate:    parseFloat(tips10.toFixed(2)),
      bei_10y:      parseFloat(bei10.toFixed(2)),
      term_premium: parseFloat((tpApprox / 100).toFixed(3)),
      driver,
      bei_5y:       parseFloat(bei5.toFixed(2)),
      note:
        `当前10Y收益率${dgs10.toFixed(2)}%由${driverLabel}主导。` +
        `BEI通胀预期${bei10.toFixed(2)}%，期限溢价${tpApprox >= 0 ? '+' : ''}${tpApprox.toFixed(0)}bps（10Y-2Y利差近似）。`,
    })
  } catch (e) {
    console.error('[/api/yield]', e)
    return NextResponse.json(mockData.yield_decomp)
  }
}
