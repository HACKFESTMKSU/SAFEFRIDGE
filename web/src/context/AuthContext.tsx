import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SEED_USERS } from '../data/mock'
import type { User } from '../types'

interface AuthState {
  user: User | null
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  updateProfile: (patch: Partial<Pick<User, 'name' | 'phone' | 'password'>>) => void
}

const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'coldguard.userId'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const id = localStorage.getItem(STORAGE_KEY)
    return SEED_USERS.find((u) => u.id === id) ?? null
  })

  const login = useCallback((email: string, password: string) => {
    const found = SEED_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!found || found.password !== password) {
      return { ok: false, error: 'Invalid email or password' }
    }
    localStorage.setItem(STORAGE_KEY, found.id)
    setUser(found)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    (patch: Partial<Pick<User, 'name' | 'phone' | 'password'>>) => {
      setUser((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        const idx = SEED_USERS.findIndex((u) => u.id === prev.id)
        if (idx >= 0) SEED_USERS[idx] = next
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({ user, login, logout, updateProfile }),
    [user, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
