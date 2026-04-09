import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import type { CalibrationData, OrthogonalizationData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const calFallback: CalibrationData = {
  calibration_date: '',
  status: 'no_data',
  reason: 'pipeline not run',
  base_weights: { rf: 0.35, pi_risk: 0.25, cy: 0.25, sigma: 0.15 },
  calibrated_weights: { rf: 0.35, pi_risk: 0.25, cy: 0.25, sigma: 0.15 },
  shifts: { rf: 0, pi_risk: 0, cy: 0, sigma: 0 },
  component_ics: { rf: 0, pi_risk: 0, cy: 0, sigma: 0 },
  max_shift_constraint: 0.10,
  schedule: 'quarterly',
}

const orthoFallback: OrthogonalizationData = {
  date: '',
  ols_params: { alpha: 0, beta: 0, r_squared: 0, n_obs: 0 },
  orthogonalization: {
    ml_raw: 0, ml_raw_norm: 0, ml_ortho_norm: 0, ml_ortho_pct: 0,
    gamma_norm: 0, gamma_expected_ml: 0, beta: 0, alpha: 0,
    r_squared: 0, explained_by_gamma_pct: 0, independent_info_pct: 100,
  },
}

export async function GET() {
  const [calibration, orthogonalization] = await Promise.all([
    readPipelineJson<CalibrationData>('calibration.json', calFallback),
    readPipelineJson<OrthogonalizationData>('orthogonalization.json', orthoFallback),
  ])
  return NextResponse.json({ calibration, orthogonalization })
}
