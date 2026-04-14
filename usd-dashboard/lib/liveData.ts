/**
 * Live market data orchestrator.
 *
 * Fetches from FRED + Yahoo Finance, computes DXY residual and all scores,
 * returns a unified snapshot used by every API route.
 *
 * Includes a module-level 5-minute in-memory cache so parallel API route
 * calls within the same Vercel function instance don't hammer external APIs.
 */

import { fredBatch, fredHistory } from './fredApi'
import {
  yfChart,
  yfQuoteBatch, yfQuotePrice, yfQuotePrevClose,
  yfHistory, yfCloseSeries, yfHistorySeq,
} from './yahooApi'
import {
  computeDxyResidual,
  scoreRf, scorePiRisk, scoreCy, scoreSigmaAlert, computeGamma, computeDcaSignal,
  type FredRaw, type YahooRaw, type CbRates, type Residual,
} from './scoring'

// ─── Central bank rates (from env or hardcoded defaults) ──────────────────────

function cbRates(): CbRates {
  return {
    ecb:   parseFloat(process.env.ECB_RATE   ?? '3.00'),
    boj:   parseFloat(process.env.BOJ_RATE   ?? '0.25'),
    boe:   parseFloat(process.env.BOE_RATE   ?? '4.25'),
    estr:  parseFloat(process.env.ESTR_RATE  ?? '2.90'),
    sonia: parseFloat(process.env.SONIA_RATE ?? '4.19'),
  }
}

// ─── Cache (module-level, 5-minute TTL) ───────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface LiveSnapshot {
  fred: FredRaw
  yahoo: YahooRaw
  cb: CbRates
  residual: Residual
  fetchedAt: string
}

