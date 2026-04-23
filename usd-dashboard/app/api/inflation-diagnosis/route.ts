import { NextResponse } from 'next/server'
import { loadMacroSnapshot } from '@/lib/macroSnapshot'
import { computeInflationDiagnosis } from '@/lib/scoring'
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
    // Primary: pipeline macro_snapshot.json
    const snap = await loadMacroSnapshot()
    if (snap) {
      const diagnosis = computeInflationDiagnosis(snap.fred, snap.fred.wageGrowth)
      return NextResponse.json(diagnosis)
    }

    // Fallback: live-fetch
    const { getLiveData } = await import('@/lib/liveData')
    const { inflationDiagnosis } = await getLiveData()
    return NextResponse.json(inflationDiagnosis)
  } catch (e) {
    console.error('[/api/inflation-diagnosis]', e)
    return NextResponse.json(fallback)
  }
}
