import { NextResponse } from 'next/server'
import { getLiveData, todayUtc } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { gamma } = await getLiveData()
    return NextResponse.json({
      gamma:          gamma.gamma,
      signal:         gamma.signal,
      rf_score:       gamma.rf_score,
      pi_risk_score:  gamma.pi_risk_score,
      cy_score:       gamma.cy_score,
      sigma_score:    gamma.sigma_score,
      data_date:      todayUtc(),
      data_time:      '实时数据',
    })
  } catch (e) {
    console.error('[/api/score]', e)
    return NextResponse.json(mockData.score)
  }
}
