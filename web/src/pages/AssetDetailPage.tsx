import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TelemetryChart } from '../components/charts/TelemetryChart'
import { Badge } from '../components/ui/Badge'
import { MetricTile } from '../components/ui/MetricTile'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  assetTypeLabel,
  fmtAmps,
  fmtPct,
  fmtPressure,
  fmtRelative,
  fmtTemp,
  fmtWhen,
  severityLabel,
  statusLabel,
} from '../lib/format'
import { canAddMaintenanceNote } from '../lib/roles'

export function AssetDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const {
    assets,
    devices,
    incidents,
    notes,
    getTelemetry,
    getLatest,
    addNote,
  } = useData()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const asset = assets.find((a) => a.id === id)
  if (!asset || !user) {
    return (
      <div className="panel panel-pad">
        <p>Asset not found.</p>
        <Link to="/assets">Back to assets</Link>
      </div>
    )
  }

  const device = devices.find((d) => d.id === asset.deviceId)
  const latest = asset.deviceId ? getLatest(asset.deviceId) : null
  const series = asset.deviceId ? getTelemetry(asset.deviceId) : []
  const assetIncidents = incidents.filter((i) => i.assetId === asset.id)
  const assetNotes = notes.filter((n) => n.assetId === asset.id)

  const tempTone =
    latest && latest.temperature_c != null
      ? latest.temperature_c >= asset.thresholds.tempCriticalC
        ? 'crit'
        : latest.temperature_c >= asset.thresholds.tempWarningC
          ? 'warn'
          : 'ok'
      : undefined

  async function onNote(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await addNote(asset!.id, note.trim())
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <Link
            to="/assets"
            className="btn ghost sm"
            style={{ marginBottom: '0.5rem', paddingLeft: 0 }}
          >
            <ArrowLeft size={16} /> Assets
          </Link>
          <h2 style={{ fontSize: '1.35rem' }}>{asset.name}</h2>
          <p>
            {assetTypeLabel(asset.type)} · {asset.location}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge tone={asset.status === 'active' ? 'ok' : 'neutral'}>
            {asset.status}
          </Badge>
          {device ? (
            <Badge tone={device.online ? 'ok' : 'neutral'} dot>
              {device.online ? 'Device online' : 'Device offline'} · {device.id}
            </Badge>
          ) : (
            <Badge tone="warn">No device linked</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <MetricTile
          label="Temperature"
          value={fmtTemp(latest?.temperature_c)}
          hint={`${asset.thresholds.tempMinC}–${asset.thresholds.tempMaxC}°C`}
          tone={tempTone}
        />
        <MetricTile
          label="Humidity"
          value={fmtPct(latest?.humidity_percent)}
        />
        <MetricTile
          label="Current"
          value={fmtAmps(latest?.current_a)}
          hint="Not wired yet"
        />
        <MetricTile
          label="Water"
          value={
            latest?.water_wet == null ? '—' : latest.water_wet ? 'Wet' : 'Dry'
          }
          hint={
            latest?.water_level != null ? `Level ${latest.water_level}` : 'Not wired yet'
          }
          tone={latest?.water_wet ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid grid-2">
        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>24-hour history</h2>
            {device ? (
              <span className="hint" style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
                Last seen {fmtRelative(device.lastSeen)}
              </span>
            ) : null}
          </div>
          {series.length ? (
            <TelemetryChart data={series} />
          ) : (
            <div className="empty">No telemetry series for this asset yet.</div>
          )}
        </section>

        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>Secondary sensors</h2>
          </div>
          <div className="grid" style={{ gap: '0.75rem' }}>
            <MetricTile
              label="BMP180 ambient temp"
              value={fmtTemp(latest?.bmp_temperature_c)}
              hint="Next phase"
            />
            <MetricTile
              label="BMP180 pressure"
              value={fmtPressure(latest?.pressure_hpa)}
              hint="Next phase"
            />
            <MetricTile
              label="MQ-3 (optional)"
              value={latest?.mq3_raw != null ? String(latest.mq3_raw) : '—'}
              hint="Demo only · no alert rule"
            />
            <div className="metric">
              <div className="label">Thresholds</div>
              <div className="hint">
                Warn ≥ {asset.thresholds.tempWarningC}°C · Critical ≥{' '}
                {asset.thresholds.tempCriticalC}°C
              </div>
              <div className="hint" style={{ marginTop: '0.35rem' }}>
                SMS: {asset.smsRecipients.join(', ') || 'None configured'}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
            <h2>Incidents</h2>
          </div>
          <div className="list">
            {assetIncidents.length === 0 ? (
              <div className="empty">No incidents for this asset.</div>
            ) : (
              assetIncidents.map((inc) => (
                <Link key={inc.id} className="list-item" to={`/incidents/${inc.id}`}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                      <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>
                        {severityLabel(inc.severity)}
                      </Badge>
                      <Badge tone="neutral">{statusLabel(inc.status)}</Badge>
                    </div>
                    <strong>{inc.title}</strong>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                      {fmtWhen(inc.detectedAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>Maintenance notes</h2>
          </div>
          {canAddMaintenanceNote(user.role) ? (
            <form className="form" onSubmit={onNote} style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label>Add note</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Inspection finding, parts replaced…"
                />
              </div>
              <button className="btn sm" type="submit" disabled={!note.trim() || busy}>
                Save note
              </button>
            </form>
          ) : null}
          <div className="list" style={{ borderTop: '1px solid var(--line)', margin: '0 -1.2rem' }}>
            {assetNotes.length === 0 ? (
              <div className="empty">No notes yet.</div>
            ) : (
              assetNotes.map((n) => (
                <div key={n.id} className="list-item">
                  <div>
                    <strong>{n.authorName}</strong>
                    <p style={{ marginTop: 4 }}>{n.body}</p>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginTop: 6 }}>
                      {fmtWhen(n.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  )
}
