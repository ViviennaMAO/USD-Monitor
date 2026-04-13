'use client'

export type AnalyticsTab = 'factors' | 'shap' | 'ic' | 'regime' | 'correlation' | 'nav' | 'health'

const TABS: { id: AnalyticsTab; label: string; sub: string }[] = [
  { id: 'factors',     label: '波动率看板',  sub: 'σ_alert' },
  { id: 'shap',        label: 'SHAP 归因',  sub: '瀑布图' },
  { id: 'ic',          label: 'IC 追踪',    sub: '信息系数' },
  { id: 'regime',      label: 'Regime',     sub: '热力图' },
  { id: 'correlation', label: '相关性',     sub: '矩阵' },
  { id: 'nav',         label: '净值曲线',   sub: '账户表现' },
  { id: 'health',      label: '模型健康',   sub: '诊断' },
]

interface AnalyticsTabsProps {
  active: AnalyticsTab
  onChange: (tab: AnalyticsTab) => void
}

export function AnalyticsTabs({ active, onChange }: AnalyticsTabsProps) {
  return (
    <nav className="flex items-center gap-1 border-b border-slate-800 px-1 overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0
            ${active === tab.id
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-500 hover:text-slate-300'}
          `}
        >
          {tab.label}
          <span className={`text-[10px] font-mono ${active === tab.id ? 'text-slate-400' : 'text-slate-600'}`}>
            · {tab.sub}
          </span>
        </button>
      ))}
    </nav>
  )
}
