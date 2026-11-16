import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { Sparkline } from '../components/charts/Sparkline'
import { Badge } from '../components/ui/Badge'
import { CountUp } from '../components/ui/CountUp'
import { Segmented } from '../components/ui/Segmented'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useNow } from '../hooks/motion'
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
  tempTone,
  toneLabel,
  tsMs,
} from '../lib/format'
import { canAddMaintenanceNote } from '../lib/roles'
import { NO_READINGS, RANGE_MS, incidentMarkers, toSeries, type Range } from '../lib/telemetry'

export function AssetDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { assets, devices, incidents, notes, getTelemetry, getLatest, addNote } = useData()
  const [note, setNote] = useState('')
  const [rangeChoice, setRangeChoice] = useState<Range | null>(null)
  const clock = useNow(1000)

  const asset = assets.find((a) => a.id === id)
  const rows = asset?.deviceId ? getTelemetry(asset.deviceId) : NO_READINGS
  const temps = useMemo(() => toSeries(rows, 'temperature_c'), [rows])
  const hums = useMemo(() => toSeries(rows, 'humidity_percent'), [rows])
  const amps = useMemo(() => toSeries(rows, 'current_a'), [rows])
  const hpa = useMemo(() => toSeries(rows, 'pressure_hpa'), [rows])
  const ambient = useMemo(() => toSeries(rows, 'bmp_temperature_c'), [rows])
  const vapour = useMemo(() => toSeries(rows, 'mq3_raw'), [rows])

  if (!asset || !user) {
    return (
      <div className="panel panel-pad">
        <p>This asset doesn’t exist or was removed.</p>
        <Link className="btn secondary sm" to="/assets" style={{ marginTop: 12 }}>
          Back to assets
        </Link>
      </div>
    )
  }

  const device = devices.find((d) => d.id === asset.deviceId)
  const latest = asset.deviceId ? getLatest(asset.deviceId) : null
  const latestAt = latest ? tsMs(latest.timestamp) : null
  const range: Range = rangeChoice ?? (latestAt && clock - latestAt < RANGE_MS['30m'] ? '30m' : '24h')
  const domain: [number, number] = [clock - RANGE_MS[range], clock]
  const assetIncidents = incidents
    .filter((i) => i.assetId === asset.id)
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  const assetNotes = notes.filter((n) => n.assetId === asset.id)
  const t = asset.thresholds
  const tone = tempTone(latest?.temperature_c, t)

  function onNote(e: FormEvent) {
    e.preventDefault()
    if (!note.trim() || !asset) return
    addNote(asset.id, note.trim())
    setNote('')
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <Link to="/assets" className="btn ghost sm" style={{ marginBottom: 10 }}>
            <ArrowLeft size={16} /> Assets
          </Link>
          <h2>{asset.name}</h2>
          <p>
            {assetTypeLabel(asset.type)} in {asset.location}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge tone={asset.status === 'active' ? 'ok' : 'neutral'}>{asset.status}</Badge>
          {device ? (
            <Badge tone={device.online ? 'ok' : 'neutral'} dot>
              {device.id} {device.online ? 'online' : 'offline'}
            </Badge>
          ) : (
            <Badge tone="warn">No device linked</Badge>
          )}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">
            <span className={`status-dot ${tone ?? ''}`} />
            Temperature
          </div>
          <div className={`stat-value ${tone === 'crit' ? 'crit' : ''}`}>
            {latest ? (
              <>
                <CountUp value={latest.temperature_c} decimals={1} />
                <small>°C</small>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="stat-foot">
            {toneLabel(tone)}, safe {t.tempMinC} to {t.tempMaxC}°C
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Humidity</div>
          <div className="stat-value">{latest ? fmtPct(latest.humidity_percent) : '—'}</div>
          <div className="stat-foot">
            <Sparkline points={hums} domain={domain} height={28} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Compressor current</div>
          <div className="stat-value">{latest ? fmtAmps(latest.current_a) : '—'}</div>
          <div className="stat-foot">
            <Sparkline points={amps} domain={domain} height={28} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <span className={`status-dot ${latest ? (latest.water_wet ? 'warn' : 'ok') : ''}`} />
            Leak sensor
          </div>
          <div className="stat-value">{latest ? (latest.water_wet ? 'Wet' : 'Dry') : '—'}</div>
          <div className="stat-foot">{latest ? `Level ${latest.water_level}` : 'No reading yet'}</div>
        </div>
      </div>

      <section className="panel live-panel" aria-label="Temperature history">
        <div className="live-head">
          <div className="live-id">
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Temperature</h2>
            <span className="live-meta">
              {latest ? `Last reading ${fmtRelative(latest.timestamp)}.` : 'Waiting for the first reading.'}{' '}
              {device ? `${device.id} last seen ${fmtRelative(device.lastSeen)}.` : ''}
            </span>
          </div>
          <Segmented
            label="Time window"
            value={range}
            onChange={setRangeChoice}
            options={[
              {
                value: '30m',
                label: (
                  <>
                    {device?.online ? <span className="seg-live" aria-hidden="true" /> : null}
                    30 min
                  </>
                ),
              },
              { value: '6h', label: '6 h' },
              { value: '24h', label: '24 h' },
            ]}
          />
        </div>
        <div className="live-body">
          <LiveChart
            points={temps}
            label="Temperature"
            unit="°C"
            height={320}
            domain={domain}
            live={Boolean(device?.online)}
            band={{ min: t.tempMinC, max: t.tempMaxC, label: `Safe ${t.tempMinC} to ${t.tempMaxC}°C` }}
            thresholds={[
              { value: t.tempWarningC, tone: 'warn', label: `Warning ${t.tempWarningC}°C` },
              { value: t.tempCriticalC, tone: 'crit', label: `Critical ${t.tempCriticalC}°C` },
            ]}
            markers={incidentMarkers(incidents, asset.id)}
            showTable
            emptyText={
              <>
                No readings in this window.{' '}
                {range !== '24h' ? (
                  <button type="button" className="btn secondary sm" onClick={() => setRangeChoice('24h')}>
                    Show 24 hours
                  </button>
                ) : null}
              </>
            }
          />
        </div>
        <div className="multiples">
          <Mini label="Pressure (BMP180)" value={latest ? fmtPressure(latest.pressure_hpa) : '—'} points={hpa} domain={domain} />
          <Mini label="Ambient temperature" value={latest ? fmtTemp(latest.bmp_temperature_c) : '—'} points={ambient} domain={domain} />
          <Mini
            label="MQ-3 vapour (demo only)"
            value={latest ? String(latest.mq3_raw) : '—'}
            points={vapour}
            domain={domain}
          />
        </div>
      </section>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
            <h2>Incidents</h2>
            <span className="count">{assetIncidents.length} total</span>
          </div>
          <div className="list">
            {assetIncidents.length === 0 ? (
              <div className="empty">No incidents for this unit.</div>
            ) : (
              assetIncidents.map((inc) => (
                <Link
                  key={inc.id}
                  className={`attn ${inc.severity === 'critical' ? 'crit' : ''}`}
                  to={`/incidents/${inc.id}`}
                >
                  <span className="attn-bar" aria-hidden="true" />
                  <div className="attn-body">
                    <div className="attn-top">
                      <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>{severityLabel(inc.severity)}</Badge>
                      <Badge tone={inc.status === 'resolved' ? 'ok' : 'neutral'}>{statusLabel(inc.status)}</Badge>
                      <span className="attn-time">{fmtWhen(inc.detectedAt)}</span>
                    </div>
                    <div className="attn-title" style={{ marginTop: 6 }}>
                      {inc.title}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>Rules and maintenance</h2>
          </div>
          <dl className="kv" style={{ marginBottom: 18 }}>
            <dt>Safe range</dt>
            <dd>
              {t.tempMinC} to {t.tempMaxC}°C
            </dd>
            <dt>Warning at</dt>
            <dd>above {t.tempWarningC}°C</dd>
            <dt>Critical at</dt>
            <dd>{t.tempCriticalC}°C or below {t.tempMinC}°C</dd>
            <dt>SMS recipients</dt>
            <dd>{asset.smsRecipients.join(', ') || 'None yet'}</dd>
          </dl>

          {canAddMaintenanceNote(user.role) ? (
            <form className="form" onSubmit={onNote} style={{ marginBottom: 16 }}>
              <div className="field">
                <label htmlFor="asset-note">Add a maintenance note</label>
                <textarea
                  id="asset-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Inspection finding, parts replaced…"
                />
              </div>
              <div>
                <button className="btn sm" type="submit" disabled={!note.trim()}>
                  Save note
                </button>
              </div>
            </form>
          ) : null}

          <div className="list" style={{ margin: '0 -20px -20px' }}>
            {assetNotes.length === 0 ? (
              <div className="empty">No maintenance notes yet.</div>
            ) : (
              assetNotes.map((n) => (
                <div key={n.id} className="list-item" style={{ flexDirection: 'column', gap: 4 }}>
                  <strong>{n.authorName}</strong>
                  <p>{n.body}</p>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {fmtWhen(n.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function Mini({
  label,
  value,
  points,
  domain,
}: {
  label: string
  value: string
  points: ChartPoint[]
  domain: [number, number]
}) {
  return (
    <div className="multiple">
      <div className="multiple-top">
        <span>{label}</span>
        <span className="multiple-val">{value}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <Sparkline points={points} domain={domain} height={34} label={`${label} trend`} />
      </div>
    </div>
  )
}
