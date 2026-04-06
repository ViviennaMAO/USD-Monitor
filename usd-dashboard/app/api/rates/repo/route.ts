import { NextResponse } from 'next/server'
import { fredHistoryDated } from '@/lib/fredApi'
import type { RepoMarketData, RepoRateData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SERIES = {
  SOFR: 'SOFR',
  EFFR: 'EFFR',
  IORB: 'IORB',
  RRP:  'RRPONTSYAWARD',   // ON RRP award rate
  BGCR: 'BGCR',            // Broad General Collateral Rate
  TGCR: 'TGCR',            // Tri-Party General Collateral Rate
}

export async function GET() {
  try {
    const [sofr, effr, iorb, rrp, bgcr, tgcr] = await Promise.all(
      Object.values(SERIES).map(s => fredHistoryDated(s, 120))
    )

    // Build date-indexed maps
    const maps = {
      sofr: new Map(sofr.map(d => [d.date, d.value])),
      effr: new Map(effr.map(d => [d.date, d.value])),
      iorb: new Map(iorb.map(d => [d.date, d.value])),
      rrp:  new Map(rrp.map(d => [d.date, d.value])),
      bgcr: new Map(bgcr.map(d => [d.date, d.value])),
      tgcr: new Map(tgcr.map(d => [d.date, d.value])),
    }

    const dates = sofr.map(d => d.date)
    const history: RepoRateData[] = dates.map(date => ({
      date,
      sofr: maps.sofr.get(date) ?? 0,
      effr: maps.effr.get(date) ?? 0,
      iorb: maps.iorb.get(date) ?? 0,
      rrp:  maps.rrp.get(date) ?? 0,
      bgcr: maps.bgcr.get(date) ?? 0,
      tgcr: maps.tgcr.get(date) ?? 0,
    }))

    const current = history[history.length - 1]
    if (!current) throw new Error('No repo data')

    // Assessment
    const sofrEffr = current.sofr - current.effr
    const sofrIorb = current.sofr - current.iorb
    let assessment = `SOFR ${current.sofr.toFixed(2)}%, EFFR ${current.effr.toFixed(2)}%, IORB ${current.iorb.toFixed(2)}%。`

    if (sofrEffr > 0.05) {
      assessment += ` SOFR高于EFFR ${(sofrEffr * 100).toFixed(0)}bp，抵押品融资利率偏高，国债供给压力或季末效应显现。`
    } else if (sofrEffr < -0.03) {
      assessment += ` SOFR低于EFFR ${Math.abs(sofrEffr * 100).toFixed(0)}bp，国债抵押品价值高，回购市场宽松。`
    } else {
      assessment += ` SOFR与EFFR基本持平，回购市场与联邦基金市场一致。`
    }

    if (current.bgcr > 0 && current.tgcr > 0) {
      const bgcrTgcr = current.bgcr - current.tgcr
      if (Math.abs(bgcrTgcr) > 0.03) {
        assessment += ` BGCR-TGCR价差 ${(bgcrTgcr * 100).toFixed(0)}bp，三方与广义回购出现分化。`
      }
    }

    const result: RepoMarketData = { current, history, assessment }
    return NextResponse.json(result)
  } catch (e) {
    console.error('[repo]', e)
    return NextResponse.json(mockRepo())
  }
}

function mockRepo(): RepoMarketData {
  const current: RepoRateData = { date: '2026-04-03', sofr: 4.30, effr: 4.33, iorb: 4.40, rrp: 4.25, bgcr: 4.29, tgcr: 4.28 }
  return {
    current,
    history: Array.from({ length: 60 }, (_, i) => ({
      ...current,
      date: `2026-${String(Math.floor(i / 30) + 2).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    })),
    assessment: 'SOFR 4.30%, EFFR 4.33%, 回购市场运行平稳。',
  }
}
