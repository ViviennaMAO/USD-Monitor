/**
 * TypeScript port of pipeline/scoring.py + pipeline/vol_alert.py
 *
 * Scoring engine for:
 *   r_f      — Rate Differential Support (0-100)
 *   π_risk   — Risk Premium (0-100)
 *   cy       — Convenience Yield drag (0-100)
 *   σ_alert  — Volatility Alert 12-factor (0-100)
 *   γ        — Composite USD score (0-100)
 */

import type { RfData, PiRiskData, CyData, VolAlertData } from '@/types'

// ─── Math helpers ─────────────────────────────────────────────────────────────

/** Linear normalise val into [0, 1] between lo and hi, clamped. */
function norm(val: number, lo: number, hi: number): number {
  if (hi === lo) return 0.5
  return Math.max(0, Math.min(1, (val - lo) / (hi - lo)))
}

/** Rolling z-score of val against the last `window` values of series. */
function zscore(val: number, series: number[], window = 252): number {
  const arr = series.slice(-window).filter((v) => isFinite(v))
  if (arr.length < 5) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
  const std = Math.sqrt(variance) + 1e-9
  return (val - mean) / std
}

/** Percentile rank of val within series (0-100). */
function pct(val: number, series: number[]): number {
  const arr = series.filter((v) => isFinite(v))
  if (arr.length === 0) return 50
  return (arr.filter((v) => v <= val).length / arr.length) * 100
}

/** Ordinary least-squares slope + intercept. */
function ols(
  xs: number[],
  ys: number[]
): { slope: number; intercept: number } {
  const n = xs.length
  if (n < 2) return { slope: 1, intercept: 0 }
  const sx = xs.reduce((a, b) => a + b, 0)
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sxx = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 1, intercept: 0 }
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function r(v: number, digits = 1): number {
  return Math.round(v * 10 ** digits) / 10 ** digits
}

// ─── Input data shape (mirrors Python pipeline's `data` dict) ─────────────────

export interface FredRaw {
  fedfunds: number
  dgs2: number
  dgs10: number
  tips10y: number   // DFII10
  bei10y: number    // T10YIE  (10Y BEI — for yield decomp)
  bei5y: number     // T5YIE   (5Y BEI — display only)
  fwd5y5y: number   // T5YIFR  (5Y-5Y Forward — Fed's preferred inflation anchor)
  sofr: number
  iorb: number
  bbbSpread: number // BAMLC0A4CBBB
  // history series for residual computation
  dxy_tw_series?: number[]
  dgs2_series?: number[]
}

export interface YahooRaw {
  dxy: number
  vix: number
  vvix: number
  vxn: number
  ovx: number
  gvz: number
  move: number
  eurusd: number
  usdjpy: number
  usdcny: number
  usdmxn: number
  gold: number
  hyg: number
  qqq: number
  spy: number
  // Previous-day values
  gvz_prev: number
  vxhyg: number        // HYG implied vol proxy
  vxhyg_prev: number
  // Derived
  gold_trend_30d: number
  qqq_ret: number
  spy_ret: number
  ovx_52w_series: number[]
  dxy_history: { date: string; price: number }[]
  fx_trend: { date: string; eurusd: number; usdjpy: number; dxy: number }[]
}

export interface CbRates {
  ecb: number
  boj: number
  boe: number
  estr: number
  sonia: number
}

export interface Residual {
  residual: number
  dxy_implied: number
  alpha: number
  beta: number
}

export interface PipelineData {
  fred: FredRaw
  yahoo: YahooRaw
  central_bank_rates: CbRates
  residual: Residual
}

// ─── DXY Residual ─────────────────────────────────────────────────────────────

export function computeDxyResidual(
  fred: FredRaw,
  yahoo: YahooRaw,
  cb: CbRates
): Residual {
  try {
    const dxySeries = fred.dxy_tw_series ?? []
    const dgs2Series = fred.dgs2_series ?? []
    const n = Math.min(dxySeries.length, dgs2Series.length, 252)

    if (n >= 30) {
      const y = dxySeries.slice(-n)
      const x = dgs2Series.slice(-n)
      const { slope, intercept } = ols(x, y)
      const dxyActual = yahoo.dxy ?? 103.0
      const spread2w =
        (fred.fedfunds - cb.ecb) * 0.57 +
        (fred.fedfunds - cb.boj) * 0.14
      const dxyImplied = intercept + slope * spread2w
      const residual = dxyActual - dxyImplied
      return {
        residual: r(residual, 3),
        dxy_implied: r(dxyImplied, 3),
        alpha: r(intercept, 4),
        beta: r(slope, 4),
      }
    }
  } catch (e) {
    console.error('[scoring] residual error:', e)
  }
  const dxyActual = yahoo.dxy ?? 103.0
  return { residual: 0, dxy_implied: r(dxyActual, 3), alpha: 0, beta: 1 }
}

