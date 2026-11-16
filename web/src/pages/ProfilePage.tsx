import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/format'

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await updateProfile({
        name,
        phone,
        ...(password ? { password } : {}),
      })
      setPassword('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Profile</h2>
          <p>Update your name, phone (for SMS alerts), and password.</p>
        </div>
      </div>

      <section className="panel panel-pad" style={{ maxWidth: 520 }}>
        <form className="form" onSubmit={onSave}>
          <div className="field">
            <label>Role</label>
            <input value={roleLabel(user.role)} disabled />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={user.email} disabled />
          </div>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <button className="btn" type="submit">
            Save profile
          </button>
          {error ? <p className="error-text">{error}</p> : null}
          {saved ? (
            <p style={{ color: 'var(--ok)', fontSize: '0.9rem' }}>Profile updated.</p>
          ) : null}
        </form>
      </section>
    </>
  )
}
