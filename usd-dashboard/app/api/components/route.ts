import { NextResponse } from 'next/server'
import { getLiveData } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { rf, pi, cy } = await getLiveData()
    return NextResponse.json({ rf, pi_risk: pi, cy })
  } catch (e) {
    console.error('[/api/components]', e)
    return NextResponse.json({ rf: mockData.rf, pi_risk: mockData.pi_risk, cy: mockData.cy })
  }
}