// ─── r_f ─────────────────────────────────────────────────────────────────────

export function scoreRf(data: PipelineData): RfData {
  const { fred, central_bank_rates: cb } = data
  const fed = isFinite(fred.fedfunds) ? fred.fedfunds : 4.5
  const dgs2 = isFinite(fred.dgs2) ? fred.dgs2 : 4.62
  const tips = isFinite(fred.tips10y) ? fred.tips10y : 1.85

  const spreadEur = fed - cb.ecb
  const spreadJpy = fed - cb.boj
  const spreadGbp = fed - cb.boe

  const spreadScore = (s: number) => norm(s, -2, 4) * 100
  const sfEur = spreadScore(spreadEur)
  const sfJpy = spreadScore(spreadJpy)
  const sfGbp = spreadScore(spreadGbp)
  const sfTips = norm(tips, -1, 3) * 100
  const path = dgs2 - fed
  const sfPath = norm(path, -2, 1) * 100

  const score = r(
    clamp(
      0.5 * (0.57 * sfEur + 0.14 * sfJpy + 0.12 * sfGbp) / 0.83 +
        0.3 * sfTips +
        0.2 * sfPath
    )
  )

  const signal = score >= 65 ? 'USD 看多' : score < 35 ? 'USD 看空' : '混合信号'
  const fmt = (v: number) => (v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`)

  return {
    score,
    signal,
    sub_factors: [
      { label: 'Fed vs ECB 利差',     weight_label: '57%', value: fmt(spreadEur), score: r(sfEur),  direction: spreadEur > 0 ? 'positive' : 'negative' },
      { label: 'Fed vs BOJ 利差',     weight_label: '14%', value: fmt(spreadJpy), score: r(sfJpy),  direction: spreadJpy > 0 ? 'positive' : 'negative' },
      { label: 'Fed vs BOE 利差',     weight_label: '12%', value: fmt(spreadGbp), score: r(sfGbp),  direction: spreadGbp > 0 ? 'positive' : 'negative' },
      { label: '实际利率 (10Y-BEI)', weight_label: '10%', value: `${tips.toFixed(2)}%`, score: r(sfTips), direction: tips > 0.5 ? 'positive' : 'neutral' },
      { label: '利率路径 (2Y vs Fed)', weight_label: '7%',  value: path > 0 ? '鹰派' : '鸽派',    score: r(sfPath), direction: path > 0 ? 'positive' : 'negative' },
    ],
    data_rows: [
      { label: 'Fed Funds',   value: `${fed.toFixed(2)}%` },
      { label: 'ECB Main',    value: `${cb.ecb.toFixed(2)}%` },
      { label: 'BOJ Call',    value: `${cb.boj.toFixed(2)}%` },
      { label: 'BOE Bank',    value: `${cb.boe.toFixed(2)}%` },
      { label: '€STR',        value: `${cb.estr.toFixed(2)}%` },
      { label: 'SONIA',       value: `${cb.sonia.toFixed(2)}%` },
      { label: '2Y Treasury', value: `${dgs2.toFixed(2)}%` },
    ],
  }
}

// ─── π_risk ──────────────────────────────────────────────────────────────────

export function scorePiRisk(data: PipelineData): PiRiskData {
  const { fred, yahoo } = data
  const vix  = isFinite(yahoo.vix)  ? yahoo.vix  : 20
  const move = isFinite(yahoo.move) ? yahoo.move : 100
  const dgs10 = isFinite(fred.dgs10) ? fred.dgs10 : 4.28
  const dgs2  = isFinite(fred.dgs2)  ? fred.dgs2  : 4.62

  const tpApprox = (dgs10 - dgs2) * 100  // bps (yield curve slope proxy)
  const riskType = vix > 20 && tpApprox > 30 ? 'us_specific' : 'global_risk'

  const vixScore  = norm(vix,  12, 40) * 100
  const moveScore = norm(move, 50, 200) * 100

  let tpEffect: number
  let score: number
  if (riskType === 'global_risk') {
    tpEffect = (1 - norm(Math.max(0, tpApprox), 0, 300)) * 100
    score = 0.6 * vixScore + 0.25 * (100 - tpEffect) + 0.15 * moveScore
  } else {
    tpEffect = norm(Math.max(0, tpApprox), 0, 300) * 100
    score = 0.6 * (100 - vixScore) + 0.25 * (100 - tpEffect) + 0.15 * moveScore
  }
  score = r(clamp(score))

  const signal =
    riskType === 'global_risk'
      ? '全球避险 · USD看多'
      : vix > 25
      ? '美国风险 · USD看空'
      : '混合信号'

  const tpPct = Math.round(norm(Math.max(0, tpApprox), -100, 300) * 100)
  const note =
    `VIX ${vix.toFixed(1)} + TP ${tpApprox >= 0 ? '+' : ''}${tpApprox.toFixed(0)}bps → ` +
    (riskType === 'global_risk' ? '全球避险(Flight to Safety)' : '财政恐惧(Fiscal Fear)') +
    `。当前风险分类：` +
    (riskType === 'global_risk' ? '✅ 全球风险 → USD看多' : '⚠️ 美国特有风险 → USD看空') + '。'

  return {
    score,
    signal,
    risk_type: riskType as 'global_risk' | 'us_specific',
    sub_factors: [
      { label: '期限溢价 (10Y-2Y slope)', weight_label: '40%', value: `${tpApprox >= 0 ? '+' : ''}${tpApprox.toFixed(0)}bps`, score: r(tpEffect), direction: 'neutral' },
      { label: 'VIX',  weight_label: '35%', value: vix.toFixed(1),  score: r(vixScore),  direction: 'neutral' },
      { label: 'MOVE', weight_label: '25%', value: move.toFixed(0), score: r(moveScore), direction: 'neutral' },
    ],
    data_rows: [
      { label: '10Y TP (slope approx)', value: `${tpApprox >= 0 ? '+' : ''}${tpApprox.toFixed(0)}bps` },
      { label: '10Y Treasury',          value: `${dgs10.toFixed(2)}%` },
      { label: '2Y Treasury',           value: `${dgs2.toFixed(2)}%` },
      { label: 'VIX',                   value: vix.toFixed(1) },
      { label: 'MOVE',                  value: move.toFixed(0) },
      { label: 'TP 分位数',             value: `${tpPct}%ile` },
    ],
    note,
  }
}

// ─── cy ──────────────────────────────────────────────────────────────────────

export function scoreCy(data: PipelineData): CyData {
  const { fred, yahoo, residual } = data
  const gold       = isFinite(yahoo.gold) ? yahoo.gold : 3000
  const goldTrend  = isFinite(yahoo.gold_trend_30d) ? yahoo.gold_trend_30d : 0
  const sofr       = isFinite(fred.sofr) ? fred.sofr : 5.31
  const iorb       = isFinite(fred.iorb) ? fred.iorb : 5.33
  const sofrIorbBp = (sofr - iorb) * 100
  const dxyResid   = isFinite(residual.residual) ? residual.residual : 0
  const dxyImpl    = isFinite(residual.dxy_implied) ? residual.dxy_implied : 103

  const goldDrag  = norm(goldTrend,  -10, 20) * 100
  const fundingH  = norm(sofrIorbBp, -10, 10) * 100
  const resScore  = norm(dxyResid,    -5,  5) * 100

  const score = r(clamp(0.5 * goldDrag + 0.25 * (100 - fundingH) + 0.25 * (100 - resScore)))
  const signal = score >= 55 ? 'USD 轻度拖累' : score >= 40 ? 'USD 中性' : 'cy 支撑美元'
  const dirGold = goldTrend > 2 ? 'negative' : goldTrend < -2 ? 'positive' : 'neutral'

  const note =
    `黄金${goldTrend > 3 ? '强势上行' : goldTrend > 0 ? '温和上涨' : '回落'}` +
    `(${goldTrend >= 0 ? '+' : ''}${goldTrend.toFixed(1)}% 30日)` +
    `${goldTrend > 3 ? '反映去美元化资金流，对DXY形成结构性拖累。' : '，cy影响温和。'}` +
    ` SOFR-IORB ${sofrIorbBp >= 0 ? '+' : ''}${sofrIorbBp.toFixed(0)}bps，` +
    `资金市场${sofrIorbBp < -5 ? '轻微压力' : '基本健康'}。` +
    ` DXY残差${dxyResid > 0.5 ? '+偏贵' : dxyResid < -0.5 ? '-偏便宜' : '中性'}` +
    `(${dxyResid >= 0 ? '+' : ''}${dxyResid.toFixed(2)}pts)。`

  return {
    score,
    signal,
    sub_factors: [
      { label: '黄金走势 (30d)',  weight_label: '50%', value: `${goldTrend >= 0 ? '+' : ''}${goldTrend.toFixed(1)}%`,  score: r(goldDrag),          direction: dirGold as 'positive' | 'negative' | 'neutral' },
      { label: 'SOFR-IORB 利差', weight_label: '25%', value: `${sofrIorbBp >= 0 ? '+' : ''}${sofrIorbBp.toFixed(0)}bps`, score: r(100 - fundingH), direction: 'neutral' },
      { label: 'DXY 残差溢价',   weight_label: '25%', value: `${dxyResid >= 0 ? '+' : ''}${dxyResid.toFixed(2)}pts`,  score: r(100 - resScore),    direction: dxyResid > 0.5 ? 'negative' : 'neutral' },
    ],
    data_rows: [
      { label: '黄金价格',       value: `$${gold.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      { label: '黄金 30d 趋势',  value: `${goldTrend >= 0 ? '+' : ''}${goldTrend.toFixed(1)}%` },
      { label: 'SOFR',           value: `${sofr.toFixed(2)}%` },
      { label: 'IORB',           value: `${iorb.toFixed(2)}%` },
      { label: 'SOFR-IORB',      value: `${sofrIorbBp >= 0 ? '+' : ''}${sofrIorbBp.toFixed(0)}bps` },
      { label: 'DXY 利率隐含值', value: dxyImpl.toFixed(2) },
      { label: 'DXY 超额溢价',   value: `${dxyResid >= 0 ? '+' : ''}${dxyResid.toFixed(2)}pts` },
    ],
    note,
  }
}

