import { NextResponse } from 'next/server'
import { getLiveData } from '@/lib/liveData'
import type { MultiAssetSignalData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fallback: MultiAssetSignalData = {
  date: new Date().toISOString().slice(0, 10),
  regime: 'neutral',
  regimeLabel: '中性过渡',
  regimeReason: '数据加载中...',
  inflationAnchor: 2.20,
  wageGrowth: null,
  assets: [
    { asset: 'USD',    label: '美元',  symbol: 'DXY',    direction: 'neutral', confidence: 2, timeWindow: '1-3月',  reason: '数据加载中' },
    { asset: 'Gold',   label: '黄金',  symbol: 'XAU',    direction: 'neutral', confidence: 2, timeWindow: '3-6月',  reason: '数据加载中' },
    { asset: 'Stocks', label: '美股',  symbol: 'SPX',    direction: 'neutral', confidence: 2, timeWindow: '1-3月',  reason: '数据加载中' },
    { asset: 'Bonds',  label: '美债',  symbol: 'UST10Y', direction: 'neutral', confidence: 2, timeWindow: '6-12月', reason: '数据加载中' },
  ],
}

export async function GET() {
  try {
    const { multiAssetSignals } = await getLiveData()
    return NextResponse.json(multiAssetSignals)
  } catch (e) {
    console.error('[/api/multi-asset-signals]', e)
    return NextResponse.json(fallback)
  }
}
