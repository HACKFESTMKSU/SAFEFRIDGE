import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { Role } from '../../types'

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-page">
        <div className="empty">Loading…</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
