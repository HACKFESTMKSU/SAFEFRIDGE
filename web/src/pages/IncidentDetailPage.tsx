import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, MessageSquareWarning } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  fmtRelative,
  fmtWhen,
  severityLabel,
  statusLabel,
} from '../lib/format'
import { canAckResolve, canAddMaintenanceNote } from '../lib/roles'

export function IncidentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const {
    incidents,
    assets,
    users,
    notes,
    acknowledgeIncident,
    resolveIncident,
    addNote,
  } = useData()
  const [resolveNote, setResolveNote] = useState('')
  const [techNote, setTechNote] = useState('')

  const incident = incidents.find((i) => i.id === id)
  if (!incident || !user) {
    return (
      <div className="panel panel-pad">
        <p>Incident not found.</p>
        <Link to="/incidents">Back</Link>
      </div>
    )
  }

  const asset = assets.find((a) => a.id === incident.assetId)
  const ackUser = users.find((u) => u.id === incident.acknowledgedBy)
  const resUser = users.find((u) => u.id === incident.resolvedBy)
  const linkedNotes = notes.filter((n) => n.incidentId === incident.id)
  const canAct = canAckResolve(user.role)

  function onResolve(e: FormEvent) {
    e.preventDefault()
    if (!resolveNote.trim()) return
    resolveIncident(incident!.id, resolveNote.trim())
  }

  function onTechNote(e: FormEvent) {
    e.preventDefault()
    if (!techNote.trim()) return
    addNote(incident!.assetId, techNote.trim(), incident!.id)
    setTechNote('')
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <Link to="/incidents" className="btn ghost sm" style={{ marginBottom: 10 }}>
            <ArrowLeft size={16} /> Incidents
          </Link>
          <h2>{incident.title}</h2>
          <p>
            {asset?.name ?? 'Unknown unit'}, detected {fmtRelative(incident.detectedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <Badge tone={incident.severity === 'critical' ? 'crit' : 'warn'}>
            {severityLabel(incident.severity)}
          </Badge>
          <Badge tone={incident.status === 'resolved' ? 'ok' : 'neutral'}>
            {statusLabel(incident.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>Details</h2>
          </div>
          <p style={{ marginBottom: 14 }}>{incident.message}</p>
          <div className="callout" style={{ marginBottom: 18 }}>
            <MessageSquareWarning size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Recommended action</strong>
              <span style={{ color: 'var(--text-2)' }}>{incident.recommendedAction}</span>
            </div>
          </div>
          <dl className="kv">
            <dt>Type</dt>
            <dd>{incident.type.replace('_', ' ')}</dd>
            <dt>Detected</dt>
            <dd>{fmtWhen(incident.detectedAt)}</dd>
            {incident.value != null ? (
              <>
                <dt>Reading</dt>
                <dd className="mono">
                  {incident.value}
                  {incident.threshold != null ? ` (threshold ${incident.threshold})` : ''}
                </dd>
              </>
            ) : null}
            {incident.acknowledgedAt ? (
              <>
                <dt>Acknowledged</dt>
                <dd>
                  {fmtWhen(incident.acknowledgedAt)}
                  {ackUser ? ` by ${ackUser.name}` : ''}
                </dd>
              </>
            ) : null}
            {incident.resolvedAt ? (
              <>
                <dt>Resolved</dt>
                <dd>
                  {fmtWhen(incident.resolvedAt)}
                  {resUser ? ` by ${resUser.name}` : ''}
                </dd>
                <dt>Resolution note</dt>
                <dd>{incident.resolveNote}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>Actions</h2>
          </div>

          {canAct && incident.status === 'open' ? (
            <button
              className="btn"
              style={{ marginBottom: '0.85rem' }}
              onClick={() => acknowledgeIncident(incident.id)}
            >
              <CheckCircle2 size={16} /> Acknowledge
            </button>
          ) : null}

          {canAct && incident.status !== 'resolved' ? (
            <form className="form" onSubmit={onResolve}>
              <div className="field">
                <label>Resolve with note</label>
                <textarea
                  rows={3}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="What was done?"
                  required
                />
              </div>
              <button className="btn" type="submit">
                Resolve incident
              </button>
            </form>
          ) : null}

          {!canAct ? (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.92rem' }}>
              Operators and admins can acknowledge and resolve. Technicians can add maintenance notes.
            </p>
          ) : null}

          {incident.status === 'resolved' ? (
            <p className="badge ok" style={{ marginTop: '0.5rem' }}>
              This incident is closed.
            </p>
          ) : null}

          {canAddMaintenanceNote(user.role) ? (
            <form className="form" onSubmit={onTechNote} style={{ marginTop: '1.25rem' }}>
              <div className="field">
                <label>Maintenance note</label>
                <textarea
                  rows={3}
                  value={techNote}
                  onChange={(e) => setTechNote(e.target.value)}
                  placeholder="Technician observation…"
                />
              </div>
              <button className="btn secondary sm" type="submit" disabled={!techNote.trim()}>
                Add note
              </button>
            </form>
          ) : null}

          {linkedNotes.length > 0 ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Linked notes</h3>
              {linkedNotes.map((n) => (
                <div key={n.id} style={{ marginBottom: '0.65rem' }}>
                  <strong>{n.authorName}</strong>
                  <p>{n.body}</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                    {fmtWhen(n.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {asset ? (
            <div style={{ marginTop: '1rem' }}>
              <Link className="btn secondary sm" to={`/assets/${asset.id}`}>
                Open asset
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </>
  )
}
