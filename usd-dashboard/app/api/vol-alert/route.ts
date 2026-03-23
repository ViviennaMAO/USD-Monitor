import { NextResponse } from 'next/server'
import { getLiveData } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { sigma } = await getLiveData()
    // Strip internal rr_zscore field from public response
    const { rr_zscore: _rz, ...publicSigma } = sigma
    void _rz
    return NextResponse.json(publicSigma)
  } catch (e) {
    console.error('[/api/vol-alert]', e)
    return NextResponse.json(mockData.vol_alert)
  }
}
