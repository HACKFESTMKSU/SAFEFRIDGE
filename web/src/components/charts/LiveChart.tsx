import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { prefersReducedMotion, useInView } from '../../hooks/motion'
import { useMeasure } from '../../hooks/useMeasure'

export type MarkerTone = 'ok' | 'warn' | 'crit' | 'info'

export interface ChartPoint {
  t: number
  v: number
}

export interface ChartMarker {
  t: number
  label: string
  tone: MarkerTone
}

export interface ChartThreshold {
  value: number
  tone: 'warn' | 'crit'
  label: string
}

interface LiveChartProps {
  points: ChartPoint[]
  /** Series name, used in the tooltip and accessible summary. */
  label: string
  unit: string
  decimals?: number
  height?: number
  /** Fixed x-domain [start, end] in epoch ms. Defaults to the data extent. */
  domain?: [number, number]
  band?: { min: number; max: number; label?: string }
  thresholds?: ChartThreshold[]
  markers?: ChartMarker[]
  /** Pulse the latest point. */
  live?: boolean
  /** Hide axes and labels (hero cards, small multiples). */
  compact?: boolean
  /** Draw the line in when it first scrolls into view. */
  animate?: boolean
  showTable?: boolean
  emptyText?: ReactNode
  color?: string
  /** Break the line when readings are further apart than this (device offline). */
  gapMs?: number
  timeFormat?: (ms: number) => string
  /** How long the line glides to its next position; match the update rate. */
  transitionMs?: number
}

const MIN = 60_000
const HOUR = 60 * MIN
const TIME_STEPS = [
  MIN,
  2 * MIN,
  5 * MIN,
  10 * MIN,
  15 * MIN,
  30 * MIN,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  24 * HOUR,
]
const BUCKETS = [5_000, 10_000, 15_000, 30_000, MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN, HOUR]

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

function hhmm(ms: number) {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function hhmmss(ms: number) {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

const r1 = (n: number) => Math.round(n * 10) / 10

function niceStep(raw: number) {
  const exp = Math.floor(Math.log10(raw))
  const f = raw / 10 ** exp
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * 10 ** exp
}

function yTicks(lo: number, hi: number, count: number) {
  let a = lo
  let b = hi
  if (b - a < 1e-6) {
    a -= 1
    b += 1
  }
  const step = niceStep((b - a) / Math.max(1, count - 1))
  const min = Math.floor(a / step) * step
  const max = Math.ceil(b / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { min, max, ticks, step }
}

function timeTicks(x0: number, x1: number, maxTicks: number) {
  const span = x1 - x0
  const step = TIME_STEPS.find((s) => span / s <= maxTicks) ?? 24 * HOUR
  const tz = -new Date(x0).getTimezoneOffset() * MIN
  const out: number[] = []
  for (let t = Math.ceil((x0 + tz) / step) * step - tz; t <= x1; t += step) out.push(t)
  return out
}

function median(values: number[]) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Average readings into fixed time buckets so long windows stay light. */
function bucketize(points: ChartPoint[], bucketMs: number) {
  const out: ChartPoint[] = []
  let key = Number.NaN
  let st = 0
  let sv = 0
  let n = 0
  for (const p of points) {
    const k = Math.floor(p.t / bucketMs)
    if (k !== key && n) {
      out.push({ t: st / n, v: sv / n })
      st = 0
      sv = 0
      n = 0
    }
    key = k
    st += p.t
    sv += p.v
    n += 1
  }
  if (n) out.push({ t: st / n, v: sv / n })
  return out
}

function nearestIndex(points: ChartPoint[], t: number) {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t < t) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) < Math.abs(points[lo].t - t)) return lo - 1
  return lo
}

