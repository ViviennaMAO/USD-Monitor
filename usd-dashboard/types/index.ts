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

// ─── Yield Curve ──────────────────────────────────────────────────────────
export interface YieldCurvePoint {
  tenor: string           // "1M", "3M", "1Y", "10Y", etc.
  value: number
}

export interface YieldCurveSnapshot {
  label: string           // "当前", "1个月前", etc.
  date: string
  color: string
  data: YieldCurvePoint[]
}

export interface YieldCurveData {
  curves: YieldCurveSnapshot[]
  tenors: string[]
}

// ─── SOFR Analysis ────────────────────────────────────────────────────────
export interface SofrSpreadData {
  date: string
  sofr: number
  p1: number              // 1st percentile
  p25: number             // 25th percentile
  p75: number             // 75th percentile
  p99: number             // 99th percentile
  spread_1_99: number     // p99 - p1
  iorb: number
  effr: number
}

export interface SofrAnalysisData {
  current: SofrSpreadData
  history: SofrSpreadData[]
  assessment: string
}

// ─── Repo Market ──────────────────────────────────────────────────────────
export interface RepoRateData {
  date: string
  sofr: number
  effr: number
  iorb: number
  rrp: number             // ON RRP award rate
  bgcr: number            // Broad General Collateral Rate
  tgcr: number            // Tri-Party General Collateral Rate
}

export interface RepoMarketData {
  current: RepoRateData
  history: RepoRateData[]
  assessment: string
}

// ─── FX Swap Term Structure ───────────────────────────────────────────────
export interface SwapTenorPoint {
  tenor: string           // "1W", "1M", "3M", "6M", "1Y"
  points: number          // swap points (pips)
}

export interface FxSwapPair {
  pair: string            // "USD/JPY", "EUR/USD", etc.
  flag: string
  data: SwapTenorPoint[]
  assessment: string
}

export interface FxSwapData {
  pairs: FxSwapPair[]
  date: string
  offshore_assessment: string
}

// ─── Fed Watch ────────────────────────────────────────────────────────────
export type HawkDoveScore = -2 | -1 | 0 | 1 | 2  // -2=very dovish, 2=very hawkish

export interface FomcEntry {
  date: string
  type: 'meeting' | 'minutes' | 'speech'
  speaker?: string
  title: string
  summary: string
  hawkdove: HawkDoveScore
  has_vote: boolean
  key_quotes?: string[]
}

export interface FedWatchData {
  timeline: FomcEntry[]
  hawkdove_trend: { date: string; score: number; ma5: number }[]
  current_rate: number
  next_meeting: string
  dot_plot_median: number
  assessment: string
}

// ─── Unified Signal (Signal Router) ──────────────────────────────────────────
export interface ConflictDiagnosis {
  has_conflict: boolean
  conflict_score?: number
  gamma_driver?: string
  gamma_driver_score?: number
  ml_opposing_factor?: string
  ml_opposing_shap?: number
  diagnosis: string
  top_shap_factors?: { name: string; shap: number }[]
}

export interface UnifiedSignalData {
  date: string
  dxy_price: number

  // Input signals
  gamma_score: number
  gamma_signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  ml_prediction: number
  ml_signal: 'BUY' | 'SELL' | 'NEUTRAL'

  // Conflict analysis
  conflict_score: number
  conflict_level: 'high' | 'medium' | 'low'

  // Regime
  regime_state: 'crisis' | 'policy_shock' | 'transition' | 'normal'
  regime_detail: {
    regime: string
    multiplier: number
  }

  // Unified decision
  action: 'LONG' | 'SHORT' | 'FLAT'
  size_mult: number
  stop_mult: number
  signal_source: string

  // Conflict diagnosis
  diagnosis: ConflictDiagnosis

  // Matrix position
  matrix_position: {
    gamma_dir: string
    ml_dir: string
  }

  // P1: Orthogonalized ML
  ml_ortho?: number | null

  // P1: Calibration metadata
  p1_calibration?: {
    active: boolean
    weights?: Record<string, number>
    shifts?: Record<string, number>
    component_ics?: Record<string, number>
  }

  // P1: Orthogonalization metadata
  p1_orthogonalization?: {
    active: boolean
    ml_raw?: number
    ml_ortho?: number
    beta?: number
    r_squared?: number
    explained_by_gamma_pct?: number
    reason?: string
  }
}

// ─── P1: Calibration Data ────────────────────────────────────────────────
export interface CalibrationData {
  calibration_date: string
  status: string
  reason: string
  base_weights: Record<string, number>
  calibrated_weights: Record<string, number>
  shifts: Record<string, number>
  component_ics: Record<string, number>
  max_shift_constraint: number
  schedule: string
}

// ─── P1: Orthogonalization Data ──────────────────────────────────────────
export interface OrthogonalizationData {
  date: string
  ols_params: {
    alpha: number
    beta: number
    r_squared: number
    n_obs: number
  }
  orthogonalization: {
    ml_raw: number
    ml_raw_norm: number
    ml_ortho_norm: number
    ml_ortho_pct: number
    gamma_norm: number
    gamma_expected_ml: number
    beta: number
    alpha: number
    r_squared: number
    explained_by_gamma_pct: number
    independent_info_pct: number
  }
}

// ─── P2: Conflict Backtest ────────────────────────────────────────────────
export interface ConflictBucket {
  label: string
  count: number
  avg_return: number | null
  std_return: number | null
  win_rate: number | null
  avg_abs_return: number | null
}

export interface ConsensusAttribution {
  type: string
  label: string
  count: number
  avg_strat_return: number
  sharpe: number
  hit_rate: number
  avg_conflict: number
}

export interface ThresholdGridEntry {
  threshold: number
  total_return: number
  sharpe: number
  max_drawdown: number
  conflict_pct: number
}

export interface ConflictTimeSeriesPoint {
  date: string
  conflict: number
  actual_ret: number
  consensus: string
}

export interface ConflictBacktestData {
  date: string
  test_period: { start: string; end: string; n_observations: number }
  bucket_analysis: ConflictBucket[]
  consensus_attribution: ConsensusAttribution[]
  threshold_grid: ThresholdGridEntry[]
  optimal_threshold: ThresholdGridEntry
  time_series: ConflictTimeSeriesPoint[]
  soros_hypothesis: {
    description: string
    high_conflict_pct: number
    high_conflict_volatility: number | null
    low_conflict_volatility: number | null
  }
}

// ─── P2: Signal Attribution ──────────────────────────────────────────────
export interface StrategyResult {
  strategy: string
  label: string
  total_return: number
  sharpe: number
  max_drawdown: number
  hit_rate: number
  n_trades: number
  nav_series: number[]
}

export interface SignalAttributionData {
  date: string
  strategies: StrategyResult[]
  optimal_threshold: number
}

// ─── DCA Rhythm Signal (定投节奏信号灯) ─────────────────────────────────────
export type DcaRhythm = 'accelerate' | 'normal' | 'hold' | 'pause' | 'pause_reduce'

export interface DcaSignalData {
  rhythm: DcaRhythm
  label: string                // e.g. "正常定投", "加速定投"
  fragility: number            // 0-100 脆弱度指数
  confidence: number           // 1-5 信心刻度
  consensus: {
    bullish: number            // 因子看多数
    neutral: number            // 因子中性数
    bearish: number            // 因子看空数
    total: number              // 总因子数 (12)
    alignment: number          // 0-1 一致性
  }
  reason: string               // 一句话解释
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
