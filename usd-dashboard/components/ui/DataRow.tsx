'use client'

interface DataRowProps {
  label: string
  value: string
  highlight?: boolean
  valueColor?: string
}

export function DataRow({ label, value, highlight, valueColor }: DataRowProps) {
  return (
    <div className={`flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0 ${highlight ? 'bg-slate-800/30 -mx-3 px-3 rounded' : ''}`}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-mono ${valueColor ?? 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

interface DataGridProps {
  rows: { label: string; value: string }[]
}

export function DataGrid({ rows }: DataGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4">
      {rows.map((r) => (
        <DataRow key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  )
}
