/**
 * Macro Snapshot — read pipeline output for Vercel-compatible data source.
 *
 * Why: Vercel serverless IPs often can't reach Yahoo Finance (blocked),
 * and FRED requires an API key that isn't configured in production.
 * The Python pipeline (run_daily.py) writes macro_snapshot.json with all
 * the needed raw values; Next.js APIs read from this as the primary source.
 */
import { readPipelineJson } from './readPipelineJson'
import type { FredRaw, YahooRaw } from './scoring'

export interface MacroSnapshot {
  date: string
  // Yahoo prices
  dxy: number | null
  gold: number | null
  spy: number | null
  qqq: number | null
  vix: number | null
  vvix: number | null
  vxn: number | null
  ovx: number | null
  gvz: number | null
  hyg: number | null
  eurusd: number | null
  usdjpy: number | null
  spy_ret: number | null
  qqq_ret: number | null
  // FRED fundamentals
  fedfunds: number | null
  dgs2: number | null
  dgs10: number | null
  tips10y: number | null
  bei10y: number | null
  bei5y: number | null
  fwd5y5y: number | null
  sofr: number | null
  iorb: number | null
  bbb_spread: number | null
  wage_growth: number | null
  debt_gdp: number | null
  residual: number | null
}

/** Safely pull a numeric value; if null/undefined return NaN so downstream
 *  isFinite() checks fall back to defaults. */
function num(v: number | null | undefined): number {
  return (v == null || !isFinite(v)) ? NaN : v
}

/** Load pipeline snapshot and convert to (fred, yahoo) structs compatible
 *  with scoring.ts's computeMultiAssetSignals / computeInflationDiagnosis. */
export async function loadMacroSnapshot(): Promise<{
  fred: FredRaw
  yahoo: YahooRaw
  date: string
} | null> {
  const snap = await readPipelineJson<MacroSnapshot | null>('macro_snapshot.json', null)
  if (!snap) return null

  const fred: FredRaw = {
    fedfunds:   num(snap.fedfunds),
    dgs2:       num(snap.dgs2),
    dgs10:      num(snap.dgs10),
    tips10y:    num(snap.tips10y),
    bei10y:     num(snap.bei10y),
    bei5y:      num(snap.bei5y),
    fwd5y5y:    num(snap.fwd5y5y),
    wageGrowth: num(snap.wage_growth),
    debtGdp:    num(snap.debt_gdp),
    sofr:       num(snap.sofr),
    iorb:       num(snap.iorb),
    bbbSpread:  num(snap.bbb_spread),
    // Fields below aren't in snapshot but scoring.ts expects them for other
    // consumers — inflation diagnosis / multi-asset signals don't use them.
    cpiEnergyYoY:  NaN,
    cpiShelterYoY: NaN,
    cpiCoreYoY:    NaN,
    stickyCpi:     NaN,
    medianCpi:     NaN,
    dxy_tw_series: [],
    dgs2_series:   [],
  }

  const yahoo: YahooRaw = {
    dxy:    num(snap.dxy),
    vix:    num(snap.vix),
    vvix:   num(snap.vvix),
    vxn:    num(snap.vxn),
    ovx:    num(snap.ovx),
    gvz:    num(snap.gvz),
    move:   NaN,
    eurusd: num(snap.eurusd),
    usdjpy: num(snap.usdjpy),
    usdcny: NaN,
    usdmxn: NaN,
    gold:   num(snap.gold),
    hyg:    num(snap.hyg),
    qqq:    num(snap.qqq),
    spy:    num(snap.spy),
    gvz_prev: NaN,
    vxhyg:   NaN,
    vxhyg_prev: NaN,
    gold_trend_30d: 0,
    qqq_ret: num(snap.qqq_ret),
    spy_ret: num(snap.spy_ret),
    ovx_52w_series: [],
    dxy_history: [],
    fx_trend: [],
  }

  return { fred, yahoo, date: snap.date }
}
