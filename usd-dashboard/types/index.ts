// ─── Signal Types ──────────────────────────────────────────────────────────
export type Signal = 'BULLISH' | 'NEUTRAL' | 'BEARISH'
export type AlertLevel = 'alert' | 'warning' | 'watch' | 'calm'
export type FactorDirection = 'push' | 'latent_push' | 'suppress' | 'neutral'
export type RiskType = 'global_risk' | 'us_specific'

// ─── Score ─────────────────────────────────────────────────────────────────
export interface ScoreData {
  gamma: number           // 0-100 综合评分
  signal: Signal
  rf_score: number        // 0-100
  pi_risk_score: number   // 0-100
  cy_score: number        // 0-100
  sigma_score: number     // 0-100
  data_date: string       // e.g. "2026-03-21"
  data_time: string       // e.g. "16:00 ET Close"
}

// ─── DXY ───────────────────────────────────────────────────────────────────
export interface DxyData {
  price: number
  change_1d: number       // absolute
  change_1d_pct: number   // percent
  high_52w: number
  low_52w: number
  real_rate: number       // 10Y TIPS
  sofr: number
  history: { date: string; price: number }[]
}

// ─── Sub-factor ────────────────────────────────────────────────────────────
export interface SubFactor {
  label: string
  weight_label: string    // e.g. "57%"
  value: number | string
  score: number           // 0-100 for bar
  direction?: 'positive' | 'negative' | 'neutral'
}

// ─── r_f Component ─────────────────────────────────────────────────────────
export interface RfData {
  score: number
  signal: string
  sub_factors: SubFactor[]
  data_rows: { label: string; value: string }[]
}

// ─── π_risk Component ──────────────────────────────────────────────────────
export interface PiRiskData {
  score: number
  signal: string
  risk_type: RiskType
  sub_factors: SubFactor[]
  data_rows: { label: string; value: string }[]
  note: string
}

// ─── cy Component ──────────────────────────────────────────────────────────
export interface CyData {
  score: number
  signal: string
  sub_factors: SubFactor[]
  data_rows: { label: string; value: string }[]
  note: string
}

// ─── σ_alert Factors ───────────────────────────────────────────────────────
export interface F1RR {
  value: number
  zscore: number
  percentile: number
  score: number
  direction: FactorDirection
}

export interface F2Residual {
  value: number
  zscore: number
  score: number
  direction: FactorDirection
}

export interface F3Ovx {
  value: number
  percentile: number
  score: number
  direction: FactorDirection
}

export interface F4VvixVix {
  vvix: number
  vix: number
  value: number           // ratio
  score: number
  direction: FactorDirection
}

export interface F5VxnVix {
  vix: number
  vxn: number
  gap: number
  trigger: boolean
  score: number
  direction: FactorDirection
}

export interface F6Vxhyg {
  value: number
  change_pct: number
  score: number
  direction: FactorDirection
}

export interface F7Gvz {
  value: number
  change_pct: number
  score: number
  direction: FactorDirection
}

export interface F8RrResidual {
  composite_z: number
  is_resonance: boolean
  score: number
  direction: FactorDirection
}

export interface F9Stagflation {
  ovx: number
  tips: number
  score: number
  direction: FactorDirection
}

export interface F10TailDirectional {
  value: number
  score: number
  direction: FactorDirection
}

export interface F11TechSpillover {
  gap: number
  spillover: number
  trigger: boolean
  score: number
  direction: FactorDirection
}

export interface F12CreditRepair {
  vxhyg_chg: number
  cds: number
  score: number
  direction: FactorDirection
}

export interface VolAlertData {
  score: number
  alert_level: AlertLevel
  push_count: number
  suppress_count: number
  net_direction: 'expansion' | 'compression'
  summary: string
  f1_rr: F1RR
  f2_residual: F2Residual
  f3_ovx: F3Ovx
  f4_vvix_vix: F4VvixVix
  f5_vxn_vix: F5VxnVix
  f6_vxhyg: F6Vxhyg
  f7_gvz: F7Gvz
  f8_rr_residual: F8RrResidual
  f9_stagflation: F9Stagflation
  f10_tail_directional: F10TailDirectional
  f11_tech_spillover: F11TechSpillover
  f12_credit_repair: F12CreditRepair
}

// ─── Yield Decomp ──────────────────────────────────────────────────────────
export interface YieldDecompData {
  nominal_10y: number
  real_rate: number       // TIPS
  bei_10y: number         // Breakeven inflation
  term_premium: number    // ACM approx
  driver: 'real_rate' | 'inflation' | 'term_premium'
  bei_5y: number
  note: string
}

// ─── Hedge / CIP ───────────────────────────────────────────────────────────
export interface HedgeData {
  score: number
  cip_basis: number
  eur_long: number
  jpy_long: number
  dxy_rate_divergence: number
  sofr: number
  estr: number
  note: string
}

// ─── FX Pairs ──────────────────────────────────────────────────────────────
export interface FxPair {
  symbol: string
  label: string
  price: number
  change_pct: number
  signal: Signal
}

export interface FxData {
  pairs: FxPair[]
  trend: { date: string; eurusd: number; usdjpy: number; dxy: number }[]
}

// ─── CFTC ──────────────────────────────────────────────────────────────────
export interface CftcCurrency {
  label: string
  net: number             // net long USD in thousands
  prev: number
  history: number[]       // last 7 weeks
}

export interface CftcData {
  currencies: CftcCurrency[]
  note: string
}

// ─── Signal History ────────────────────────────────────────────────────────
export interface SignalHistoryEntry {
  date: string
  signal: Signal
  score: number
  change: '↑' | '↓' | '↔'
  note: string
}

// ─── Phase 2: IC Tracking ──────────────────────────────────────────────────
export type Regime = '加息期' | '降息期' | '震荡期'

export interface IcHistoryEntry {
  date: string
  ic: number
  ic_ma20: number
  regime: Regime
}

export interface IcTrackingData {
  factor: string        // 'F1' … 'F9'
  factor_name: string
  ic_today: number
  ic_ma20: number
  icir: number
  history: IcHistoryEntry[]
}

// ─── Phase 2: SHAP Attribution ─────────────────────────────────────────────
export interface ShapFactor {
  name: string
  shap_value: number
  factor_value: number
}

export interface ShapData {
  base_value: number
  output_value: number
  date: string
  factors: ShapFactor[]
}

// ─── Phase 2: Regime IC Heatmap ────────────────────────────────────────────
export interface RegimeIcData {
  regimes: string[]
  factors: string[]
  factor_names: string[]
  matrix: number[][]    // [factor_idx][regime_idx]
}

// ─── Phase 2: Correlation Matrix ───────────────────────────────────────────
export interface CorrelationData {
  labels: string[]
  full_labels: string[]
  matrix: number[][]
}

// ─── Phase 2: NAV Curve ────────────────────────────────────────────────────
export interface NavHistoryEntry {
  date: string
  nav: number
  dxy_norm: number
  drawdown: number
}

export interface NavCurveData {
  total_return: number
  sharpe: number
  max_drawdown: number
  win_rate: number
  history: NavHistoryEntry[]
}

// ─── Combined Dashboard Data ───────────────────────────────────────────────
export interface DashboardData {
  score: ScoreData
  dxy: DxyData
  rf: RfData
  pi_risk: PiRiskData
  cy: CyData
  vol_alert: VolAlertData
  yield_decomp: YieldDecompData
  hedge: HedgeData
  fx: FxData
  cftc: CftcData
  signal_history: SignalHistoryEntry[]
}