let _cache: { snapshot: LiveSnapshot; ts: number } | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** HYG implied-vol proxy: use 21-day realised vol × √252 × 100 (→ %). */
function computeHygIv(closeSeries: number[]): number {
  if (closeSeries.length < 22) return 12
  const window = closeSeries.slice(-22)
  const logRets = window
    .slice(1)
    .map((p, i) => Math.log(p / window[i]))
    .filter(isFinite)
  if (logRets.length < 2) return 12
  const mean = logRets.reduce((a, b) => a + b, 0) / logRets.length
  const variance = logRets.reduce((a, b) => a + (b - mean) ** 2, 0) / logRets.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

/** Gold 30-day return (%). */
function goldTrend30d(closeSeries: number[]): number {
  if (closeSeries.length < 31) return 0
  const old = closeSeries[closeSeries.length - 31]
  const now = closeSeries[closeSeries.length - 1]
  return parseFloat(((now - old) / old * 100).toFixed(2))
}

/** 1-day return (%) from last 2 closes. */
function ret1d(closeSeries: number[]): number {
  if (closeSeries.length < 2) return 0
  const prev = closeSeries[closeSeries.length - 2]
  const last = closeSeries[closeSeries.length - 1]
  return parseFloat(((last - prev) / prev * 100).toFixed(4))
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchLiveSnapshot(): Promise<LiveSnapshot> {
  const cb = cbRates()

  // ── FRED: fetch current values + history series for residual ──────────────
  const [fredValues, dxyTwHistory, dgs2History] = await Promise.all([
    fredBatch([
      'FEDFUNDS', 'DGS2', 'DGS10',
      'DFII10',   // 10Y TIPS real rate
      'T10YIE',   // 10Y breakeven inflation
      'T5YIE',    // 5Y breakeven inflation
      'SOFR',
      'IORB',
      'BAMLC0A4CBBB', // BBB spread (CDS proxy)
    ]),
    fredHistory('DTWEXBGS', 300),  // Trade-weighted DXY
    fredHistory('DGS2', 300),       // 2Y Treasury series
  ])

  const fred: FredRaw = {
    fedfunds:   fredValues['FEDFUNDS'],
    dgs2:       fredValues['DGS2'],
    dgs10:      fredValues['DGS10'],
    tips10y:    fredValues['DFII10'],
    bei10y:     fredValues['T10YIE'],
    bei5y:      fredValues['T5YIE'],
    sofr:       fredValues['SOFR'],
    iorb:       fredValues['IORB'],
    bbbSpread:  fredValues['BAMLC0A4CBBB'],
    dxy_tw_series: dxyTwHistory,
    dgs2_series:   dgs2History,
  }

  // ── Yahoo: spot prices via single v7 batch request ────────────────────────
  const spotSymbols = [
    'DX-Y.NYB', '^VIX', '^VVIX', '^VXN', '^OVX', '^GVZ', '^MOVE',
    'EURUSD=X', 'JPY=X', 'CNY=X', 'MXN=X', 'GC=F', 'QQQ', 'SPY', 'HYG',
  ]
  // ── Yahoo: histories via sequential requests (avoids 429) ─────────────────
  const [quotes, histCharts] = await Promise.all([
    yfQuoteBatch(spotSymbols),
    yfHistorySeq([
      { symbol: 'DX-Y.NYB', range: '60d' },
      { symbol: 'GC=F',     range: '60d' },
      { symbol: '^OVX',     range: '1y'  },
      { symbol: 'EURUSD=X', range: '14d' },
      { symbol: 'JPY=X',    range: '14d' },
      { symbol: 'HYG',      range: '60d' },
    ], 250),
  ])

  const hygSeries    = yfCloseSeries(histCharts['HYG'])
  const goldSeries   = yfCloseSeries(histCharts['GC=F'])
  const ovx52wSeries = yfCloseSeries(histCharts['^OVX'])
  const dxyHistArr   = yfHistory(histCharts['DX-Y.NYB'])
  const eurHistArr   = yfHistory(histCharts['EURUSD=X'])
  const jpyHistArr   = yfHistory(histCharts['JPY=X'])
  const dxyShortArr  = dxyHistArr.slice(-7)

  // VXHYG proxy from HYG realised vol
  const vxhyg = computeHygIv(hygSeries)
  const vxhygPrev = hygSeries.length >= 2
    ? computeHygIv(hygSeries.slice(0, -1))
    : vxhyg * 1.05

  // QQQ / SPY 1-day returns from batch quotes
  const qqqPrice    = yfQuotePrice(quotes['QQQ'])
  const qqqPrev     = yfQuotePrevClose(quotes['QQQ'])
  const spyPrice    = yfQuotePrice(quotes['SPY'])
  const spyPrev     = yfQuotePrevClose(quotes['SPY'])
  const qqqRet = (isFinite(qqqPrice) && isFinite(qqqPrev) && qqqPrev > 0)
    ? parseFloat(((qqqPrice - qqqPrev) / qqqPrev * 100).toFixed(4)) : 0
  const spyRet = (isFinite(spyPrice) && isFinite(spyPrev) && spyPrev > 0)
    ? parseFloat(((spyPrice - spyPrev) / spyPrev * 100).toFixed(4)) : 0

  // FX 7-day trend (align by index)
  const fxLen = Math.min(eurHistArr.length, jpyHistArr.length, dxyShortArr.length, 7)
  const fxTrend = Array.from({ length: fxLen }, (_, i) => ({
    date:   dxyShortArr[dxyShortArr.length - fxLen + i]?.date ?? '',
    eurusd: eurHistArr[eurHistArr.length - fxLen + i]?.price ?? NaN,
    usdjpy: jpyHistArr[jpyHistArr.length - fxLen + i]?.price ?? NaN,
    dxy:    dxyShortArr[dxyShortArr.length - fxLen + i]?.price ?? NaN,
  }))

  const yahoo: YahooRaw = {
    dxy:    yfQuotePrice(quotes['DX-Y.NYB']),
    vix:    yfQuotePrice(quotes['^VIX']),
    vvix:   yfQuotePrice(quotes['^VVIX']),
    vxn:    yfQuotePrice(quotes['^VXN']),
    ovx:    yfQuotePrice(quotes['^OVX']),
    gvz:    yfQuotePrice(quotes['^GVZ']),
    move:   yfQuotePrice(quotes['^MOVE']),
    eurusd: yfQuotePrice(quotes['EURUSD=X']),
    usdjpy: yfQuotePrice(quotes['JPY=X']),
    usdcny: yfQuotePrice(quotes['CNY=X']),
    usdmxn: yfQuotePrice(quotes['MXN=X']),
    gold:   yfQuotePrice(quotes['GC=F']),
    hyg:    yfQuotePrice(quotes['HYG']),
    qqq:    qqqPrice,
    spy:    spyPrice,
    gvz_prev:    yfQuotePrevClose(quotes['^GVZ']),
    vxhyg,
    vxhyg_prev: vxhygPrev,
    gold_trend_30d: goldTrend30d(goldSeries),
    qqq_ret: qqqRet,
    spy_ret: spyRet,
    ovx_52w_series: ovx52wSeries,
    dxy_history: dxyHistArr.slice(-30),
    fx_trend:    fxTrend,
  }

  const residual = computeDxyResidual(fred, yahoo, cb)

  return {
    fred,
    yahoo,
    cb,
    residual,
    fetchedAt: new Date().toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns a cached live snapshot (refreshes every 5 minutes). */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.snapshot
  }
  const snapshot = await fetchLiveSnapshot()
  _cache = { snapshot, ts: Date.now() }
  return snapshot
}

/** Fully computed dashboard data — scores + raw market data. */
export async function getLiveData() {
  const snap = await getLiveSnapshot()
  const pipelineData = {
    fred:                snap.fred,
    yahoo:               snap.yahoo,
    central_bank_rates:  snap.cb,
    residual:            snap.residual,
  }

  const rf    = scoreRf(pipelineData)
  const pi    = scorePiRisk(pipelineData)
  const cy    = scoreCy(pipelineData)
  const sigma = scoreSigmaAlert(pipelineData)
  const gamma = computeGamma(rf.score, pi.score, cy.score, sigma, sigma.rr_zscore)
  const dcaSignal = computeDcaSignal(gamma, sigma)

  return {
    ...snap,
    rf,
    pi,
    cy,
    sigma,
    gamma,
    dcaSignal,
  }
}

/** Helper: today's date string "YYYY-MM-DD" in UTC. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Signal label → numeric order for direction arrows. */
const SIG_ORDER: Record<string, number> = { BULLISH: 2, NEUTRAL: 1, BEARISH: 0 }
export function signalArrow(
  curr: string,
  prev: string | undefined
): '↑' | '↓' | '↔' {
  if (!prev) return '↔'
  const a = SIG_ORDER[curr] ?? 1
  const b = SIG_ORDER[prev] ?? 1
  return a > b ? '↑' : a < b ? '↓' : '↔'
}
