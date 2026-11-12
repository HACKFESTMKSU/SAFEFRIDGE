import type { ReactNode } from 'react'

type Tone = 'ok' | 'warn' | 'crit' | undefined

export function MetricTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: Tone
}) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <div className="label">
        {icon}
        {label}
      </div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  )
}
