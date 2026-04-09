'use client'
import type { ConflictBacktestData } from '@/types'

interface Props {
  data: ConflictBacktestData
}

export function ConflictBacktestPanel({ data }: Props) {
  if (!data.bucket_analysis?.length) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-500">冲突回测数据未就绪 (运行 pipeline --p2)</p>
      </div>
    )
  }

  const opt = data.optimal_threshold

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-200">冲突分数回测</h3>
        <span className="text-[10px] text-slate-500">
          {data.test_period.start} ~ {data.test_period.end} · n={data.test_period.n_observations}
        </span>
      </div>
      <p className="text-[10px] text-slate-500 mb-4">
        Soros假设: 冲突分数&gt;0.6是否为regime转换的领先指标?
      </p>

      {/* Bucket analysis */}
      <div className="mb-4">
        <div className="text-[10px] text-slate-400 mb-2">冲突分桶 vs 实际回报</div>
        <div className="space-y-1.5">
          {data.bucket_analysis.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-28 text-[10px] text-slate-400 truncate">{b.label}</div>
              <div className="flex-1 h-5 bg-slate-800 rounded relative overflow-hidden">
                {b.avg_return != null && (
                  <div
                    className={`absolute inset-y-0 rounded ${b.avg_return >= 0 ? 'bg-emerald-500/40 left-1/2' : 'bg-red-500/40 right-1/2'}`}
                    style={{
                      width: `${Math.min(Math.abs(b.avg_return) * 20, 50)}%`,
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <span className="text-[9px] text-slate-500">n={b.count}</span>
                  <span className={`text-[9px] font-mono ${
                    b.avg_return == null ? 'text-slate-600' :
                    b.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {b.avg_return != null ? `${b.avg_return > 0 ? '+' : ''}${b.avg_return.toFixed(3)}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="w-12 text-[9px] text-slate-500 text-right">
                {b.win_rate != null ? `${(b.win_rate * 100).toFixed(0)}%` : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Soros hypothesis */}
      {data.soros_hypothesis && (
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
          <div className="text-[10px] text-amber-400 mb-1">Soros 假设验证</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] text-slate-500">高冲突频率</div>
              <div className="font-mono text-xs text-white">{data.soros_hypothesis.high_conflict_pct}%</div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500">高冲突波动率</div>
              <div className="font-mono text-xs text-red-400">
                {data.soros_hypothesis.high_conflict_volatility?.toFixed(3) ?? 'N/A'}%
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500">低冲突波动率</div>
              <div className="font-mono text-xs text-emerald-400">
                {data.soros_hypothesis.low_conflict_volatility?.toFixed(3) ?? 'N/A'}%
              </div>
            </div>
          </div>
          {data.soros_hypothesis.high_conflict_volatility != null &&
           data.soros_hypothesis.low_conflict_volatility != null && (
            <div className="text-[9px] text-slate-500 mt-2 text-center">
              {data.soros_hypothesis.high_conflict_volatility > data.soros_hypothesis.low_conflict_volatility
                ? '✓ 高冲突时波动率更大 — 支持regime转换假设'
                : '✗ 高冲突时波动率未显著增大'}
            </div>
          )}
        </div>
      )}

      {/* Optimal threshold */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
        <div className="text-[10px] text-purple-400 mb-1">最优冲突阈值 (Grid Search)</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[9px] text-slate-500">阈值</div>
            <div className="font-mono text-sm font-bold text-purple-300">{opt.threshold.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500">Sharpe</div>
            <div className="font-mono text-xs text-white">{opt.sharpe.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500">总回报</div>
            <div className={`font-mono text-xs ${opt.total_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {opt.total_return > 0 ? '+' : ''}{opt.total_return.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500">MaxDD</div>
            <div className="font-mono text-xs text-red-400">{(opt.max_drawdown * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
