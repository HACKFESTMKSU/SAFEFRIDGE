import { useEffect, useState } from 'react'

/** Live result of a CSS media query. */
export function useMedia(query: string) {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches),
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}
