import { NextResponse } from 'next/server'
import { computeEventWindow } from '@/lib/eventCalendar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const data = computeEventWindow()
  return NextResponse.json(data)
}
