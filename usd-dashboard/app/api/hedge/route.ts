import { NextResponse } from 'next/server'
import { getLiveSnapshot } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { fred, cb, residual } = await getLiveSnapshot()

    const sofr   = isFinite(fred.sofr)          ? parseFloat(fred.sofr.toFixed(2))          : mockData.hedge.sofr
    const estr   = isFinite(cb.estr)             ? cb.estr                                   : mockData.hedge.estr
    const dxyDiv = isFinite(residual.residual)   ? parseFloat(residual.residual.toFixed(2))  : mockData.hedge.dxy_rate_divergence

    return NextResponse.json({
      score:               mockData.hedge.score,
      cip_basis:           mockData.hedge.cip_basis,
      eur_long:            mockData.hedge.eur_long,
      jpy_long:            mockData.hedge.jpy_long,
      dxy_rate_divergence: dxyDiv,
      sofr,
      estr,
      note: mockData.hedge.note,
    })
  } catch (e) {
    console.error('[/api/hedge]', e)
    return NextResponse.json(mockData.hedge)
  }
}
