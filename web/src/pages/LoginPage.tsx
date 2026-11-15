import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Snowflake } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const demos = [
  { email: 'admin@coldguard.app', password: 'admin123', label: 'Admin' },
  { email: 'operator@coldguard.app', password: 'operator123', label: 'Operator' },
  { email: 'tech@coldguard.app', password: 'tech123', label: 'Technician' },
]

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState('admin@coldguard.app')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Login failed')
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="brand-mark" style={{ background: '#0b3d4a', color: '#5eead4' }}>
            <Snowflake size={20} />
          </div>
          <div>
            <h1>ColdGuard</h1>
            <p className="sub">Sign in to monitor cold storage</p>
          </div>
        </div>

        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy || loading}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <strong style={{ color: 'var(--ink)' }}>Seeded accounts</strong>
          {demos.map((d) => (
            <div key={d.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(d.email)
                  setPassword(d.password)
                  setError('')
                }}
              >
                {d.label}
              </button>
              {' · '}
              {d.email} / {d.password}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
