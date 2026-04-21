import { NextResponse } from 'next/server'
import { getLiveData } from '@/lib/liveData'
import type { InflationDiagnosis } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fallback: InflationDiagnosis = {
  type: 'mixed',
  typeLabel: '多因素混合',
  dominantDriver: '加载中',
  components: [],
  headline: '数据加载中...',
}

export async function GET() {
  try {
    const { inflationDiagnosis } = await getLiveData()
    return NextResponse.json(inflationDiagnosis)
  } catch (e) {
    console.error('[/api/inflation-diagnosis]', e)
    return NextResponse.json(fallback)
  }
}
