/**
 * Yahoo Finance API wrapper.
 *
 * Yahoo Finance (as of 2024+) requires a crumb + session cookie for all API calls.
 * This module handles the two-step auth flow transparently:
 *   1. GET https://fc.yahoo.com  → extracts A3 cookie
 *   2. GET https://query2.finance.yahoo.com/v1/test/getcrumb  → crumb token
 *
 * Both are cached in module memory for 60 minutes.
 */

const YF_BASE_CHART = 'https://query2.finance.yahoo.com/v8/finance/chart'
const YF_BASE_QUOTE = 'https://query2.finance.yahoo.com/v7/finance/quote'

const YF_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// ─── Crumb / cookie cache ─────────────────────────────────────────────────────

interface YFAuth {
  crumb: string
  cookie: string
  ts: number
}

let _auth: YFAuth | null = null
const AUTH_TTL = 60 * 60 * 1000 // 60 minutes

async function getAuth(): Promise<YFAuth | null> {
  if (_auth && Date.now() - _auth.ts < AUTH_TTL) return _auth

  try {
    // Step 1: hit Yahoo Finance to get a session cookie
    const init = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': YF_UA },
      redirect: 'follow',
    })
    const rawCookie = init.headers.get('set-cookie') ?? ''
    // Extract the A3 cookie value
    const cookieMatch = rawCookie.match(/A3=[^;]+/)
    const cookie = cookieMatch ? cookieMatch[0] : ''

    // Step 2: get crumb using the session cookie
    const crumbRes = await fetch(
      'https://query2.finance.yahoo.com/v1/test/getcrumb',
      {
        headers: {
          'User-Agent': YF_UA,
          Cookie: cookie,
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    )
    if (!crumbRes.ok) throw new Error(`crumb HTTP ${crumbRes.status}`)
    const crumb = (await crumbRes.text()).trim()

    _auth = { crumb, cookie, ts: Date.now() }
    return _auth
  } catch (e) {
    console.error('[Yahoo] auth error:', e)
    return null
  }
}

function authHeaders(auth: YFAuth | null): HeadersInit {
  if (!auth) {
    return {
      'User-Agent': YF_UA,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  }
  return {
    'User-Agent': YF_UA,
    Cookie: auth.cookie,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
}

// legacy alias kept for internal helpers
const YF_HEADERS = { 'User-Agent': YF_UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YFMeta {
  regularMarketPrice: number
  previousClose: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  regularMarketChangePercent: number
  regularMarketChange: number
  currency: string
  symbol: string
}

export interface YFChartResult {
  meta: YFMeta
  timestamp?: number[]
  indicators?: {
    quote: Array<{ close?: (number | null)[] }>
  }
}

interface YFChartResponse {
  chart: {
    result?: YFChartResult[]
    error?: unknown
  }
}

// ─── Core fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetch a Yahoo Finance chart for a symbol.
 * @param symbol  Yahoo Finance ticker (e.g. "DX-Y.NYB", "^VIX", "EURUSD=X")
 * @param range   e.g. "5d", "1mo", "60d", "1y"
 */
export async function yfChart(
  symbol: string,
  range = '5d'
): Promise<YFChartResult | null> {
  const auth = await getAuth()
  const crumb = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
  const url =
    `${YF_BASE_CHART}/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=${range}&includePrePost=false&events=none${crumb}`
  try {
    const res = await fetch(url, { headers: authHeaders(auth) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as YFChartResponse
    return data.chart?.result?.[0] ?? null
  } catch (e) {
    console.error(`[Yahoo] ${symbol}:`, e)
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function yfPrice(r: YFChartResult | null): number {
  return r?.meta?.regularMarketPrice ?? NaN
}

export function yfPrevClose(r: YFChartResult | null): number {
  return r?.meta?.previousClose ?? NaN
}

export function yfChangePct(r: YFChartResult | null): number {
  return r?.meta?.regularMarketChangePercent ?? NaN
}

export function yfChange(r: YFChartResult | null): number {
  return r?.meta?.regularMarketChange ?? NaN
}

export function yf52wHigh(r: YFChartResult | null): number {
  return r?.meta?.fiftyTwoWeekHigh ?? NaN
}

export function yf52wLow(r: YFChartResult | null): number {
  return r?.meta?.fiftyTwoWeekLow ?? NaN
}

/**
 * Extract daily close history from a chart result fetched with range >= "1mo".
 * Returns [{date, price}, ...] sorted oldest-first, NaN entries omitted.
 */
export function yfHistory(
  r: YFChartResult | null
): { date: string; price: number }[] {
  if (!r?.timestamp || !r.indicators?.quote?.[0]?.close) return []
  const closes = r.indicators.quote[0].close
  return r.timestamp
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      price: closes[i] ?? NaN,
    }))
    .filter((h) => !isNaN(h.price) && isFinite(h.price))
}

/**
 * Extract close prices as a plain number[] (oldest-first).
 */
export function yfCloseSeries(r: YFChartResult | null): number[] {
  return yfHistory(r).map((h) => h.price)
}

/**
 * Fetch multiple symbols via the Yahoo Finance v7 quote endpoint (single HTTP request).
 * Returns a map { symbol → partial YFChartResult } with current price data.
 * Preferred over yfBatch for spot prices to avoid rate limiting.
 */
export interface YFQuote {
  symbol: string
  regularMarketPrice: number
  regularMarketPreviousClose: number
  regularMarketChangePercent: number
  regularMarketChange: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

export async function yfQuoteBatch(
  symbols: string[]
): Promise<Record<string, YFQuote | null>> {
  const auth = await getAuth()
  const crumb = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
  const encoded = symbols.map(encodeURIComponent).join(',')
  const url =
    `${YF_BASE_QUOTE}?symbols=${encoded}` +
    `&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,regularMarketChange,fiftyTwoWeekHigh,fiftyTwoWeekLow` +
    crumb
  try {
    const res = await fetch(url, { headers: authHeaders(auth) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as {
      quoteResponse: { result: YFQuote[]; error: unknown }
    }
    return Object.fromEntries(
      (data.quoteResponse?.result ?? []).map((q) => [q.symbol, q])
    )
  } catch (e) {
    console.error('[Yahoo] quote batch:', e)
    return {}
  }
}

/** Extract price from a YFQuote (from yfQuoteBatch). */
export function yfQuotePrice(q: YFQuote | null | undefined): number {
  return q?.regularMarketPrice ?? NaN
}

export function yfQuotePrevClose(q: YFQuote | null | undefined): number {
  return q?.regularMarketPreviousClose ?? NaN
}

export function yfQuoteChangePct(q: YFQuote | null | undefined): number {
  return q?.regularMarketChangePercent ?? NaN
}

/**
 * Sequential history fetcher — waits `delayMs` between each request
 * to avoid Yahoo Finance 429 rate limiting.
 */
export async function yfHistorySeq(
  jobs: Array<{ symbol: string; range: string }>,
  delayMs = 300
): Promise<Record<string, YFChartResult | null>> {
  const results: Record<string, YFChartResult | null> = {}
  for (const { symbol, range } of jobs) {
    results[symbol] = await yfChart(symbol, range)
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }
  return results
}
