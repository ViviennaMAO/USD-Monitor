'use client'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { AlertBadge } from '@/components/ui/Badge'
import type { VolAlertData, FactorDirection } from '@/types'

// ─── Direction helpers ──────────────────────────────────────────────────────
function directionIcon(d: FactorDirection) {
  if (d === 'push') return '🔴'
  if (d === 'latent_push') return '🟡'
  if (d === 'suppress') return '🟢'
  return '⚪'
}

function directionLabel(d: FactorDirection) {
  if (d === 'push') return '推升'
  if (d === 'latent_push') return '潜在推升'
  if (d === 'suppress') return '压制'
  return '中性'
}

function directionColor(d: FactorDirection) {
  if (d === 'push') return 'border-red-500/40 bg-red-500/5'
  if (d === 'latent_push') return 'border-amber-500/40 bg-amber-500/5'
  if (d === 'suppress') return 'border-emerald-500/40 bg-emerald-500/5'
  return 'border-slate-700 bg-slate-800/30'
}

function directionTextColor(d: FactorDirection) {
  if (d === 'push') return 'text-red-400'
  if (d === 'latent_push') return 'text-amber-400'
  if (d === 'suppress') return 'text-emerald-400'
  return 'text-slate-400'
}

// ─── Mini Factor Box ────────────────────────────────────────────────────────
interface FactorBoxProps {
  id: string
  title: string
  mainValue: string
  subValue?: string
  detail?: string
  direction: FactorDirection
  score?: number
  compact?: boolean
}

