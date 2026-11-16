import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Box,
  Cpu,
  Globe,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useNow } from '../../hooks/motion'
import { useMedia } from '../../hooks/useMedia'
import { canEditThresholds, canManageDevices, canManageUsers } from '../../lib/roles'
import { fmtAgo, roleLabel } from '../../lib/format'

const COLLAPSE_KEY = 'coldguard.sidebar'
const MOBILE_QUERY = '(max-width: 1040px)'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  count?: number
}

const TITLES: [string, string][] = [
  ['/assets', 'Assets'],
  ['/incidents', 'Incidents'],
  ['/devices', 'Devices'],
  ['/users', 'Users'],
  ['/settings', 'Thresholds'],
  ['/profile', 'Profile'],
]

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? 'collapsed' : 'expanded')
  } catch {
    // storage unavailable (private mode); the toggle still works for this visit
  }
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { incidents, connected, lastUpdated } = useData()
  const { pathname } = useLocation()
  const mobile = useMedia(MOBILE_QUERY)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const now = useNow(1000)

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setDrawerOpen((v) => !v)
      return
    }
    setCollapsed((v) => {
      saveCollapsed(!v)
      return !v
    })
  }, [])

  // "[" toggles the sidebar, Escape closes the mobile drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        return
      }
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      toggleSidebar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  if (!user) return null

  const openCount = incidents.filter((i) => i.status !== 'resolved').length
  const manage: NavItem[] = [
    ...(canManageDevices(user.role) ? [{ to: '/devices', label: 'Devices', icon: Cpu }] : []),
    ...(canManageUsers(user.role) ? [{ to: '/users', label: 'Users', icon: Users }] : []),
    ...(canEditThresholds(user.role) ? [{ to: '/settings', label: 'Thresholds', icon: SlidersHorizontal }] : []),
  ]
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Monitor',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/assets', label: 'Assets', icon: Box },
        { to: '/incidents', label: 'Incidents', icon: AlertTriangle, count: openCount },
      ],
    },
    ...(manage.length ? [{ label: 'Manage', items: manage }] : []),
    { label: 'Account', items: [{ to: '/profile', label: 'Profile', icon: UserRound }] },
  ]

  const title = pathname === '/' ? 'Dashboard' : (TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'ColdGuard')
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const live = connected && lastUpdated != null
  const rail = collapsed && !mobile
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className={`app ${rail ? 'is-collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation" id="app-sidebar">
        <div className="sb-top">
          <Link to="/" className="brand-badge sb-brand" aria-label="ColdGuard dashboard" onClick={closeDrawer}>
            {rail ? 'CG' : 'COLDGUARD'}
          </Link>
          {mobile ? (
            <button type="button" className="sb-icon-btn" aria-label="Close menu" onClick={closeDrawer}>
              <X size={18} />
            </button>
          ) : null}
        </div>

        <nav className="sb-nav">
          {groups.map((g) => (
            <div key={g.label} className="sb-group">
              <p className="sb-section">{g.label}</p>
              {g.items.map(({ to, label, icon: Icon, end, count }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="sb-link"
                  data-label={label}
                  aria-label={rail ? (count ? `${label}, ${count} open` : label) : undefined}
                  onClick={closeDrawer}
                >
                  <Icon size={18} aria-hidden />
                  <span className="sb-label">{label}</span>
                  {count ? <span className="sb-count">{count}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-foot">
          <Link to="/welcome" className="sb-link" data-label="Product page" aria-label={rail ? 'Product page' : undefined}>
            <Globe size={18} aria-hidden />
            <span className="sb-label">Product page</span>
          </Link>
          <div className="sb-user">
            <span className="sb-avatar" aria-hidden="true">
              {initials || 'CG'}
            </span>
            <span className="sb-label sb-user-text">
              <strong>{user.name}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
            <button
              type="button"
              className="sb-icon-btn sb-signout"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {drawerOpen ? <div className="sb-backdrop" onClick={closeDrawer} aria-hidden="true" /> : null}

      <div className="app-main">
        <header className="app-header">
          <button
            type="button"
            className="sb-toggle"
            onClick={toggleSidebar}
            aria-controls="app-sidebar"
            aria-expanded={mobile ? drawerOpen : !collapsed}
            aria-label={mobile ? 'Open menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={mobile ? 'Menu' : 'Toggle sidebar  [ '}
          >
            <PanelLeft size={18} />
          </button>
          <div className="crumbs">
            <span>ColdGuard</span>
            <span aria-hidden="true">/</span>
            <strong>{title}</strong>
          </div>
          <span className={`live-pill ${live ? '' : 'down'}`} role="status">
            <span className="live-dot" aria-hidden="true" />
            <strong>{live ? 'Live' : 'Offline'}</strong>
            <span className="live-when">
              {live && lastUpdated != null ? `updated ${fmtAgo(lastUpdated, now)}` : 'API unreachable'}
            </span>
          </span>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
