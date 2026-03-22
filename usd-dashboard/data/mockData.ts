import type { DashboardData } from '@/types'

// Generate last 30 days of dates
function lastNDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date('2026-03-21')
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

const dates30 = lastNDates(30)
const dates14 = lastNDates(14)

// 14日σ_alert因子趋势（推升 vs 压制 vs 综合评分）
export const volAlertHistory = dates14.map((date, i) => ({
  date: date.slice(5),          // MM-DD
  push:     [4, 4, 5, 5, 6, 5, 5, 4, 5, 6, 5, 5, 5, 5][i],
  suppress: [3, 3, 3, 2, 2, 3, 3, 3, 2, 2, 3, 3, 3, 3][i],
  score:    [58, 60, 65, 63, 72, 66, 64, 60, 63, 70, 68, 67, 68, 68][i],
}))

export const mockData: DashboardData = {
  // ─── Score ─────────────────────────────────────────────────────────────
  score: {
    gamma: 58,
    signal: 'NEUTRAL',
    rf_score: 72,
    pi_risk_score: 45,
    cy_score: 55,
    sigma_score: 68,
    data_date: '2026-03-21',
    data_time: '16:00 ET Close',
  },

  // ─── DXY ───────────────────────────────────────────────────────────────
  dxy: {
    price: 103.24,
    change_1d: 0.31,
    change_1d_pct: 0.30,
    high_52w: 110.18,
    low_52w: 99.58,
    real_rate: 1.85,
    sofr: 5.31,
    history: dates30.map((date, i) => ({
      date,
      price: 100.5 + Math.sin(i / 5) * 2 + i * 0.09,
    })),
  },

  // ─── r_f ───────────────────────────────────────────────────────────────
  rf: {
    score: 72,
    signal: 'USD 看多',
    sub_factors: [
      { label: 'Fed vs ECB 利差', weight_label: '57%', value: '+1.50%', score: 78, direction: 'positive' },
      { label: 'Fed vs BOJ 利差', weight_label: '14%', value: '+4.25%', score: 92, direction: 'positive' },
      { label: 'Fed vs BOE 利差', weight_label: '12%', value: '+0.25%', score: 52, direction: 'positive' },
      { label: '实际利率 (10Y-BEI)', weight_label: '10%', value: '1.85%', score: 64, direction: 'positive' },
      { label: '利率路径 (2Y vs Fed)', weight_label: '7%', value: '鹰派', score: 70, direction: 'positive' },
    ],
    data_rows: [
      { label: 'Fed Funds', value: '4.50%' },
      { label: 'ECB Main', value: '3.00%' },
      { label: 'BOJ Call', value: '0.25%' },
      { label: 'BOE Bank', value: '4.25%' },
      { label: '€STR', value: '2.90%' },
      { label: 'SONIA', value: '4.19%' },
      { label: '2Y Treasury', value: '4.62%' },
    ],
  },

  // ─── π_risk ────────────────────────────────────────────────────────────
  pi_risk: {
    score: 45,
    signal: '混合信号',
    risk_type: 'us_specific',
    sub_factors: [
      { label: '期限溢价 (10Y ACM)', weight_label: '40%', value: '+82bps', score: 58, direction: 'neutral' },
      { label: 'VIX', weight_label: '35%', value: '18.5', score: 40, direction: 'neutral' },
      { label: 'MOVE (债券波动率)', weight_label: '25%', value: '92', score: 38, direction: 'neutral' },
    ],
    data_rows: [
      { label: '10Y TP (ACM)', value: '+82bps' },
      { label: '2Y TP', value: '+18bps' },
      { label: 'VIX', value: '18.5' },
      { label: 'MOVE', value: '92' },
      { label: 'TP 正常范围', value: '0~200bps' },
      { label: 'TP 分位数', value: '41%ile' },
    ],
    note: '当前 TP 温和上行 + VIX 中位，信号混合。期限溢价主要受财政赤字担忧驱动，属美国特有风险，轻度压制美元。',
  },

  // ─── cy ────────────────────────────────────────────────────────────────
  cy: {
    score: 55,
    signal: 'USD 轻度拖累',
    sub_factors: [
      { label: '黄金走势 (30d)', weight_label: '50%', value: '+8.2%', score: 68, direction: 'negative' },
      { label: 'SOFR-IORB 利差', weight_label: '25%', value: '-2bps', score: 45, direction: 'neutral' },
      { label: 'DXY 残差溢价', weight_label: '25%', value: '+1.2pts', score: 60, direction: 'negative' },
    ],
    data_rows: [
      { label: '黄金价格', value: '$3,028' },
      { label: '黄金 30d 趋势', value: '+8.2%' },
      { label: 'SOFR', value: '5.31%' },
      { label: 'IORB', value: '5.33%' },
      { label: 'SOFR-IORB', value: '-2bps' },
      { label: 'DXY 利率隐含值', value: '102.04' },
      { label: 'DXY 超额溢价', value: '+1.20pts' },
    ],
    note: '黄金强势上行(+8.2% 30日)反映去美元化资金流，对 DXY 形成结构性拖累。SOFR-IORB 轻微倒挂，资金市场基本健康。',
  },

  // ─── σ_alert ───────────────────────────────────────────────────────────
  vol_alert: {
    score: 68,
    alert_level: 'warning',
    push_count: 5,
    suppress_count: 3,
    net_direction: 'expansion',
    summary: '推升因子(RR极端、OVX极高、VVIX/VIX偏高、滞胀共振)的极端程度超过压制因子(VXHYG骤降、GVZ回落)，整体偏向波动率扩张方向。',
    f1_rr: {
      value: 0.80,
      zscore: 1.82,
      percentile: 97,
      score: 72,
      direction: 'push',
    },
    f2_residual: {
      value: 1.2,
      zscore: 1.35,
      score: 54,
      direction: 'push',
    },
    f3_ovx: {
      value: 101.97,
      percentile: 75,
      score: 78,
      direction: 'push',
    },
    f4_vvix_vix: {
      vvix: 115.7,
      vix: 24.21,
      value: 4.82,
      score: 61,
      direction: 'push',
    },
    f5_vxn_vix: {
      vix: 24.21,
      vxn: 26.32,
      gap: 2.11,
      trigger: false,
      score: 35,
      direction: 'latent_push',
    },
    f6_vxhyg: {
      value: 9.07,
      change_pct: -27.56,
      score: 78,
      direction: 'suppress',
    },
    f7_gvz: {
      value: 30.56,
      change_pct: -8.83,
      score: 52,
      direction: 'suppress',
    },
    f8_rr_residual: {
      composite_z: 1.42,
      is_resonance: true,
      score: 62,
      direction: 'push',
    },
    f9_stagflation: {
      ovx: 101.97,
      tips: 4.72,
      score: 85,
      direction: 'push',
    },
    f10_tail_directional: {
      value: 3.86,
      score: 77,
      direction: 'push',
    },
    f11_tech_spillover: {
      gap: 2.11,
      spillover: 1.8,
      trigger: false,
      score: 36,
      direction: 'latent_push',
    },
    f12_credit_repair: {
      vxhyg_chg: -27.56,
      cds: 59.6,
      score: 68,
      direction: 'suppress',
    },
  },

  // ─── Yield Decomp ──────────────────────────────────────────────────────
  yield_decomp: {
    nominal_10y: 4.28,
    real_rate: 1.85,
    bei_10y: 2.33,
    term_premium: 0.10,
    driver: 'real_rate',
    bei_5y: 2.48,
    note: '当前 10Y 收益率由实际利率主导（1.85%），BEI 通胀预期温和（2.33%）。期限溢价小幅正值（+10bps），财政担忧尚未发酵至极端水平。',
  },

  // ─── Hedge ─────────────────────────────────────────────────────────────
  hedge: {
    score: 62,
    cip_basis: -18.5,
    eur_long: 12.4,
    jpy_long: -8.2,
    dxy_rate_divergence: 1.2,
    sofr: 5.31,
    estr: 2.90,
    note: '对冲传导效率中等。CIP 基差轻度偏负，反映美元短端融资压力。资管机构 EUR 持有多头，JPY 净空头维持，整体传导效率尚可。',
  },

  // ─── FX Pairs ──────────────────────────────────────────────────────────
  fx: {
    pairs: [
      { symbol: 'DXY', label: 'DXY Index', price: 103.24, change_pct: 0.30, signal: 'NEUTRAL' },
      { symbol: 'EURUSD', label: 'EUR/USD', price: 1.0842, change_pct: -0.22, signal: 'NEUTRAL' },
      { symbol: 'USDJPY', label: 'USD/JPY', price: 149.82, change_pct: 0.45, signal: 'BULLISH' },
      { symbol: 'USDCNY', label: 'USD/CNY', price: 7.2340, change_pct: 0.12, signal: 'NEUTRAL' },
      { symbol: 'USDMXN', label: 'USD/MXN', price: 20.15, change_pct: -0.38, signal: 'BEARISH' },
    ],
    trend: lastNDates(7).map((date, i) => ({
      date,
      eurusd: 1.088 - i * 0.003 + Math.random() * 0.002,
      usdjpy: 148 + i * 0.3 + Math.random() * 0.5,
      dxy: 101.5 + i * 0.25 + Math.random() * 0.3,
    })),
  },

  // ─── CFTC ──────────────────────────────────────────────────────────────
  cftc: {
    currencies: [
      { label: 'USD Index', net: 28500, prev: 24200, history: [18000, 20500, 22000, 24200, 25800, 27100, 28500] },
      { label: 'EUR (反向)', net: -15200, prev: -12800, history: [-8000, -10200, -11500, -12800, -13900, -14600, -15200] },
      { label: 'JPY (反向)', net: -8700, prev: -9200, history: [-11000, -10500, -9800, -9200, -9000, -8900, -8700] },
      { label: 'GBP (反向)', net: 4200, prev: 3800, history: [2000, 2800, 3200, 3800, 4000, 4100, 4200] },
      { label: 'CAD', net: -6100, prev: -5500, history: [-3500, -4200, -4800, -5500, -5800, -6000, -6100] },
    ],
    note: 'USD Index 净多头持续攀升至28,500手，创近6个月新高，多头仓位拥挤。EUR净空头扩大，与利率差逻辑吻合。JPY净空头小幅收窄，关注BOJ政策变化。',
  },

  // ─── Signal History ────────────────────────────────────────────────────
  signal_history: [
    { date: '2026-03-21', signal: 'NEUTRAL', score: 58, change: '↔', note: '综合信号持平；黄金强势拖累 cy，利率差支撑 r_f 维持高位' },
    { date: '2026-03-20', signal: 'NEUTRAL', score: 57, change: '↔', note: 'VIX 小幅回落，风险情绪改善；RR 维持高位预警' },
    { date: '2026-03-19', signal: 'NEUTRAL', score: 59, change: '↓', note: 'OVX 大幅上行推升 σ_alert；整体评分小幅上移但未破65' },
    { date: '2026-03-18', signal: 'BULLISH', score: 66, change: '↑', note: 'Fed 维持鹰派立场，利率差扩大；信号短暂升至看多' },
    { date: '2026-03-17', signal: 'NEUTRAL', score: 62, change: '↔', note: '周末数据平淡；市场等待 FOMC 会议纪要' },
    { date: '2026-03-16', signal: 'NEUTRAL', score: 60, change: '↑', note: '黄金高位回落缓解 cy 压力；信号小幅改善' },
    { date: '2026-03-15', signal: 'NEUTRAL', score: 54, change: '↓', note: '黄金单日+2.8%推升去美元化信号；π_risk 期限溢价走扩' },
  ],
}

