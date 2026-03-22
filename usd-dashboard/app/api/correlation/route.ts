import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { mockCorrelation } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = await readPipelineJson('correlation.json', mockCorrelation)
  return NextResponse.json(data)
}
