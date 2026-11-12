import type { ReactNode } from 'react'

type Tone = 'ok' | 'warn' | 'crit' | 'neutral' | 'brand'

export function Badge({
  tone = 'neutral',
  children,
  dot,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span className={`badge ${tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  )
}
