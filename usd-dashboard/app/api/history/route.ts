import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = await readPipelineJson('signal_history.json', mockData.signal_history)
  return NextResponse.json(data)
}
