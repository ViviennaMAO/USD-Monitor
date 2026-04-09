import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import type { ConflictBacktestData, SignalAttributionData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const btFallback: ConflictBacktestData = {
  date: '',
  test_period: { start: '', end: '', n_observations: 0 },
  bucket_analysis: [],
  consensus_attribution: [],
  threshold_grid: [],
  optimal_threshold: { threshold: 0.6, total_return: 0, sharpe: 0, max_drawdown: 0, conflict_pct: 0 },
  time_series: [],
  soros_hypothesis: {
    description: '',
    high_conflict_pct: 0,
    high_conflict_volatility: null,
    low_conflict_volatility: null,
  },
}

const attrFallback: SignalAttributionData = {
  date: '',
  strategies: [],
  optimal_threshold: 0.6,
}

export async function GET() {
  const [backtest, attribution] = await Promise.all([
    readPipelineJson<ConflictBacktestData>('conflict_backtest.json', btFallback),
    readPipelineJson<SignalAttributionData>('signal_attribution.json', attrFallback),
  ])
  return NextResponse.json({ backtest, attribution })
}
