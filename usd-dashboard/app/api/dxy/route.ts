import { NextResponse } from 'next/server'
import { readPipelineJson } from '@/lib/readPipelineJson'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = await readPipelineJson('dxy.json', mockData.dxy)
  return NextResponse.json(data)
}