function FactorBox({ id, title, mainValue, subValue, detail, direction, score, compact }: FactorBoxProps) {
  return (
    <div className={`rounded-lg border p-3 ${directionColor(direction)}`}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div>
          <span className="text-[10px] text-slate-500 font-mono">{id}</span>
          <div className="text-xs text-slate-300 font-medium leading-tight">{title}</div>
        </div>
        <span className={`text-[10px] font-semibold flex-shrink-0 ${directionTextColor(direction)}`}>
          {directionIcon(direction)} {directionLabel(direction)}
        </span>
      </div>
      <div className={`font-mono font-bold ${compact ? 'text-base' : 'text-xl'} text-white`}>{mainValue}</div>
      {subValue && <div className="text-xs text-slate-400 mt-0.5">{subValue}</div>}
      {detail && <div className="text-[10px] text-slate-500 mt-1">{detail}</div>}
      {score !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>强度</span><span>{score}/100</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${direction === 'suppress' ? 'bg-emerald-500' : direction === 'push' ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Push/Suppress Trend Chart ──────────────────────────────────────────────
interface TrendEntry {
  date: string
  push: number
  suppress: number
  score: number
}

interface PushSuppressTrendProps {
  history: TrendEntry[]
  push_count: number
  suppress_count: number
  net_direction: 'expansion' | 'compression'
}

function PushSuppressTrend({ history, push_count, suppress_count, net_direction }: PushSuppressTrendProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-red-500/70" />
            推升因子 (今日: {push_count})
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/70" />
            压制因子 (今日: {suppress_count})
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-px bg-amber-400" />
            σ评分
          </span>
        </div>
        <span className={`text-xs font-semibold ${net_direction === 'expansion' ? 'text-red-400' : 'text-emerald-400'}`}>
          {net_direction === 'expansion' ? '⬆ 扩张' : '⬇ 收缩'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={72}>
        <ComposedChart data={history} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            yAxisId="count"
            domain={[0, 8]}
            tick={{ fontSize: 9, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="score"
            orientation="right"
            domain={[30, 100]}
            tick={false}
            axisLine={false}
            width={0}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
            labelStyle={{ color: '#64748b', marginBottom: 2 }}
            formatter={(val, name) => [val, name === 'push' ? '推升' : name === 'suppress' ? '压制' : 'σ评分']}
          />
          {/* Suppress area (bottom) */}
          <Area
            yAxisId="count"
            type="monotone"
            dataKey="suppress"
            fill="#10b981"
            fillOpacity={0.15}
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            name="suppress"
            stackId="factors"
          />
          {/* Push area (stacked on top) */}
          <Area
            yAxisId="count"
            type="monotone"
            dataKey="push"
            fill="#ef4444"
            fillOpacity={0.2}
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            name="push"
            stackId="factors"
          />
          {/* Score line */}
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="score"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            name="score"
            strokeDasharray="4 2"
          />
          <ReferenceLine yAxisId="count" y={4} stroke="#475569" strokeDasharray="3 3" strokeOpacity={0.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main VolAlertCard ──────────────────────────────────────────────────────
interface VolAlertCardProps {
  data: VolAlertData
  history: TrendEntry[]
}

export function VolAlertCard({ data: d, history }: VolAlertCardProps) {
  const scoreColor = d.score >= 65 ? 'text-orange-400' : d.score >= 40 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      {/* Card Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-800/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-amber-400 font-mono font-bold text-lg">σ_alert</span>
              <span className="text-sm text-slate-300">USD Volatility Alert</span>
              <span className="text-xs text-slate-500">美元波动率预警因子</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AlertBadge level={d.alert_level} />
            <div className="text-right">
              <div className={`text-2xl font-mono font-bold ${scoreColor}`}>{d.score}</div>
              <div className="text-xs text-slate-500">/100</div>
            </div>
          </div>
        </div>

        {/* Push vs Suppress Trend Chart */}
        <PushSuppressTrend
          history={history}
          push_count={d.push_count}
          suppress_count={d.suppress_count}
          net_direction={d.net_direction}
        />
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* ── Layer 1: Direct Factors ────────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FactorBox
              id="F1"
              title="3M 25D Risk Reversal"
              mainValue={`${d.f1_rr.value > 0 ? '+' : ''}${d.f1_rr.value.toFixed(2)}`}
              subValue={`2Y分位: ${d.f1_rr.percentile.toFixed(0)}%`}
              detail={d.f1_rr.direction === 'push' ? '多头拥挤 — 市场为USD上行支付溢价' : '中性'}
              direction={d.f1_rr.direction}
              score={d.f1_rr.score}
            />
            <FactorBox
              id="F2"
              title="汇率-利差残差"
              mainValue={`${d.f2_residual.value > 0 ? '+' : ''}${d.f2_residual.value.toFixed(1)} pts`}
              subValue={`残差方向: ${d.f2_residual.value > 0.5 ? '偏贵' : d.f2_residual.value < -0.5 ? '偏便宜' : '中性'}`}
              detail={`均值回归压力: ${Math.abs(d.f2_residual.zscore) > 1.5 ? '高' : Math.abs(d.f2_residual.zscore) > 0.8 ? '中' : '低'}`}
              direction={d.f2_residual.direction}
              score={d.f2_residual.score}
            />
          </div>
        </div>

        {/* ── Layer 2: Cross-Asset Factors ───────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <FactorBox
              id="F3"
              title="OVX 原油波动率"
              mainValue={d.f3_ovx.value.toFixed(2)}
              subValue={`52W: ${d.f3_ovx.percentile.toFixed(0)}%`}
              direction={d.f3_ovx.direction}
              score={d.f3_ovx.score}
              compact
            />
            <FactorBox
              id="F4"
              title="VVIX/VIX 比值"
              mainValue={d.f4_vvix_vix.value.toFixed(2)}
              subValue="正常范围 3.5~5.0"
              direction={d.f4_vvix_vix.direction}
              score={d.f4_vvix_vix.score}
              compact
            />
            <FactorBox
              id="F5"
              title="VIX vs VXN 分化"
              mainValue={`VIX ${d.f5_vxn_vix.vix.toFixed(1)}`}
              subValue={`VXN ${d.f5_vxn_vix.vxn.toFixed(1)}`}
              detail={`Gap: +${d.f5_vxn_vix.gap.toFixed(2)}${d.f5_vxn_vix.trigger ? ' ⚡已触发' : ''}`}
              direction={d.f5_vxn_vix.direction}
              score={d.f5_vxn_vix.score}
              compact
            />
            <FactorBox
              id="F6"
              title="VXHYG 高收益债"
              mainValue={d.f6_vxhyg.value.toFixed(2)}
              subValue={`${d.f6_vxhyg.change_pct > 0 ? '+' : ''}${d.f6_vxhyg.change_pct.toFixed(1)}%`}
              direction={d.f6_vxhyg.direction}
              score={d.f6_vxhyg.score}
              compact
            />
            <FactorBox
              id="F7"
              title="GVZ 黄金波动率"
              mainValue={d.f7_gvz.value.toFixed(2)}
              subValue={`${d.f7_gvz.change_pct > 0 ? '+' : ''}${d.f7_gvz.change_pct.toFixed(1)}%`}
              direction={d.f7_gvz.direction}
              score={d.f7_gvz.score}
              compact
            />
          </div>
        </div>

        {/* ── Layer 3: Composite Factors ────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <FactorBox
              id="F8"
              title="RR×残差共振"
              mainValue={`${d.f8_rr_residual.composite_z > 0 ? '+' : ''}${d.f8_rr_residual.composite_z.toFixed(2)}σ`}
              subValue={d.f8_rr_residual.is_resonance ? '双因子共振' : '单因子'}
              direction={d.f8_rr_residual.direction}
              score={d.f8_rr_residual.score}
              compact
            />
            <FactorBox
              id="F9"
              title="OVX×TIPS 滞胀压力"
              mainValue={`OVX ${d.f9_stagflation.ovx.toFixed(0)}`}
              subValue={`TIPS ${d.f9_stagflation.tips.toFixed(2)}%`}
              detail="滞胀象限"
              direction={d.f9_stagflation.direction}
              score={d.f9_stagflation.score}
              compact
            />
            <FactorBox
              id="F10"
              title="VVIX/VIX×RR 尾部"
              mainValue={d.f10_tail_directional.value.toFixed(2)}
              subValue={d.f10_tail_directional.value > 4 ? '高度警戒 >4.0' : '接近警戒线'}
              direction={d.f10_tail_directional.direction}
              score={d.f10_tail_directional.score}
              compact
            />
            <FactorBox
              id="F11"
              title="VXN-VIX 科技溢出"
              mainValue={`+${d.f11_tech_spillover.gap.toFixed(2)}`}
              subValue={d.f11_tech_spillover.trigger ? '⚡传导已触发' : '等待传导'}
              direction={d.f11_tech_spillover.direction}
              score={d.f11_tech_spillover.score}
              compact
            />
            <FactorBox
              id="F12"
              title="VXHYG×CDS 信用修复"
              mainValue={`${d.f12_credit_repair.vxhyg_chg.toFixed(1)}%`}
              subValue={`CDS ${d.f12_credit_repair.cds.toFixed(1)}bps`}
              direction={d.f12_credit_repair.direction}
              score={d.f12_credit_repair.score}
              compact
            />
          </div>
        </div>

        {/* ── Summary ───────────────────────────────────────────────────── */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">⚡</span>
            <p className="text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-amber-400">综合判断：</span>{d.summary}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