// ─── σ_alert ─────────────────────────────────────────────────────────────────

export function scoreSigmaAlert(data: PipelineData): VolAlertData & { rr_zscore: number } {
  const { fred, yahoo, residual } = data

  const vix        = isFinite(yahoo.vix)       ? yahoo.vix       : 20
  const vvix       = isFinite(yahoo.vvix)      ? yahoo.vvix      : 100
  const vxn        = isFinite(yahoo.vxn)       ? yahoo.vxn       : 22
  const ovx        = isFinite(yahoo.ovx)       ? yahoo.ovx       : 50
  const gvz        = isFinite(yahoo.gvz)       ? yahoo.gvz       : 20
  const gvzPrev    = isFinite(yahoo.gvz_prev)  ? yahoo.gvz_prev  : gvz * 1.05
  const vxhyg      = isFinite(yahoo.vxhyg)     ? yahoo.vxhyg     : 12
  const vxhygPrev  = isFinite(yahoo.vxhyg_prev)? yahoo.vxhyg_prev: vxhyg * 1.05
  const qqqRet     = isFinite(yahoo.qqq_ret)   ? yahoo.qqq_ret   : 0
  const spyRet     = isFinite(yahoo.spy_ret)   ? yahoo.spy_ret   : 0
  const tips1y     = isFinite(fred.tips10y)    ? fred.tips10y    : 1.85
  const ovx52w     = yahoo.ovx_52w_series.length > 0 ? yahoo.ovx_52w_series : [ovx]
  const dxyResid   = isFinite(residual.residual) ? residual.residual : 0
  const bbbSpread  = isFinite(fred.bbbSpread)  ? fred.bbbSpread  : 0.6

  // RR proxy from DXY residual (no Bloomberg free tier)
  const rrProxy = Math.max(-1.5, Math.min(1.5, dxyResid / 2.5))

  // Synthetic histories for z-score computation (252 points around current values)
  const rrHistory = Array.from({ length: 252 }, (_, i) =>
    rrProxy * (0.8 + 0.4 * Math.sin(i * 0.1))
  )
  const resHistory = Array.from({ length: 252 }, (_, i) =>
    Math.abs(dxyResid) * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.07)))
  )

  const rrZscore  = zscore(rrProxy, rrHistory)
  const resZscore = zscore(Math.abs(dxyResid), resHistory)
  const rrPct     = pct(rrProxy, rrHistory)

  // F1: 3M 25D Risk Reversal proxy
  const f1 = norm(Math.abs(rrZscore), 0, 2.5) * 100
  const f1Dir = Math.abs(rrZscore) > 0.6 ? 'push' : 'neutral'

  // F2: FX-rate spread residual
  const f2 = norm(Math.abs(resZscore), 0, 2.5) * 100
  const f2Dir = Math.abs(resZscore) > 0.5 ? 'push' : 'neutral'

  // F3: OVX
  const ovxPct = pct(ovx, ovx52w)
  const f3 = norm(ovx, 50, 150) * 100
  const f3Dir = ovxPct > 70 ? 'push' : ovxPct < 30 ? 'suppress' : 'neutral'

  // F4: VVIX/VIX ratio
  const vvixVix = vvix / Math.max(vix, 1)
  const f4 = norm(vvixVix, 3, 6) * 100
  const f4Dir = vvixVix > 4.5 ? 'push' : 'neutral'

  // F5: VXN-VIX gap
  const gap = vxn - vix
  const f5 = norm(gap, 0, 6) * 100
  const f5Dir = gap > 2 ? 'latent_push' : 'neutral'
  const f5Trigger = vxn > 30

  // F6: VXHYG (suppressor)
  const vxhygChg = ((vxhyg - vxhygPrev) / Math.max(vxhygPrev, 0.1)) * 100
  const f6 = (1 - norm(vxhyg, 5, 20)) * 100
  const f6Dir = vxhygChg < -15 ? 'suppress' : 'neutral'

  // F7: GVZ (suppressor)
  const gvzChg = ((gvz - gvzPrev) / Math.max(gvzPrev, 0.1)) * 100
  const f7 = (1 - norm(gvz, 15, 45)) * 100
  const f7Dir = gvzChg < -5 ? 'suppress' : 'neutral'

  // F8: RR × Residual resonance
  const compZ = rrZscore + resZscore
  const isRes =
    (rrZscore > 0.5 && resZscore > 0.5) || (rrZscore < -0.5 && resZscore < -0.5)
  const f8Raw = norm(Math.abs(compZ), 0, 3) * 100
  const f8 = isRes ? Math.min(100, f8Raw * 1.2) : f8Raw
  const f8Dir = Math.abs(compZ) > 1 ? 'push' : 'neutral'

  // F9: OVX × TIPS stagflation
  const stagflation = norm(ovx, 50, 150) * norm(tips1y, 1, 5)
  const f9 = Math.min(100, stagflation * 100)
  const f9Dir = ovx > 80 && tips1y > 3 ? 'push' : 'neutral'

  // F10: VVIX/VIX × RR
  const tailDir = vvixVix * Math.abs(rrProxy)
  const f10 = norm(tailDir, 0, 5) * 100
  const f10Dir = tailDir > 4 ? 'push' : tailDir > 2.5 ? 'latent_push' : 'neutral'

  // F11: VXN-VIX × QQQ/SPY divergence
  const spillover =
    spyRet !== 0
      ? gap * (Math.abs(qqqRet - spyRet) / Math.max(Math.abs(spyRet), 0.01))
      : 0
  const f11 = norm(spillover, 0, 5) * 100
  const f11Dir = f5Trigger ? 'latent_push' : 'neutral'

  // F12: VXHYG × CDS credit repair
  let cdsIg = bbbSpread * 100
  if (cdsIg < 5) cdsIg *= 100 // convert % → bps if needed
  const creditCalm = norm(-vxhygChg, 0, 30) * (1 - norm(cdsIg, 40, 120))
  const f12 = Math.min(100, creditCalm * 100)
  const f12Dir = vxhygChg < -15 && cdsIg < 80 ? 'suppress' : 'neutral'

  // Layer weights
  const directScore    = 0.5 * f1 + 0.5 * f2
  const crossAsset     = 0.3 * f3 + 0.25 * f4 + 0.2 * f5 + 0.15 * f6 + 0.1 * f7
  const compositeScore = 0.3 * f8 + 0.25 * f9 + 0.2 * f10 + 0.15 * f11 + 0.1 * f12

  const suppressDirs = [f6Dir, f7Dir, f12Dir]
  const suppressN = suppressDirs.filter((d) => d === 'suppress').length
  const suppressPen = suppressN * 5

  const sigma = r(
    clamp(0.3 * directScore + 0.35 * crossAsset + 0.35 * compositeScore - suppressPen)
  )

  const pushDirs = [f1Dir, f2Dir, f3Dir, f4Dir, f5Dir, f8Dir, f9Dir, f10Dir, f11Dir]
  const pushN = pushDirs.filter((d) => d === 'push' || d === 'latent_push').length

  const alertLevel: 'alert' | 'warning' | 'watch' | 'calm' =
    sigma >= 75 && pushN >= 5
      ? 'alert'
      : sigma >= 60
      ? 'warning'
      : sigma >= 40
      ? 'watch'
      : 'calm'

  const netDir = pushN > suppressN ? 'expansion' : 'compression'

  const summary =
    `推升因子(${pushN}个，含` +
    (Math.abs(rrZscore) > 1 ? 'RR极端、' : '') +
    (ovx > 80 ? 'OVX高位、' : '') +
    (vvixVix > 4.5 ? 'VVIX/VIX偏高' : '') +
    `)${pushN > suppressN ? '超过' : '未超过'}压制因子(${suppressN}个)，` +
    `整体偏向波动率${netDir === 'expansion' ? '扩张' : '收缩'}方向。`

  return {
    score: sigma,
    alert_level: alertLevel,
    push_count: pushN,
    suppress_count: suppressN,
    net_direction: netDir,
    summary,
    f1_rr:           { value: r(rrProxy, 3), zscore: r(rrZscore, 2), percentile: r(rrPct, 1), score: r(f1),  direction: f1Dir as 'push' | 'neutral' },
    f2_residual:     { value: r(dxyResid, 3), zscore: r(resZscore, 2),                         score: r(f2),  direction: f2Dir as 'push' | 'neutral' },
    f3_ovx:          { value: r(ovx, 2), percentile: r(ovxPct, 1),                             score: r(f3),  direction: f3Dir as 'push' | 'suppress' | 'neutral' },
    f4_vvix_vix:     { vvix: r(vvix, 2), vix: r(vix, 2), value: r(vvixVix, 2),                score: r(f4),  direction: f4Dir as 'push' | 'neutral' },
    f5_vxn_vix:      { vix: r(vix, 2), vxn: r(vxn, 2), gap: r(gap, 2), trigger: f5Trigger,    score: r(f5),  direction: f5Dir as 'latent_push' | 'neutral' },
    f6_vxhyg:        { value: r(vxhyg, 2), change_pct: r(vxhygChg, 2),                        score: r(f6),  direction: f6Dir as 'suppress' | 'neutral' },
    f7_gvz:          { value: r(gvz, 2), change_pct: r(gvzChg, 2),                             score: r(f7),  direction: f7Dir as 'suppress' | 'neutral' },
    f8_rr_residual:  { composite_z: r(compZ, 2), is_resonance: isRes,                          score: r(f8),  direction: f8Dir as 'push' | 'neutral' },
    f9_stagflation:  { ovx: r(ovx, 2), tips: r(tips1y, 2),                                    score: r(f9),  direction: f9Dir as 'push' | 'neutral' },
    f10_tail_directional: { value: r(tailDir, 2),                                              score: r(f10), direction: f10Dir as 'push' | 'latent_push' | 'neutral' },
    f11_tech_spillover:   { gap: r(gap, 2), spillover: r(spillover, 2), trigger: f5Trigger,   score: r(f11), direction: f11Dir as 'latent_push' | 'neutral' },
    f12_credit_repair:    { vxhyg_chg: r(vxhygChg, 2), cds: r(cdsIg, 1),                     score: r(f12), direction: f12Dir as 'suppress' | 'neutral' },
    rr_zscore: r(rrZscore, 3),
  }
}

