'use client'
import { useEffect, useRef } from 'react'
import type { Signal } from '@/types'

interface ScoreGaugeProps {
  score: number
  signal: Signal
}

export function ScoreGauge({ score, signal }: ScoreGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 240
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = 90
    const lineWidth = 18
    const startAngle = (225 * Math.PI) / 180  // 225° start (bottom-left)
    const totalAngle = (270 * Math.PI) / 180  // 270° sweep

    ctx.clearRect(0, 0, size, size)

    // ── Background track ─────────────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, startAngle + totalAngle)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // ── Colored segments (red 0-35, amber 35-65, green 65-100) ──────────
    const segments = [
      { from: 0, to: 35, color: '#ef4444' },
      { from: 35, to: 65, color: '#f59e0b' },
      { from: 65, to: 100, color: '#10b981' },
    ]

    for (const seg of segments) {
      const a1 = startAngle + (seg.from / 100) * totalAngle
      const a2 = startAngle + (seg.to / 100) * totalAngle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, a1, a2)
      ctx.strokeStyle = seg.color + '40'  // 25% opacity
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'butt'
      ctx.stroke()
    }

    // ── Needle arc (score fill) ──────────────────────────────────────────
    const scoreAngle = startAngle + (score / 100) * totalAngle
    const gradient = ctx.createLinearGradient(
      cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius,
      cx + Math.cos(scoreAngle) * radius, cy + Math.sin(scoreAngle) * radius
    )
    gradient.addColorStop(0, '#ef4444')
    gradient.addColorStop(0.35, '#f59e0b')
    gradient.addColorStop(1, score >= 65 ? '#10b981' : score >= 35 ? '#f59e0b' : '#ef4444')

    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, scoreAngle)
    ctx.strokeStyle = gradient
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    // ── Needle dot ───────────────────────────────────────────────────────
    const needleX = cx + Math.cos(scoreAngle) * radius
    const needleY = cy + Math.sin(scoreAngle) * radius
    ctx.beginPath()
    ctx.arc(needleX, needleY, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(needleX, needleY, 3, 0, Math.PI * 2)
    ctx.fillStyle = score >= 65 ? '#10b981' : score >= 35 ? '#f59e0b' : '#ef4444'
    ctx.fill()
  }, [score])

  const signalConfig = {
    BULLISH: { label: '看多', color: 'text-emerald-400' },
    NEUTRAL: { label: '中性', color: 'text-amber-400' },
    BEARISH: { label: '看空', color: 'text-red-400' },
  }

  const scoreColor = score >= 65 ? 'text-emerald-400' : score >= 35 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <canvas ref={canvasRef} />
        {/* Center text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-4xl font-mono font-bold ${scoreColor}`}>{score}</span>
          <span className="text-xs text-slate-400 mt-0.5">综合评分</span>
          <span className={`text-sm font-semibold mt-1 ${signalConfig[signal].color}`}>
            {signalConfig[signal].label}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="text-slate-400">&lt;35 看空</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <span className="text-slate-400">35-65 中性</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-slate-400">&gt;65 看多</span>
        </span>
      </div>
    </div>
  )
}
