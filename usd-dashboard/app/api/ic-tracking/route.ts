import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { mockIcTracking } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const factor = searchParams.get('factor') ?? 'F5'
  const fallback = mockIcTracking[factor] ?? mockIcTracking['F5']
  const data = await readPipelineJson(`ic_tracking_${factor}.json`, fallback)
  return NextResponse.json(data)
}