export function LiveChart({
  points,
  label,
  unit,
  decimals = 1,
  height = 260,
  domain,
  band,
  thresholds = [],
  markers = [],
  live = false,
  compact = false,
  animate = true,
  showTable = false,
  emptyText = 'No readings in this window yet.',
  color,
  gapMs,
  timeFormat = hhmm,
  transitionMs = 1000,
}: LiveChartProps) {
  const [ref, measured] = useMeasure<HTMLDivElement>()
  const inView = useInView(ref)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [drawn, setDrawn] = useState(() => !animate || prefersReducedMotion())
  const [hover, setHover] = useState<number | null>(null)
  // Hidden until it scrolls into view, then the line draws itself in once.
  const phase: 'pending' | 'drawing' | 'done' = drawn ? 'done' : inView && measured > 0 ? 'drawing' : 'pending'

  // Browsers pause CSS animations in background tabs, so `animationend` may
  // never fire. Always reveal the finished line shortly after drawing starts.
  useEffect(() => {
    if (phase !== 'drawing') return
    const id = window.setTimeout(() => setDrawn(true), 2000)
    return () => window.clearTimeout(id)
  }, [phase])

  const fmt = (v: number) => {
    const s = v.toFixed(decimals)
    return s === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : s
  }

  const W = Math.max(measured || 600, 160)
  const hasMarkers = !compact && markers.length > 0
  const m = compact
    ? { t: 8, r: 10, b: 8, l: 8 }
    : { t: hasMarkers ? 58 : 14, r: 64, b: 26, l: 42 }
  const plotW = Math.max(40, W - m.l - m.r)
  const plotH = Math.max(40, height - m.t - m.b)

  const firstT = points[0]?.t ?? domain?.[0] ?? 0
  const lastT = points[points.length - 1]?.t ?? domain?.[1] ?? HOUR
  const x0 = domain ? domain[0] : firstT
  const x1 = domain ? Math.max(domain[1], domain[0] + 1) : Math.max(lastT, firstT + MIN)

  // Points in view, plus one reading before the window so the line enters cleanly.
  let startIdx = 0
  while (startIdx < points.length && points[startIdx].t < x0) startIdx += 1
  if (startIdx > 0) startIdx -= 1
  const visible = points.slice(startIdx).filter((p) => p.t <= x1)
  const inWindow = visible.filter((p) => p.t >= x0)

  const dts: number[] = []
  for (let i = 1; i < visible.length; i += 1) dts.push(visible[i].t - visible[i - 1].t)
  const typicalDt = median(dts) || MIN
  const span = x1 - x0
  const bucketMs =
    visible.length > plotW / 2 ? (BUCKETS.find((b) => b >= span / (plotW / 2)) ?? HOUR) : 0
  const series = bucketMs ? bucketize(visible, bucketMs) : visible
  const gap = Math.max(gapMs ?? Math.max(typicalDt * 6, 2 * MIN), bucketMs * 2.5)

  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const p of inWindow.length ? inWindow : visible) {
    lo = Math.min(lo, p.v)
    hi = Math.max(hi, p.v)
  }
  if (!Number.isFinite(lo)) {
    lo = band?.min ?? 0
    hi = band?.max ?? 1
  }
  if (band) {
    lo = Math.min(lo, band.min)
    hi = Math.max(hi, band.max)
  }
  for (const th of thresholds) {
    lo = Math.min(lo, th.value)
    hi = Math.max(hi, th.value)
  }
  const padY = (hi - lo) * 0.08 || 0.5
  const ys = yTicks(lo - padY, hi + padY, compact ? 3 : Math.max(3, Math.min(6, Math.floor(plotH / 42))))

  const sx = (t: number) => m.l + ((t - x0) / (x1 - x0)) * plotW
  const sy = (v: number) => m.t + (1 - (v - ys.min) / (ys.max - ys.min)) * plotH
  const base = m.t + plotH

  // Build the line and area paths, breaking at gaps (device offline).
  let linePath = ''
  let areaPath = ''
  let seg: [number, number][] = []
  const flush = () => {
    if (seg.length > 1) {
      linePath += `M${seg.map(([x, y]) => `${x},${y}`).join('L')}`
      areaPath += `M${seg[0][0]},${base}L${seg.map(([x, y]) => `${x},${y}`).join('L')}L${seg[seg.length - 1][0]},${base}Z`
    }
    seg = []
  }
  series.forEach((p, i) => {
    if (i > 0 && p.t - series[i - 1].t > gap) flush()
    seg.push([r1(sx(p.t)), r1(sy(p.v))])
  })
  flush()

  const last = inWindow.length ? series[series.length - 1] : null
  const lastRaw = inWindow[inWindow.length - 1] ?? null
  const endX = last ? sx(last.t) : 0
  const endY = last ? sy(last.v) : 0
  const pillText = lastRaw ? `${fmt(lastRaw.v)}${unit}` : ''
  const pillW = pillText.length * 6.7 + 14
  const pillLeft = endX + 10 + pillW > W - 2 ? endX - 10 - pillW : endX + 10

  // Marker labels go into up to two lanes above the plot. Each label tries
  // centred on its point, then just right, then just left; never overlapping.
  const laneEnds = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  const placedMarkers = hasMarkers
    ? markers
        .filter((mk) => mk.t >= x0 && mk.t <= x1)
        .sort((a, b) => a.t - b.t)
        .map((mk) => {
          const x = sx(mk.t)
          const idx = series.length ? nearestIndex(series, mk.t) : -1
          const y = idx >= 0 ? sy(series[idx].v) : base
          const w = mk.label.length * 6.1 + 16
          const clampLeft = (l: number) => Math.min(Math.max(l, m.l - 30), W - w - 2)
          const candidates = [x - w / 2, x - 8, x - w + 8].map(clampLeft)
          let lane = -1
          let left = candidates[0]
          for (let l = 0; l < laneEnds.length && lane < 0; l += 1) {
            const fit = candidates.find((c) => c > laneEnds[l] + 6)
            if (fit != null) {
              lane = l
              left = fit
            }
          }
          if (lane >= 0) laneEnds[lane] = left + w
          return { ...mk, x, y, w, left, lane }
        })
    : []

  const yLabelTicks = compact ? [] : ys.ticks
  const xTickTimes = compact ? [] : timeTicks(x0, x1, Math.max(2, Math.floor(plotW / 86)))

  const hovered = hover != null && series[hover] ? series[hover] : null
  const hoveredMarker =
    hovered != null
      ? markers.find((mk) => Math.abs(mk.t - hovered.t) <= Math.max(typicalDt * 1.5, bucketMs))
      : undefined

  function pickAt(clientX: number) {
    const box = ref.current?.getBoundingClientRect()
    if (!box || !series.length) return
    const t = x0 + ((clientX - box.left - m.l) / plotW) * (x1 - x0)
    setHover(nearestIndex(series, t))
  }

  function onPointerMove(e: PointerEvent<SVGRectElement>) {
    pickAt(e.clientX)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!series.length) return
    const at = hover ?? series.length - 1
    if (e.key === 'ArrowLeft') setHover(Math.max(0, at - 1))
    else if (e.key === 'ArrowRight') setHover(Math.min(series.length - 1, at + 1))
    else if (e.key === 'Home') setHover(0)
    else if (e.key === 'End') setHover(series.length - 1)
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const values = inWindow.map((p) => p.v)
  const summary = inWindow.length
    ? `${label}: ${inWindow.length} readings from ${timeFormat(x0)} to ${timeFormat(x1)}. Latest ${fmt(
        inWindow[inWindow.length - 1].v,
      )}${unit}, low ${fmt(Math.min(...values))}${unit}, high ${fmt(Math.max(...values))}${unit}.`
    : `${label}: no readings between ${timeFormat(x0)} and ${timeFormat(x1)}.`

  const style = (color ? { '--series': color } : {}) as CSSProperties
  const empty = inWindow.length === 0

  const tipLeft = hovered ? Math.min(Math.max(sx(hovered.t), 74), W - 74) : 0
  const tipY = hovered ? sy(hovered.v) : 0
  const tipBelow = tipY < 70

  return (
    <div
      ref={ref}
      className={`chart ${phase === 'pending' ? 'is-pending' : ''} ${phase === 'drawing' ? 'is-drawing' : ''}`}
      style={style}
      tabIndex={compact || empty ? undefined : 0}
      role={compact ? 'img' : 'group'}
      aria-label={compact ? summary : `${summary} Use the arrow keys to read individual values.`}
      onKeyDown={compact ? undefined : onKeyDown}
      onFocus={compact ? undefined : () => setHover((h) => h ?? (series.length ? series.length - 1 : null))}
      onBlur={() => setHover(null)}
    >
      {empty && !compact ? (
        <div className="chart-empty" style={{ height }}>
          <span>{emptyText}</span>
        </div>
      ) : (
        <svg width={W} height={height} aria-hidden="true">
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--series, var(--blue))" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--series, var(--blue))" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`clip-${uid}`}>
              <rect x={m.l} y={m.t - 8} width={plotW} height={plotH + 16} />
            </clipPath>
          </defs>

          {!compact ? (
            <g className="chart-grid">
              {ys.ticks.map((v) => (
                <line key={`y${v}`} x1={m.l} x2={m.l + plotW} y1={r1(sy(v))} y2={r1(sy(v))} />
              ))}
              {xTickTimes.map((t) => (
                <line
                  key={`x${t}`}
                  className="chart-x"
                  x1={0}
                  x2={0}
                  y1={m.t}
                  y2={base}
                  style={{ transform: `translateX(${r1(sx(t))}px)`, transitionDuration: `${transitionMs}ms` }}
                />
              ))}
            </g>
          ) : null}

          {band ? (
            <g className="chart-band">
              <rect
                x={m.l}
                width={plotW}
                y={sy(band.max)}
                height={Math.max(0, sy(band.min) - sy(band.max))}
              />
              <line x1={m.l} x2={m.l + plotW} y1={r1(sy(band.max))} y2={r1(sy(band.max))} />
              <line x1={m.l} x2={m.l + plotW} y1={r1(sy(band.min))} y2={r1(sy(band.min))} />
              {!compact && band.label ? (
                <text
                  x={m.l + 8}
                  y={sy(band.max) + 14}
                  style={{ paintOrder: 'stroke', stroke: 'var(--band)', strokeWidth: 3 }}
                >
                  {band.label}
                </text>
              ) : null}
            </g>
          ) : null}

          {thresholds.map((th) => (
            <g key={`${th.tone}${th.value}`} className={`chart-th ${th.tone}`}>
              <line x1={m.l} x2={m.l + plotW} y1={r1(sy(th.value))} y2={r1(sy(th.value))} />
              {!compact ? (
                <text
                  x={m.l + plotW - 6}
                  y={sy(th.value) - 5}
                  textAnchor="end"
                  style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
                >
                  {th.label}
                </text>
              ) : null}
            </g>
          ))}

          {!compact ? (
            <g className="chart-axis">
              {yLabelTicks.map((v) => (
                <text key={`yl${v}`} x={m.l - 8} y={sy(v) + 3.5} textAnchor="end">
                  {String(Number(v.toFixed(2)))}
                </text>
              ))}
              {xTickTimes.map((t) => {
                const x = sx(t)
                const anchor = x < m.l + 18 ? 'start' : x > m.l + plotW - 18 ? 'end' : 'middle'
                return (
                  <text
                    key={`xl${t}`}
                    className="chart-x"
                    x={0}
                    y={height - 8}
                    textAnchor={anchor}
                    style={{ transform: `translateX(${r1(x)}px)`, transitionDuration: `${transitionMs}ms` }}
                  >
                    {timeFormat(t)}
                  </text>
                )
              })}
            </g>
          ) : null}

          <g clipPath={`url(#clip-${uid})`}>
            <path
              className="chart-area"
              d={areaPath || 'M0,0'}
              fill={`url(#fill-${uid})`}
              style={{ d: `path('${areaPath || 'M0,0'}')`, transitionDuration: `${transitionMs}ms` } as CSSProperties}
            />
            <path
              className="chart-line"
              d={linePath || 'M0,0'}
              pathLength={1}
              style={{ d: `path('${linePath || 'M0,0'}')`, transitionDuration: `${transitionMs}ms` } as CSSProperties}
              onAnimationEnd={() => setDrawn(true)}
            />
          </g>

          {placedMarkers.length ? (
            <g className="chart-markers">
              {placedMarkers.map((mk) => {
                const rel = r1(mk.left - mk.x)
                return (
                  <g
                    key={`${mk.t}${mk.label}`}
                    className={`chart-marker ${mk.tone}`}
                    style={{ transform: `translateX(${r1(mk.x)}px)`, transitionDuration: `${transitionMs}ms` }}
                  >
                    {mk.lane >= 0 ? (
                      <>
                        <line x1={0} x2={0} y1={6 + mk.lane * 24 + 18} y2={mk.y} />
                        <rect x={rel} y={6 + mk.lane * 24} width={mk.w} height={18} rx={4} />
                        <text x={rel + mk.w / 2} y={6 + mk.lane * 24 + 12.5} textAnchor="middle">
                          {mk.label}
                        </text>
                      </>
                    ) : null}
                    <circle cx={0} cy={mk.y} r={5} />
                  </g>
                )
              })}
            </g>
          ) : null}

          {last ? (
            <g
              className="chart-end-group"
              style={{
                transform: `translate(${r1(endX)}px, ${r1(endY)}px)`,
                transitionDuration: `${transitionMs}ms`,
              }}
            >
              {live ? <circle className="chart-pulse" cx={0} cy={0} r={4} /> : null}
              <circle className="chart-end" cx={0} cy={0} r={4} />
              {!compact && pillText ? (
                <g className="chart-pill">
                  <rect x={r1(pillLeft - endX)} y={-10} width={pillW} height={20} rx={4} />
                  <text x={r1(pillLeft - endX + pillW / 2)} y={4} textAnchor="middle">
                    {pillText}
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}

          {hovered && !compact ? (
            <g className="chart-cross">
              <line x1={r1(sx(hovered.t))} x2={r1(sx(hovered.t))} y1={m.t} y2={base} />
              <circle cx={sx(hovered.t)} cy={sy(hovered.v)} r={4.5} />
            </g>
          ) : null}

          {!compact ? (
            <rect
              x={m.l}
              y={m.t}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerDown={onPointerMove}
              onPointerLeave={() => setHover(null)}
            />
          ) : null}
        </svg>
      )}

      {hovered && !compact ? (
        <div
          className="chart-tip"
          style={{
            transform: `translate(${tipLeft}px, ${tipBelow ? tipY + 14 : tipY - 12}px) translate(-50%, ${
              tipBelow ? '0' : '-100%'
            })`,
          }}
        >
          <strong>
            <i aria-hidden="true" />
            {fmt(hovered.v)}
            {unit}
          </strong>
          <span>
            {bucketMs ? `avg around ${timeFormat(hovered.t)}` : hhmmss(hovered.t)}
          </span>
          {hoveredMarker ? <em>{hoveredMarker.label}</em> : null}
        </div>
      ) : null}

      {!compact ? (
        <p className="sr-only" aria-live="polite">
          {hovered ? `${fmt(hovered.v)}${unit} at ${hhmmss(hovered.t)}` : ''}
        </p>
      ) : null}

      {showTable && inWindow.length ? (
        <details className="chart-table">
          <summary>Show readings as a table</summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>{label}</th>
                </tr>
              </thead>
              <tbody>
                {inWindow
                  .slice(-120)
                  .reverse()
                  .map((p) => (
                    <tr key={p.t}>
                      <td className="mono">{hhmmss(p.t)}</td>
                      <td className="mono">
                        {fmt(p.v)}
                        {unit}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  )
}
