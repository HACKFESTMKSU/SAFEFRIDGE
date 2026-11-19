import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { Sparkline } from '../components/charts/Sparkline'
import { Badge } from '../components/ui/Badge'
import { CountUp } from '../components/ui/CountUp'
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
} from '../lib/format'
import { canAddMaintenanceNote, canCharacterizeStock } from '../lib/roles'
import { NO_READINGS, RANGE_MS, incidentMarkers, toSeries } from '../lib/telemetry'
import type { CharacterizeResult, ProduceProfile } from '../types'
import { ApiError } from '../lib/api'

/** Live asset chart uses a short window; full history is on /logs. */
const LIVE_WINDOW: keyof typeof RANGE_MS = '30m'

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
    listProduceProfiles,
    characterizeStock,
    applyProduce,
  } = useData()
  const [note, setNote] = useState('')
  const [profiles, setProfiles] = useState<ProduceProfile[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<CharacterizeResult | null>(null)
  const [manualKey, setManualKey] = useState('')
  const clock = useNow(1000)

  const asset = assets.find((a) => a.id === id)
  const rows = asset?.deviceId ? getTelemetry(asset.deviceId) : NO_READINGS
  const temps = useMemo(() => toSeries(rows, 'temperature_c'), [rows])
  const hums = useMemo(() => toSeries(rows, 'humidity_percent'), [rows])
  const amps = useMemo(() => toSeries(rows, 'current_a'), [rows])
  const hpa = useMemo(() => toSeries(rows, 'pressure_hpa'), [rows])
  const ambient = useMemo(() => toSeries(rows, 'bmp_temperature_c'), [rows])
  const vapour = useMemo(() => toSeries(rows, 'mq3_raw'), [rows])

  useEffect(() => {
    let cancelled = false
    listProduceProfiles()
      .then((rows) => {
        if (!cancelled) setProfiles(rows)
      })
      .catch(() => {
        if (!cancelled) setProfiles([])
      })
    return () => {
      cancelled = true
    }
  }, [listProduceProfiles])

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
  const domain: [number, number] = [clock - RANGE_MS[LIVE_WINDOW], clock]
  const assetIncidents = incidents
    .filter((i) => i.assetId === asset.id)
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  const assetNotes = notes.filter((n) => n.assetId === asset.id)
  const t = asset.thresholds
  const tone = tempTone(latest?.temperature_c, t)
  const produceLabel =
    profiles.find((p) => p.productKey === asset.productKey)?.label ?? asset.productKey ?? null

  function onNote(e: FormEvent) {
    e.preventDefault()
    if (!note.trim() || !asset) return
    addNote(asset.id, note.trim())
    setNote('')
  }

  async function onCharacterize(e: FormEvent) {
    e.preventDefault()
    if (!asset || !videoFile) return
    setBusy(true)
    setAgentError(null)
    try {
      const result = await characterizeStock(asset.id, videoFile)
      setLastResult(result)
      setVideoFile(null)
    } catch (err) {
      setAgentError(err instanceof ApiError ? err.message : 'Characterize failed')
    } finally {
      setBusy(false)
    }
  }

  async function onManualApply(e: FormEvent) {
    e.preventDefault()
    if (!asset || !manualKey) return
    setBusy(true)
    setAgentError(null)
    try {
      await applyProduce(asset.id, manualKey)
      setLastResult(null)
    } catch (err) {
      setAgentError(err instanceof ApiError ? err.message : 'Could not apply produce profile')
    } finally {
      setBusy(false)
    }
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
            {latest?.temperature_c != null ? (
              <>
                <CountUp value={latest.temperature_c} decimals={1} />
                <small>°C</small>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="stat-foot">
            {toneLabel(tone)} · sensor band {t.tempMinC}–{t.tempMaxC}°C
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Humidity</div>
          <div className="stat-value">
            {latest?.humidity_percent != null ? fmtPct(latest.humidity_percent) : '—'}
          </div>
          <div className="stat-foot">
            Max {t.humidityMaxPercent ?? 80}%
            <Sparkline points={hums} domain={domain} height={28} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <span
              className={`status-dot ${
                latest?.water_level != null ? (latest.water_wet ? 'warn' : 'ok') : ''
              }`}
            />
            Water level
          </div>
          <div className="stat-value">
            {latest?.water_level != null ? (
              <>
                <CountUp value={latest.water_level} decimals={0} />
                <small>%</small>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="stat-foot">
            {latest?.water_level != null
              ? `${latest.water_wet ? 'Wet' : 'Dry'} · alert at ≥${t.waterWetThreshold ?? 25}%`
              : 'No reading yet'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Compressor current</div>
          <div className="stat-value">
            {latest?.current_a != null ? fmtAmps(latest.current_a) : '—'}
          </div>
          <div className="stat-foot">
            <Sparkline points={amps} domain={domain} height={28} />
          </div>
        </div>
      </div>

      <section className="panel live-panel" aria-label="Temperature history">
        <div className="live-head">
          <div className="live-id">
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Temperature</h2>
            <span className="live-meta">
              {latest ? `Last reading ${fmtRelative(latest.timestamp)}. Showing last 30 minutes.` : 'Waiting for the first reading.'}{' '}
              {device
                ? device.lastSeen
                  ? `${device.id} last seen ${fmtRelative(device.lastSeen)}.`
                  : `${device.id} has not reported yet.`
                : ''}{' '}
              <Link to={device ? `/logs?device=${encodeURIComponent(device.id)}` : '/logs'}>
                Browse history on Logs
              </Link>
            </span>
          </div>
        </div>
        <div className="live-body">
          <LiveChart
            points={temps}
            label="Temperature"
            unit="°C"
            height={320}
            domain={domain}
            live={Boolean(device?.online)}
            band={{ min: t.tempMinC, max: t.tempMaxC, label: `Sensor band ${t.tempMinC}–${t.tempMaxC}°C` }}
            thresholds={[
              { value: t.tempWarningC, tone: 'warn', label: `Warning ${t.tempWarningC}°C` },
              { value: t.tempCriticalC, tone: 'crit', label: `Critical ${t.tempCriticalC}°C` },
            ]}
            markers={incidentMarkers(incidents, asset.id)}
            emptyText={
              <>
                No readings in the last 30 minutes.{' '}
                <Link to="/logs">Open logs</Link>
              </>
            }
          />
        </div>
        <div className="multiples">
          <Mini label="Pressure (BMP180)" value={latest ? fmtPressure(latest.pressure_hpa) : '—'} points={hpa} domain={domain} />
          <Mini label="Ambient temperature" value={latest ? fmtTemp(latest.bmp_temperature_c) : '—'} points={ambient} domain={domain} />
          <Mini
            label="MQ-3 vapour (demo only)"
            value={latest?.mq3_raw != null ? String(latest.mq3_raw) : '—'}
            points={vapour}
            domain={domain}
          />
        </div>
      </section>

      <section className="panel panel-pad" aria-label="Produce vision agent">
        <div className="panel-head">
          <h2>Produce agent</h2>
          {produceLabel ? <Badge tone="ok">{produceLabel}</Badge> : <Badge tone="neutral">No crop set</Badge>}
        </div>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Demo: upload a short storehouse / cold-room video. YOLOE-26 characterizes the crop; Claude
          adapts safe bands for the same sensors. Production will use a facility camera (ESP32-CAM).
        </p>
        <dl className="kv" style={{ marginBottom: 14 }}>
          <dt>Active crop</dt>
          <dd>{produceLabel ?? '—'}</dd>
          <dt>Agent status</dt>
          <dd>{lastResult?.status || asset.agentNotes || 'Upload a clip or pick a crop to adapt thresholds.'}</dd>
          <dt>Source</dt>
          <dd>
            {asset.detectionSource ?? '—'}
            {asset.detectionConfidence != null
              ? ` · confidence ${(asset.detectionConfidence * 100).toFixed(0)}%`
              : ''}
            {lastResult?.agentSource ? ` · ${lastResult.agentSource}` : ''}
          </dd>
          <dt>Applied band</dt>
          <dd>
            {t.tempMinC}–{t.tempMaxC}°C · humidity max {t.humidityMaxPercent ?? '—'}%
          </dd>
        </dl>
        {lastResult?.guidance ? (
          <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
            <strong>Guidance:</strong> {lastResult.guidance}
          </p>
        ) : null}
        {agentError ? (
          <p style={{ color: 'var(--crit, #b42318)', marginBottom: 12 }}>{agentError}</p>
        ) : null}
        {canCharacterizeStock(user.role) ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <form className="form" onSubmit={onCharacterize}>
              <div className="field">
                <label htmlFor="produce-video">Storehouse / cold-room video</label>
                <input
                  id="produce-video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button className="btn sm" type="submit" disabled={busy || !videoFile}>
                {busy ? 'Characterizing…' : 'Characterize stock'}
              </button>
            </form>
            <form className="form" onSubmit={onManualApply} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label htmlFor="manual-produce">Or pick produce manually</label>
                <select
                  id="manual-produce"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                >
                  <option value="">Select crop…</option>
                  {profiles.map((p) => (
                    <option key={p.productKey} value={p.productKey}>
                      {p.label} ({p.tempMinC}–{p.tempMaxC}°C)
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn secondary sm" type="submit" disabled={busy || !manualKey}>
                Apply profile
              </button>
            </form>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
            Admin or Operator can run characterization.
          </p>
        )}
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
            <dt>Temp safe band</dt>
            <dd>
              {t.tempMinC}–{t.tempMaxC}°C (same °C the sensor publishes)
            </dd>
            <dt>Warning / critical</dt>
            <dd>
              ≥{t.tempWarningC}°C / ≥{t.tempCriticalC}°C or below {t.tempMinC}°C
            </dd>
            <dt>Humidity max</dt>
            <dd>{t.humidityMaxPercent ?? 80}%</dd>
            <dt>Water wet alert</dt>
            <dd>≥{t.waterWetThreshold ?? 25}% level</dd>
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
