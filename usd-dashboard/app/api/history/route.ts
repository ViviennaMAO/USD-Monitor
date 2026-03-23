import { NextResponse } from 'next/server'
import { getLiveData, todayUtc, signalArrow } from '@/lib/liveData'
import { mockData } from '@/data/mockData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { gamma, yahoo } = await getLiveData()
    const today = todayUtc()

    // Use last 6 mock entries as seed history, then prepend today's live entry
    const seedHistory = mockData.signal_history.slice(-6)
    const lastEntry   = seedHistory.at(-1)

    const todayEntry = {
      date:   today,
      signal: gamma.signal,
      score:  gamma.gamma,
      change: signalArrow(gamma.signal, lastEntry?.signal),
      note:   `γ=${gamma.gamma.toFixed(0)}：r_f=${gamma.rf_score.toFixed(0)} / π=${gamma.pi_risk_score.toFixed(0)} / cy=${gamma.cy_score.toFixed(0)} / σ=${gamma.sigma_score.toFixed(0)}。` +
              ` DXY=${yahoo.dxy.toFixed(2)}, VIX=${yahoo.vix.toFixed(1)}`,
    }

    // Deduplicate: remove any mock entry with today's date, prepend live entry
    const history = [
      ...seedHistory.filter((e) => e.date !== today),
      todayEntry,
    ]

    return NextResponse.json(history)
  } catch (e) {
    console.error('[/api/history]', e)
    return NextResponse.json(mockData.signal_history)
  }
}
