/**
 * FRED (Federal Reserve Economic Data) REST API wrapper.
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 */

const FRED_BASE = 'https://api.stlouisfed.org/fred'

function apiKey(): string {
  return process.env.FRED_API_KEY ?? ''
}

interface FredObservation {
  date: string
  value: string
}

interface FredResponse {
  observations: FredObservation[]
}

/**
 * Fetch the most-recent non-missing value for a FRED series.
 * Returns NaN on any failure so callers can detect and fall back.
 */
export async function fredLatest(seriesId: string): Promise<number> {
  const key = apiKey()
  if (!key) {
    console.warn('[FRED] FRED_API_KEY not set')
    return NaN
  }
  const url =
    `${FRED_BASE}/series/observations` +
    `?series_id=${seriesId}` +
    `&api_key=${key}` +
    `&sort_order=desc` +
    `&limit=5` +
    `&file_type=json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as FredResponse
    const valid = data.observations.filter(
      (o) => o.value !== '.' && o.value.trim() !== ''
    )
    return valid.length > 0 ? parseFloat(valid[0].value) : NaN
  } catch (e) {
    console.error(`[FRED] ${seriesId}:`, e)
    return NaN
  }
}

/**
 * Fetch a historical series from FRED.
 * Returns values sorted oldest-first, NaN entries excluded.
 * @param limit  Maximum number of observations to fetch (sorted desc, then reversed)
 */
export async function fredHistory(
  seriesId: string,
  limit = 300
): Promise<number[]> {
  const key = apiKey()
  if (!key) return []
  const url =
    `${FRED_BASE}/series/observations` +
    `?series_id=${seriesId}` +
    `&api_key=${key}` +
    `&sort_order=desc` +
    `&limit=${limit}` +
    `&file_type=json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as FredResponse
    return data.observations
      .filter((o) => o.value !== '.' && o.value.trim() !== '')
      .map((o) => parseFloat(o.value))
      .reverse()
  } catch (e) {
    console.error(`[FRED] ${seriesId} history:`, e)
    return []
  }
}

/**
 * Fetch historical series with dates from FRED.
 * Returns { date, value }[] sorted oldest-first.
 */
export async function fredHistoryDated(
  seriesId: string,
  limit = 300
): Promise<{ date: string; value: number }[]> {
  const key = apiKey()
  if (!key) return []
  const url =
    `${FRED_BASE}/series/observations` +
    `?series_id=${seriesId}` +
    `&api_key=${key}` +
    `&sort_order=desc` +
    `&limit=${limit}` +
    `&file_type=json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as FredResponse
    return data.observations
      .filter((o) => o.value !== '.' && o.value.trim() !== '')
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse()
  } catch (e) {
    console.error(`[FRED] ${seriesId} historyDated:`, e)
    return []
  }
}

/** Fetch multiple FRED series in parallel. Returns a map { seriesId → value }. */
export async function fredBatch(
  seriesIds: string[]
): Promise<Record<string, number>> {
  const results = await Promise.all(
    seriesIds.map(async (id) => [id, await fredLatest(id)] as [string, number])
  )
  return Object.fromEntries(results)
}
