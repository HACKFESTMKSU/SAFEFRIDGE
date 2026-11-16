import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const demos = [
  { email: 'admin@coldguard.local', password: 'admin123', label: 'Admin' },
  { email: 'operator@coldguard.local', password: 'operator123', label: 'Operator' },
  { email: 'tech@coldguard.local', password: 'tech123', label: 'Technician' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('admin@coldguard.local')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Sign-in failed. Check the email and password.')
  }

  return (
    <div className="login-page">
      <div className="login-wrap">
        <Link to="/welcome" className="login-back">
          <ArrowLeft size={14} /> Back to the ColdGuard page
        </Link>
        <div className="login-panel">
          <span className="brand-badge">COLDGUARD</span>
          <h1>Sign in</h1>
          <p className="sub">See every cold unit, live.</p>

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
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-accounts">
            <p>Try a demo role. Each one fills in its own login.</p>
            <div className="demo-row">
              {demos.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  aria-pressed={email === d.email}
                  onClick={() => {
                    setEmail(d.email)
                    setPassword(d.password)
                    setError('')
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
