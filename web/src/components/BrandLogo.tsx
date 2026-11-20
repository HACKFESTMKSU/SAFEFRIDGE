import { Link } from 'react-router-dom'

type Size = 'sm' | 'md' | 'lg'

type BrandLogoProps = {
  to?: string
  /** Icon only — used in the collapsed sidebar rail */
  markOnly?: boolean
  size?: Size
  className?: string
  onClick?: () => void
  'aria-label'?: string
}

const MARK = '/logo-mark.png'

export function BrandLogo({
  to,
  markOnly = false,
  size = 'md',
  className = '',
  onClick,
  'aria-label': ariaLabel = 'ColdGuard',
}: BrandLogoProps) {
  const classes = ['brand-logo', `brand-logo--${size}`, markOnly ? 'brand-logo--mark' : '', className]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      <img src={MARK} alt="" className="brand-logo-mark" width={40} height={40} decoding="async" />
      {markOnly ? null : <span className="brand-logo-word">ColdGuard</span>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel} onClick={onClick}>
        {inner}
      </Link>
    )
  }

  return (
    <span className={classes} aria-label={ariaLabel} role="img">
      {inner}
    </span>
  )
}
