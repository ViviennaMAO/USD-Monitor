'use client'

interface FooterProps {
  dataDate: string
  dataTime: string
}

export function Footer({ dataDate, dataTime }: FooterProps) {
  return (
    <footer className="border-t border-slate-800 mt-12">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>USDMonitor v1.0</span>
            <span>数据日期: {dataDate} {dataTime}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>数据源: FRED · Yahoo Finance · CFTC</span>
            <span>模型: 因子打分模型 (Score-based)</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
