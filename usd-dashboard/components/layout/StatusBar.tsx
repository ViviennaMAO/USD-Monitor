'use client'

interface StatusBarProps {
  warnings?: number
  messages?: number
  lastUpdate?: string   // e.g. "17:02"
  modelOnline?: boolean
  wsConnected?: boolean
}

export function StatusBar({
  warnings = 1,
  messages = 5,
  lastUpdate = '--:--',
  modelOnline = true,
  wsConnected = true,
}: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1117]/95 border-t border-slate-800 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between text-[11px] font-mono">

        {/* Left: system status */}
        <div className="flex items-center gap-4 text-slate-500">
          {/* System health */}
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            系统正常
          </span>

          <span className="text-slate-700">|</span>

          {/* Model engine */}
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${modelOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            XGBoost 推理引擎 · {modelOnline ? '在线' : '离线'}
          </span>

          <span className="text-slate-700">|</span>

          {/* Data source */}
          <span className="text-slate-500">
            FRED+Yahoo · {lastUpdate}
          </span>

          <span className="text-slate-700">|</span>

          {/* WebSocket */}
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            VSTAR WebSocket · {wsConnected ? '连接中' : '断开'}
          </span>
        </div>

        {/* Right: notifications */}
        <div className="flex items-center gap-3">
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L15 14H1L8 1z" />
                <path d="M8 6v4M8 11v1" stroke="#0d1117" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              {warnings} 警告
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a5.5 5.5 0 100 11A5.5 5.5 0 008 1zM2 8a6 6 0 1110.472 4.014l1.257 1.257-.707.707-1.257-1.257A6 6 0 012 8z" />
            </svg>
            {messages} 条消息
          </span>
        </div>

      </div>
    </div>
  )
}