// ─── γ (composite) ───────────────────────────────────────────────────────────

export interface GammaResult {
  gamma: number
  signal: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  rf_score: number
  pi_risk_score: number
  cy_score: number
  sigma_score: number
  sigma_weight: number
}

export function computeGamma(
  rfScore: number,
  piScore: number,
  cyScore: number,
  sigma: { score: number; push_count: number; suppress_count: number },
  rrZscore: number
): GammaResult {
  const { score: sigS, push_count: push, suppress_count: suppress } = sigma

  const sigmaW =
    push >= 5 && suppress <= 1
      ? 0.2
      : suppress >= 2 && push <= 3
      ? 0.1
      : 0.15

  const sigmaSign = rrZscore >= 0 ? 1 : -1

  const raw =
    0.35 * rfScore +
    0.25 * piScore -
    0.25 * cyScore +
    sigmaW * sigS * sigmaSign

  const gamma = r(clamp(raw + 15))
  const signal: 'BULLISH' | 'NEUTRAL' | 'BEARISH' =
    gamma >= 65 ? 'BULLISH' : gamma < 35 ? 'BEARISH' : 'NEUTRAL'

  return { gamma, signal, rf_score: rfScore, pi_risk_score: piScore, cy_score: cyScore, sigma_score: sigS, sigma_weight: sigmaW }
}


