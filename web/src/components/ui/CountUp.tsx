import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useInView } from '../../hooks/motion'

function fmt(v: number, decimals: number) {
  const s = v.toFixed(decimals)
  return s === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : s
}

/**
 * Animates a number to its new value. With `fromZeroOnView`, the first
 * animation starts at `from` when the element scrolls into view; after that
 * it eases between successive values (live readings).
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  fromZeroOnView = false,
  from = 0,
}: {
  value: number
  decimals?: number
  duration?: number
  fromZeroOnView?: boolean
  from?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, '0px')
  const [reduced] = useState(prefersReducedMotion)
  const start = fromZeroOnView && !reduced ? from : value
  const [display, setDisplay] = useState(start)
  const shown = useRef(start)

  useEffect(() => {
    if (reduced || (fromZeroOnView && !inView)) return
    const begin = shown.current
    if (begin === value) return
    let raf = 0
    let t0: number | null = null
    const step = (t: number) => {
      // Time from the first frame's own timestamp; clamp so clock skew can't overshoot.
      if (t0 == null) t0 = t
      const p = Math.min(1, Math.max(0, (t - t0) / duration))
      const eased = 1 - Math.pow(1 - p, 3)
      const next = begin + (value - begin) * eased
      shown.current = next
      setDisplay(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, inView, fromZeroOnView, duration, reduced])

  return <span ref={ref}>{fmt(reduced ? value : display, decimals)}</span>
}
