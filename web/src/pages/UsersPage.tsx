import { useState, type FormEvent } from 'react'
import { Badge } from '../components/ui/Badge'
import { useData } from '../context/DataContext'
import { roleLabel } from '../lib/format'
import type { Role } from '../types'

export function UsersPage() {
  const { users, upsertUser } = useData()
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [password, setPassword] = useState('changeme')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await upsertUser({ name, email, phone, role, password })
      setShow(false)
      setName('')
      setEmail('')
      setPhone('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h2 style={{ fontSize: '1.35rem' }}>Users</h2>
          <p>Three roles only: Admin, Operator, Technician.</p>
        </div>
        <button className="btn" onClick={() => setShow((v) => !v)}>
          {show ? 'Close' : 'Add user'}
        </button>
      </div>

      {show ? (
        <section className="panel panel-pad">
          <form className="form" onSubmit={onCreate}>
            <div className="field-row">
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Phone (SMS)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="technician">Technician</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Temp password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td className="mono">{u.phone || '—'}</td>
                  <td>
                    <Badge tone="brand">{roleLabel(u.role)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
