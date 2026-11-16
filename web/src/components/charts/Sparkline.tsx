import type { CSSProperties } from 'react'
import { useMeasure } from '../../hooks/useMeasure'
import type { ChartPoint } from './LiveChart'

/**
 * A quiet trend line for stat tiles and small multiples. One series,
 * no axes; the number beside it carries the value.
 */
export function Sparkline({
  points,
  height = 30,
  color,
  domain,
  label,
}: {
  points: ChartPoint[]
  height?: number
  color?: string
  domain?: [number, number]
  label?: string
}) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const pad = 3
  const W = Math.max(width, 40)
  const x0 = domain ? domain[0] : (points[0]?.t ?? 0)
  const x1 = domain ? domain[1] : (points[points.length - 1]?.t ?? 1)
  const pts = points.filter((p) => p.t >= x0 && p.t <= x1)

  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const p of pts) {
    lo = Math.min(lo, p.v)
    hi = Math.max(hi, p.v)
  }
  if (hi - lo < 1e-6) {
    lo -= 1
    hi += 1
  }
  // Thin long series down to roughly one point per 2px.
  const stride = Math.max(1, Math.floor(pts.length / (W / 2)))
  const shown = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1)

  const sx = (t: number) => pad + ((t - x0) / Math.max(1, x1 - x0)) * (W - pad * 2)
  const sy = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2)
  const d = shown.length > 1 ? `M${shown.map((p) => `${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join('L')}` : ''
  const last = shown[shown.length - 1]

  return (
    <div
      ref={ref}
      style={{ width: '100%', height, ...(color ? { '--series': color } : {}) } as CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {width > 0 && d ? (
        <svg className="spark" width={W} height={height}>
          <path className="spark-line" d={d} />
          {last ? <circle cx={sx(last.t)} cy={sy(last.v)} r={2.5} /> : null}
        </svg>
      ) : null}
    </div>
  )
}
