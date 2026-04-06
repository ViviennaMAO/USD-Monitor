import { NextResponse } from 'next/server'
import { fredLatest, fredHistoryDated } from '@/lib/fredApi'
import type { SofrAnalysisData, SofrSpreadData } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// FRED Series for SOFR and percentiles
const SERIES = {
  SOFR:    'SOFR',
  SOFR_P1: 'SOFRP1',    // 1st percentile
  SOFR_P25: 'SOFRP25',  // 25th percentile
  SOFR_P75: 'SOFRP75',  // 75th percentile
  SOFR_P99: 'SOFRP99',  // 99th percentile
  IORB:    'IORB',
  EFFR:    'EFFR',
}

export async function GET() {
  try {
    // Fetch all series histories in parallel
    const [sofr, p1, p25, p75, p99, iorb, effr] = await Promise.all([
      fredHistoryDated(SERIES.SOFR, 120),
      fredHistoryDated(SERIES.SOFR_P1, 120),
      fredHistoryDated(SERIES.SOFR_P25, 120),
      fredHistoryDated(SERIES.SOFR_P75, 120),
      fredHistoryDated(SERIES.SOFR_P99, 120),
      fredHistoryDated(SERIES.IORB, 120),
      fredHistoryDated(SERIES.EFFR, 120),
    ])

    // Build date-indexed maps
    const maps = {
      sofr: new Map(sofr.map(d => [d.date, d.value])),
      p1:   new Map(p1.map(d => [d.date, d.value])),
      p25:  new Map(p25.map(d => [d.date, d.value])),
      p75:  new Map(p75.map(d => [d.date, d.value])),
      p99:  new Map(p99.map(d => [d.date, d.value])),
      iorb: new Map(iorb.map(d => [d.date, d.value])),
      effr: new Map(effr.map(d => [d.date, d.value])),
    }

    // Use SOFR dates as baseline
    const dates = sofr.map(d => d.date)
    const history: SofrSpreadData[] = dates.map(date => {
      const s = maps.sofr.get(date) ?? 0
      const _p1 = maps.p1.get(date) ?? s
      const _p25 = maps.p25.get(date) ?? s
      const _p75 = maps.p75.get(date) ?? s
      const _p99 = maps.p99.get(date) ?? s
      return {
        date,
        sofr: s,
        p1: _p1,
        p25: _p25,
        p75: _p75,
        p99: _p99,
        spread_1_99: +(_p99 - _p1).toFixed(3),
        iorb: maps.iorb.get(date) ?? 0,
        effr: maps.effr.get(date) ?? 0,
      }
    })

    const current = history[history.length - 1] ?? mockCurrent()

    // Assessment
    const spread = current.spread_1_99
    let assessment = ''
    if (spread > 0.10) {
      assessment = `SOFR 1st-99th价差为 ${(spread * 100).toFixed(0)}bp，显示回购市场定价分散度较高，资金面存在结构性压力。`
    } else if (spread > 0.05) {
      assessment = `SOFR 1st-99th价差为 ${(spread * 100).toFixed(0)}bp，回购市场运行正常，资金分布适度集中。`
    } else {
      assessment = `SOFR 1st-99th价差仅 ${(spread * 100).toFixed(0)}bp，回购市场高度平稳，流动性充裕。`
    }

    // SOFR vs IORB position
    const sofrIorb = current.sofr - current.iorb
    if (sofrIorb > 0.03) {
      assessment += ` SOFR高于IORB ${(sofrIorb * 100).toFixed(0)}bp，显示准备金体系外的融资需求旺盛。`
    } else if (sofrIorb < -0.02) {
      assessment += ` SOFR低于IORB ${Math.abs(sofrIorb * 100).toFixed(0)}bp，说明准备金充裕，资金向非银体系外溢。`
    }

    const result: SofrAnalysisData = { current, history, assessment }
    return NextResponse.json(result)
  } catch (e) {
    console.error('[sofr]', e)
    return NextResponse.json(mockSofr())
  }
}

function mockCurrent(): SofrSpreadData {
  return { date: '2026-04-03', sofr: 4.30, p1: 4.28, p25: 4.30, p75: 4.31, p99: 4.33, spread_1_99: 0.05, iorb: 4.40, effr: 4.33 }
}

function mockSofr(): SofrAnalysisData {
  const current = mockCurrent()
  return {
    current,
    history: Array.from({ length: 60 }, (_, i) => ({
      ...current,
      date: `2026-${String(Math.floor(i / 30) + 2).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      spread_1_99: 0.03 + Math.random() * 0.08,
    })),
    assessment: 'SOFR 1st-99th价差为5bp，回购市场运行正常。',
  }
}
