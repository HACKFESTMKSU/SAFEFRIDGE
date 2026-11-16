import { useEffect, useState, type RefObject } from 'react'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_QUERY).matches)
}

/** Re-renders every `intervalMs` and returns the current epoch millis. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** True once the element has scrolled into view (never flips back). */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '0px 0px -12% 0px') {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, seen])
  return seen
}

/** True while the element is on screen (flips back when it leaves). */
export function useVisible<T extends Element>(ref: RefObject<T | null>) {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry) setVisible(entry.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}

/**
 * Animate-on-scroll for every `[data-aos]` element inside `root`.
 * Same attribute API as the AOS library (`data-aos`, `data-aos-delay`),
 * without the dependency. Elements stay visible if JS never runs.
 */
export function useAos<T extends HTMLElement>(root: RefObject<T | null>) {
  useEffect(() => {
    const host = root.current
    if (!host) return
    const items = Array.from(host.querySelectorAll<HTMLElement>('[data-aos]'))
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('aos-in'))
      return
    }
    items.forEach((el) => {
      const delay = Number(el.dataset.aosDelay ?? 0)
      if (delay) el.style.transitionDelay = `${delay}ms`
    })
    host.classList.add('aos-ready')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.classList.add('aos-in')
          io.unobserve(el)
          // Drop the stagger delay once revealed so hover effects respond instantly.
          const delay = Number(el.dataset.aosDelay ?? 0)
          if (delay) window.setTimeout(() => el.style.removeProperty('transition-delay'), 900 + delay)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )
    items.forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      host.classList.remove('aos-ready')
    }
  }, [root])
}
