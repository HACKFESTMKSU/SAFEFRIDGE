import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken } from '../lib/api'
import type { User } from '../types'

interface ProfilePatch {
  name?: string
  phone?: string
  password?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  updateProfile: (patch: ProfilePatch) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setToken(res.token)
      setUser(res.user)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      return { ok: false, error: message }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const body: Record<string, string> = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.phone !== undefined) body.phone = patch.phone
    if (patch.password) body.password = patch.password
    const updated = await api<User>('/auth/me', { method: 'PATCH', body })
    setUser(updated)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, updateProfile }),
    [user, loading, login, logout, updateProfile],
  )

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="login-page">
          <div className="empty">Loading ColdGuard…</div>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
