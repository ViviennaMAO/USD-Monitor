import { NextResponse } from 'next/server'
import { getLiveData, todayUtc } from '@/lib/liveData'
import type { DcaSignalData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fallback: DcaSignalData = {
  rhythm: 'hold',
  label: '维持不变',
  fragility: 50,
  confidence: 3,
  consensus: { bullish: 5, neutral: 4, bearish: 3, total: 12, alignment: 0.42 },
  reason: '数据加载中...',
}

export async function GET() {
  try {
    const { dcaSignal } = await getLiveData()
    return NextResponse.json(dcaSignal)
  } catch (e) {
    console.error('[/api/dca-signal]', e)
    return NextResponse.json(fallback)
  }
}