// ─── Phase 2 Mock Data ──────────────────────────────────────────────────────

import type { IcTrackingData, ShapData, RegimeIcData, CorrelationData, NavCurveData } from '@/types'

function lastNTradingDates(n: number): string[] {
  const dates: string[] = []
  const d = new Date('2026-03-21')
  while (dates.length < n) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) dates.unshift(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 1)
  }
  return dates
}

const tradingDates252 = lastNTradingDates(252)

function assignRegime(date: string): '加息期' | '降息期' | '震荡期' {
  if (date < '2025-09-18') return '加息期'
  if (date < '2026-01-15') return '降息期'
  return '震荡期'
}

const FACTOR_DEFS = [
  { id: 'F1', name: '3M 25D Risk Reversal',   ic_today: 0.09,   icir: 1.85 },
  { id: 'F2', name: 'MOVE Index',              ic_today: 0.11,   icir: 2.20 },
  { id: 'F3', name: 'VIX',                    ic_today: 0.07,   icir: 1.42 },
  { id: 'F4', name: 'OVX 原油波动率',          ic_today: -0.04,  icir: 0.88 },
  { id: 'F5', name: '地缘政治风险',            ic_today: 0.1612, icir: 3.015 },
  { id: 'F6', name: '期限溢价 (ACM 10Y TP)',   ic_today: 0.13,   icir: 2.54 },
  { id: 'F7', name: '收益率曲线斜率 (10Y-2Y)', ic_today: 0.08,   icir: 1.67 },
  { id: 'F8', name: 'DXY 残差偏离',            ic_today: 0.15,   icir: 2.88 },
  { id: 'F9', name: 'SOFR-IORB 利差',         ic_today: 0.06,   icir: 1.31 },
]

