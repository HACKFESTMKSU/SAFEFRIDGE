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

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  updateProfile: (
    patch: Partial<Pick<User, 'name' | 'phone'> & { password?: string }>,
  ) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api<{ access_token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(res.access_token)
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

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'phone'> & { password?: string }>) => {
      const next = await api<User>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      setUser(next)
    },
    [],
  )

  const value = useMemo(
    () => ({ user, loading, login, logout, updateProfile }),
    [user, loading, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
