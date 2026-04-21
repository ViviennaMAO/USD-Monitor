'use client'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ScoreGauge } from '@/components/gauge/ScoreGauge'
import { DxyStatsGrid } from '@/components/cards/DxyStatsGrid'
import { ScoreHistory } from '@/components/charts/ScoreHistory'
import { RfCard, PiRiskCard, CyCard } from '@/components/cards/ComponentCard'
// VolAlertCard moved to /analytics (因子面板 tab)
import { HedgeCard } from '@/components/cards/HedgeCard'
import { YieldDecompCard } from '@/components/charts/YieldDecomp'
import { FxPairCard } from '@/components/cards/FxPairCard'
import { CftcBars } from '@/components/charts/CftcBars'
import { SignalTimeline } from '@/components/cards/SignalTimeline'
import { DcaSignalLight } from '@/components/cards/DcaSignalLight'
import { FactorConsensusBar } from '@/components/cards/FactorConsensusBar'
import { MultiAssetSignals } from '@/components/cards/MultiAssetSignals'
import {
  useScore, useComponents,
  useDxy, useFxPairs, useYieldDecomp,
  useHedge, useSignalHistory, useDcaSignal, useMultiAssetSignals,
} from '@/lib/useUsdData'
import { mockData } from '@/data/mockData'

// ── Live indicator ─────────────────────────────────────────────────────────
function LiveIndicator({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
      <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
      {isLoading ? '更新中...' : '实时数据'}
    </div>
  )
}

export default function Dashboard() {
  // SWR hooks — auto-refresh every 5 min, fall back to mock if pipeline not yet run
  const { data: score, isLoading: scoreLoading }       = useScore()
  const { rf, pi_risk, cy, isLoading: compLoading }    = useComponents()
  // volAlert moved to analytics page
  const { data: dxy, isLoading: dxyLoading }            = useDxy()
  const { data: dcaSignal }                             = useDcaSignal()
  const { data: multiAsset }                            = useMultiAssetSignals()
  const { data: fx }                                    = useFxPairs()
  const { data: yieldDecomp }                           = useYieldDecomp()
  const { data: hedge }                                 = useHedge()
  const { data: signalHistory }                         = useSignalHistory()

  const isLoading = scoreLoading || compLoading || dxyLoading

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Header score={score} dxy={dxy} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

        {/* Live data status */}
        <div className="flex justify-end">
          <LiveIndicator isLoading={isLoading} />
        </div>

        {/* ═══ Row 0: DCA Signal Light + Factor Consensus ═══════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5">
            <DcaSignalLight data={dcaSignal} />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-center">
            <FactorConsensusBar data={dcaSignal.consensus} />
          </div>
        </section>

        {/* ═══ Row 0.5: Multi-Asset Signal Tower (通胀→四资产) ═══════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">通胀 → 四资产信号塔</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <MultiAssetSignals data={multiAsset} />
        </section>

        {/* ═══ Row 1: Gauge + Stats + Score History ══════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Gauge */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center hover:border-slate-700 transition-colors">
            <div className="text-xs text-slate-500 font-mono mb-3 text-center">γ (USD Score) — 综合评分</div>
            <ScoreGauge score={score.gamma} signal={score.signal} />
            {/* Formula breakdown */}
            <div className="mt-4 w-full space-y-1.5">
              {[
                { label: 'r_f (35%)',      score: score.rf_score,       color: 'bg-emerald-500' },
                { label: 'π_risk (25%)',   score: score.pi_risk_score,  color: 'bg-amber-500' },
                { label: 'cy (25%)',       score: score.cy_score,       color: 'bg-orange-500' },
                { label: 'σ_alert (15%)', score: score.sigma_score,    color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-20 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color} opacity-70`} style={{ width: `${item.score}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{item.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats + History */}
          <div className="lg:col-span-9 space-y-4">
            <DxyStatsGrid score={score} dxy={dxy} />
            <ScoreHistory dxy={dxy} />
          </div>
        </section>

        {/* ═══ Row 2: Three Component Cards ══════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">核心估值因子</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RfCard data={rf} />
            <PiRiskCard data={pi_risk} />
            <CyCard data={cy} />
          </div>
        </section>

        {/* ═══ Row 3: Hedge + Yield Decomp ════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">对冲传导 · 收益率分解</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HedgeCard data={hedge} />
            <YieldDecompCard data={yieldDecomp} hedge={hedge} />
          </div>
        </section>

        {/* ═══ Row 5: FX Pairs + CFTC ═════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">汇率对 · CFTC 持仓</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FxPairCard data={fx} />
            <CftcBars data={mockData.cftc} />
          </div>
        </section>

        {/* ═══ Row 6: Signal History Timeline ════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 tracking-widest uppercase">信号历史</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <SignalTimeline history={signalHistory.slice(0, 7).reverse()} />
        </section>
      </main>

      <Footer dataDate={score.data_date} dataTime={score.data_time} />
    </div>
  )
}