function generateIcHistory(icir: number) {
  const raw: number[] = []
  for (let i = 0; i < 252; i++) {
    const signal = icir * 0.04
    const noise = (Math.random() - 0.5) * 0.18
    const mr = -0.12 * (raw[i - 1] ?? 0)
    raw.push(+(signal + noise + mr).toFixed(4))
  }
  return tradingDates252.map((date, i) => {
    const window = raw.slice(Math.max(0, i - 19), i + 1)
    const ma20 = +(window.reduce((s, v) => s + v, 0) / window.length).toFixed(4)
    return { date, ic: raw[i], ic_ma20: ma20, regime: assignRegime(date) }
  })
}

export const mockIcTracking: Record<string, IcTrackingData> = Object.fromEntries(
  FACTOR_DEFS.map(f => {
    const history = generateIcHistory(f.icir)
    const ic_ma20 = +(history.slice(-20).reduce((s, e) => s + e.ic, 0) / 20).toFixed(4)
    return [f.id, { factor: f.id, factor_name: f.name, ic_today: f.ic_today, ic_ma20, icir: f.icir, history }]
  })
)

export const mockShap: ShapData = {
  base_value: 50.0,
  output_value: 58.3,
  date: '2026-03-21',
  factors: [
    { name: 'r_f',         shap_value:  4.2, factor_value: 72 },
    { name: 'π_risk',      shap_value:  3.1, factor_value: 65 },
    { name: 'F8 DXY残差',  shap_value:  2.4, factor_value: 0.82 },
    { name: 'F5 地缘政治', shap_value:  1.8, factor_value: 0.16 },
    { name: 'F6 期限溢价', shap_value:  1.3, factor_value: 0.31 },
    { name: 'cy',          shap_value: -2.8, factor_value: 44 },
    { name: 'F3 VIX',      shap_value: -1.2, factor_value: 18.5 },
    { name: 'F4 OVX',      shap_value: -0.5, factor_value: 42.3 },
  ],
}