// ─── DCA Rhythm Signal (定投节奏信号灯) ─────────────────────────────────────

import type { DcaRhythm, DcaSignalData } from '@/types'

/**
 * Compute DCA rhythm signal from gamma score + sigma alert data.
 *
 * Architecture (from roundtable consensus):
 *   Layer 3 — 5-state signal light for personal investors
 *   Based on γ score (direction) + fragility index (risk)
 *   Fragility = f(factor_divergence, sigma_alert_level, conflict_score)
 */
export function computeDcaSignal(
  gamma: GammaResult,
  sigma: { score: number; push_count: number; suppress_count: number; alert_level: string },
  conflictScore: number = 0,
): DcaSignalData {
  // ── Factor consensus from σ_alert directions ──
  const pushN = sigma.push_count
  const suppressN = sigma.suppress_count
  const neutralN = 12 - pushN - suppressN
  const total = 12

  // Alignment = how many factors agree with majority direction (0-1)
  const maxGroup = Math.max(pushN, suppressN, neutralN)
  const alignment = maxGroup / total

  // ── Fragility Index (0-100) ──
  // Combines: factor divergence + sigma alert level + conflict score
  const divergence = 1 - alignment  // 0 = all agree, 1 = max disagreement
  const sigmaStress = sigma.score / 100  // 0-1
  const conflict = Math.min(conflictScore, 1)  // 0-1

  const fragility = r(clamp(
    30 * divergence +      // factor disagreement weight
    40 * sigmaStress +     // volatility stress weight
    30 * conflict          // gamma-ML conflict weight
  ) * 100)

  // ── Confidence (1-5) ──
  const confidence = fragility < 20 ? 5
    : fragility < 35 ? 4
    : fragility < 55 ? 3
    : fragility < 75 ? 2
    : 1

  // ── DCA Rhythm decision ──
  // Uses γ score (direction quality) + fragility (risk level)
  const g = gamma.gamma
  let rhythm: DcaRhythm
  let label: string
  let reason: string

  if (fragility > 85) {
    rhythm = 'pause_reduce'
    label = '暂停+减持'
    reason = `脆弱度极高(${fragility})，${pushN}个因子预警，建议暂停定投并适当减持`
  } else if (fragility > 70 || sigma.alert_level === 'alert') {
    rhythm = 'pause'
    label = '暂停定投'
    reason = `脆弱度偏高(${fragility})，波动率${sigma.alert_level === 'alert' ? '警报' : '预警'}，等待更清晰信号`
  } else if (fragility > 45 || (g >= 35 && g < 65)) {
    rhythm = 'hold'
    label = '维持不变'
    reason = `信号混合(γ=${g}，脆弱度=${fragility})，因子一致性${r(alignment * 100)}%，暂不操作`
  } else if (g >= 65 && fragility < 30) {
    rhythm = 'accelerate'
    label = '加速定投'
    reason = `γ看多(${g})且脆弱度低(${fragility})，${12 - pushN}个因子支持强势，可加大投入`
  } else {
    rhythm = 'normal'
    label = '正常定投'
    reason = `γ评分${g}，脆弱度${fragility}，因子一致性${r(alignment * 100)}%，按计划执行`
  }

  return {
    rhythm,
    label,
    fragility,
    confidence,
    consensus: {
      bullish: pushN,
      neutral: neutralN,
      bearish: suppressN,
      total,
      alignment: r(alignment, 2),
    },
    reason,
  }
}
