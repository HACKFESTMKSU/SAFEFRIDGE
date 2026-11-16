/**
 * Where a reading sits relative to its safe range. The track extends half a
 * band-width past each side so out-of-range readings stay visible.
 */
export function BandMeter({
  value,
  min,
  max,
  tone,
  unit = '°C',
  decimals = 1,
}: {
  value: number | null
  min: number
  max: number
  tone?: 'ok' | 'warn' | 'crit'
  unit?: string
  decimals?: number
}) {
  const span = Math.max(0.0001, max - min)
  const lo = min - span * 0.5
  const hi = max + span * 0.5
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  const text = value != null ? `${value.toFixed(decimals)}${unit}` : 'No reading'

  return (
    <div
      className={`meter ${tone ?? ''}`}
      role="img"
      aria-label={`${text}; safe range ${min} to ${max}${unit}`}
    >
      <div className="meter-track">
        <div className="meter-safe" style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }} />
        {value != null ? <div className="meter-mark" style={{ left: `${pct(value)}%` }} /> : null}
      </div>
      <span className="meter-val">{value != null ? `${value.toFixed(decimals)}${unit}` : '—'}</span>
    </div>
  )
}
