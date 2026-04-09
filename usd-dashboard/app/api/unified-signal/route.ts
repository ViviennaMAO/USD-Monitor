import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import type { UnifiedSignalData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fallback: UnifiedSignalData = {
  date: new Date().toISOString().slice(0, 10),
  dxy_price: 0,
  gamma_score: 50,
  gamma_signal: 'NEUTRAL',
  ml_prediction: 0,
  ml_signal: 'NEUTRAL',
  conflict_score: 0,
  conflict_level: 'low',
  regime_state: 'normal',
  regime_detail: { regime: 'unknown', multiplier: 1.0 },
  action: 'FLAT',
  size_mult: 0,
  stop_mult: 1.0,
  signal_source: 'no_data',
  diagnosis: { has_conflict: false, diagnosis: '数据未就绪' },
  matrix_position: { gamma_dir: 'neutral', ml_dir: 'neutral' },
}

export async function GET() {
  const data = await readPipelineJson<UnifiedSignalData>('unified_signal.json', fallback)
  return NextResponse.json(data)
}