export const mockRegimeIc: RegimeIcData = {
  regimes: ['加息期', '降息期', '震荡期'],
  factors: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'],
  factor_names: ['RR偏斜', 'MOVE', 'VIX', 'OVX', '地缘政治', '期限溢价', '收益率斜率', 'DXY残差', 'SOFR利差'],
  matrix: [
    [ 0.12,  0.04,  0.08],
    [ 0.17,  0.11,  0.09],
    [ 0.09,  0.05,  0.06],
    [-0.06, -0.03, -0.04],
    [ 0.18,  0.12,  0.15],
    [ 0.15,  0.09,  0.11],
    [ 0.10,  0.06,  0.07],
    [ 0.19,  0.13,  0.14],
    [ 0.07,  0.04,  0.05],
  ],
}

export const mockCorrelation: CorrelationData = {
  labels: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'],
  full_labels: ['RR偏斜', 'MOVE', 'VIX', 'OVX', '地缘政治', '期限溢价', '收益率斜率', 'DXY残差', 'SOFR利差'],
  matrix: [
    [ 1.00,  0.62,  0.48,  0.21,  0.15,  0.38,  0.29, -0.12,  0.18],
    [ 0.62,  1.00,  0.71,  0.35,  0.22,  0.55,  0.41, -0.08,  0.24],
    [ 0.48,  0.71,  1.00,  0.52,  0.18,  0.44,  0.36, -0.15,  0.19],
    [ 0.21,  0.35,  0.52,  1.00,  0.09,  0.28,  0.22, -0.31,  0.11],
    [ 0.15,  0.22,  0.18,  0.09,  1.00,  0.13,  0.08,  0.05,  0.07],
    [ 0.38,  0.55,  0.44,  0.28,  0.13,  1.00,  0.78, -0.22,  0.33],
    [ 0.29,  0.41,  0.36,  0.22,  0.08,  0.78,  1.00, -0.19,  0.27],
    [-0.12, -0.08, -0.15, -0.31,  0.05, -0.22, -0.19,  1.00, -0.14],
    [ 0.18,  0.24,  0.19,  0.11,  0.07,  0.33,  0.27, -0.14,  1.00],
  ],
}

function generateNavCurve(): NavCurveData {
  const dates = lastNTradingDates(252)
  let nav = 1.0, peak = 1.0, dxy = 100.0
  const rets: number[] = []
  const history = dates.map((date, i) => {
    const score = 48 + 20 * Math.sin(i / 40) + (Math.random() - 0.5) * 10
    const sig = score > 65 ? 1 : score < 35 ? -1 : 0
    const dxy_ret = (Math.random() - 0.48) * 0.006
    dxy *= (1 + dxy_ret)
    const strat_ret = sig * dxy_ret * 1.5
    nav *= (1 + strat_ret)
    peak = Math.max(peak, nav)
    rets.push(strat_ret)
    return { date, nav: +nav.toFixed(4), dxy_norm: +(dxy / 100).toFixed(4), drawdown: +((nav - peak) / peak).toFixed(4) }
  })
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const std = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length)
  return {
    total_return: +(nav - 1).toFixed(4),
    sharpe: +(mean / std * Math.sqrt(252)).toFixed(2),
    max_drawdown: +Math.min(...history.map(h => h.drawdown)).toFixed(4),
    win_rate: +(rets.filter(r => r > 0).length / rets.length).toFixed(4),
    history,
  }
}

export const mockNavCurve: NavCurveData = generateNavCurve()
