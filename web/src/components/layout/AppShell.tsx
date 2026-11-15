import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Box,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Snowflake,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import {
  canManageDevices,
  canManageUsers,
  canEditThresholds,
} from '../../lib/roles'
import { roleLabel } from '../../lib/format'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/assets': 'Assets',
  '/incidents': 'Incidents',
  '/devices': 'Devices',
  '/users': 'Users',
  '/settings': 'Thresholds & SMS',
  '/profile': 'Profile',
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { incidents, connected } = useData()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const openCount = incidents.filter((i) => i.status !== 'resolved').length
  const pathTitle =
    Object.entries(titles).find(([path]) =>
      path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(path),
    )?.[1] ?? 'ColdGuard'

  const close = () => setOpen(false)

  return (
    <div className="app-shell">
      {open ? <div className="sidebar-backdrop" onClick={close} /> : null}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Snowflake size={20} />
          </div>
          <div className="brand-text">
            <strong>ColdGuard</strong>
            <span>Cold-storage monitor</span>
          </div>
        </div>

        <nav className="nav" onClick={close}>
          <NavLink to="/" end>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/assets">
            <Box size={18} /> Assets
          </NavLink>
          <NavLink to="/incidents">
            <AlertTriangle size={18} /> Incidents
            {openCount > 0 ? <span className="nav-badge">{openCount}</span> : null}
          </NavLink>
          {canManageDevices(user.role) ? (
            <NavLink to="/devices">
              <Cpu size={18} /> Devices
            </NavLink>
          ) : null}
          {canManageUsers(user.role) ? (
            <NavLink to="/users">
              <Users size={18} /> Users
            </NavLink>
          ) : null}
          {canEditThresholds(user.role) ? (
            <NavLink to="/settings">
              <Settings size={18} /> Thresholds
            </NavLink>
          ) : null}
          <NavLink to="/profile">
            <UserRound size={18} /> Profile
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="name">{user.name}</div>
          <div className="meta">
            {roleLabel(user.role)} · {user.email}
          </div>
          <button className="btn ghost sm" style={{ color: '#d7f0ef', justifyContent: 'flex-start', paddingLeft: 0 }} onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              className="mobile-nav-toggle"
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1>{pathTitle}</h1>
          </div>
          <div className="topbar-actions">
            <span className={`badge ${connected ? 'ok' : 'crit'}`}>
              <Activity size={12} /> {connected ? 'API connected' : 'API unreachable'}
            </span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
