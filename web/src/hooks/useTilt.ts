import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from './motion'

/**
 * Pointer-driven 3D tilt. Writes --rx/--ry (degrees) and --px/--py (pixels,
 * for a counter-moving parallax layer) onto the host element; CSS does the rest.
 * Skipped for touch screens and reduced motion.
 */
export function useTilt<T extends HTMLElement>(ref: RefObject<T | null>, maxDeg = 7, parallax = 14) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(x * maxDeg * 2).toFixed(2)}deg`)
        el.style.setProperty('--rx', `${(-y * maxDeg * 2).toFixed(2)}deg`)
        el.style.setProperty('--px', `${(-x * parallax).toFixed(1)}px`)
        el.style.setProperty('--py', `${(-y * parallax).toFixed(1)}px`)
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      for (const v of ['--rx', '--ry', '--px', '--py']) el.style.removeProperty(v)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [ref, maxDeg, parallax])
}
