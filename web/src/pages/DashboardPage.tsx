import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { Sparkline } from '../components/charts/Sparkline'
import { BandMeter } from '../components/charts/BandMeter'
import { Badge } from '../components/ui/Badge'
import { CountUp } from '../components/ui/CountUp'
import { useData } from '../context/DataContext'
import { useNow } from '../hooks/motion'
import {
  assetTypeLabel,
  fmtAgo,
  fmtAmps,
  fmtPct,
  fmtRelative,
  severityLabel,
  statusLabel,
  tempTone,
  toneLabel,
  tsMs,
} from '../lib/format'
import { NO_READINGS, RANGE_MS, incidentMarkers, toSeries } from '../lib/telemetry'
import type { Asset } from '../types'

/** Live dashboard always shows a short rolling window; history lives on /logs. */
const LIVE_WINDOW: keyof typeof RANGE_MS = '30m'

export function DashboardPage() {
  const { assets, devices, incidents, getLatest, getTelemetry } = useData()
  const [assetChoice, setAssetChoice] = useState<string | null>(null)

  const linked = assets.filter((a) => a.deviceId)
  const primary =
    assets.find((a) => a.id === assetChoice) ??
    assets.find((a) => a.deviceId === 'CG-001') ??
    linked[0] ??
    assets[0]
  const device = devices.find((d) => d.id === primary?.deviceId)
  const rows = primary?.deviceId ? getTelemetry(primary.deviceId) : NO_READINGS
  const latest = primary?.deviceId ? getLatest(primary.deviceId) : null

  const clock = useNow(1000)
  const domain: [number, number] = [clock - RANGE_MS[LIVE_WINDOW], clock]

  const temps = useMemo(() => toSeries(rows, 'temperature_c'), [rows])
  const hums = useMemo(() => toSeries(rows, 'humidity_percent'), [rows])
  const waters = useMemo(() => toSeries(rows, 'water_level'), [rows])
  const amps = useMemo(() => toSeries(rows, 'current_a'), [rows])

  const openIncidents = incidents
    .filter((i) => i.status !== 'resolved')
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  const critical = openIncidents.filter((i) => i.severity === 'critical').length
  const online = devices.filter((d) => d.online).length
  const lastHeartbeat = devices.reduce<number | null>((acc, d) => {
    if (!d.lastSeen) return acc
    const t = tsMs(d.lastSeen)
    return t > 0 && (acc == null || t > acc) ? t : acc
  }, null)

  // Share of the last 24h of readings that sat inside each unit's safe band.
  const minute = Math.floor(clock / 60_000)
  const inRange = useMemo(() => {
    let total = 0
    let ok = 0
    const since = minute * 60_000 - RANGE_MS['24h']
    for (const a of assets) {
      if (!a.deviceId) continue
      for (const r of getTelemetry(a.deviceId)) {
        if (tsMs(r.timestamp) < since) continue
        total += 1
        const temp = r.temperature_c
        if (temp == null) continue
        if (temp >= a.thresholds.tempMinC && temp <= a.thresholds.tempMaxC) ok += 1
      }
    }
    return total ? { pct: (ok / total) * 100, total } : null
  }, [assets, getTelemetry, minute])

  const tone = primary ? tempTone(latest?.temperature_c, primary.thresholds) : undefined
  const t = primary?.thresholds
  const markers = incidentMarkers(incidents, primary?.id)

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Operations</h2>
          <p>
            {online
              ? 'Live readings and open incidents across every cold unit.'
              : 'No ESP32 devices are reporting right now. Figures below are last known values from the API.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary" to="/logs">
            View logs
          </Link>
          <Link className="btn secondary" to="/incidents">
            View incidents
          </Link>
        </div>
      </div>

      <div className="stats">
        <Link className="stat" to="/incidents">
          <div className="stat-label">
            <span className={`status-dot ${critical ? 'crit' : openIncidents.length ? 'warn' : 'ok'}`} />
            Open incidents
          </div>
          <div className={`stat-value ${critical ? 'crit' : ''}`}>
            <CountUp value={openIncidents.length} />
          </div>
          <div className="stat-foot">
            {critical ? `${critical} critical, act now` : openIncidents.length ? 'Warnings only' : 'All clear'}
          </div>
        </Link>
        <Link className="stat" to="/assets">
          <div className="stat-label">Units monitored</div>
          <div className="stat-value">
            <CountUp value={assets.length} />
          </div>
          <div className="stat-foot">
            {assets.filter((a) => a.status === 'active').length} active, {linked.length} with a sensor
          </div>
        </Link>
        <div className="stat">
          <div className="stat-label">
            <span
              className={`status-dot ${
                !devices.length ? 'warn' : online === 0 ? 'crit' : online === devices.length ? 'ok' : 'warn'
              }`}
            />
            Devices online
          </div>
          <div className="stat-value">
            <CountUp value={online} />
            <small>/ {devices.length}</small>
          </div>
          <div className="stat-foot">
            {!devices.length
              ? 'No devices registered yet'
              : online === 0
                ? lastHeartbeat
                  ? `All offline · last heartbeat ${fmtAgo(lastHeartbeat, clock)}`
                  : 'All offline · waiting for MQTT'
                : lastHeartbeat
                  ? `Last heartbeat ${fmtAgo(lastHeartbeat, clock)}`
                  : 'Reporting now'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Readings in safe range</div>
          <div className="stat-value">
            {inRange ? (
              <>
                <CountUp value={inRange.pct} />
                <small>%</small>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="stat-foot">
            {inRange ? `${inRange.total} readings, last 24 hours` : 'No readings in the last 24 hours'}
          </div>
        </div>
      </div>

      <div className="dash-main">
        <section className="panel live-panel" aria-label="Live unit">
          {primary && t ? (
            <>
              <div className="live-head">
                <div className="live-id">
                  <select
                    className="select-pill"
                    aria-label="Choose a unit"
                    value={primary.id}
                    onChange={(e) => setAssetChoice(e.target.value)}
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.deviceId}>
                        {a.name}
                        {a.deviceId ? '' : ' (no sensor)'}
                      </option>
                    ))}
                  </select>
                  <div className="live-metrics" aria-label="Live sensor readings">
                    <div className="live-metric">
                      <span className="live-metric-label">Temperature</span>
                      <div className="live-reading">
                        <span className={`live-value ${tone === 'crit' ? 'crit' : ''}`}>
                          {latest?.temperature_c != null ? (
                            <>
                              <CountUp value={latest.temperature_c} decimals={1} />
                              °C
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                        <Badge tone={tone ?? 'neutral'} dot>
                          {toneLabel(tone)}
                        </Badge>
                      </div>
                      <span className="live-metric-foot">
                        Band {t.tempMinC}–{t.tempMaxC}°C
                      </span>
                    </div>
                    <div className="live-metric">
                      <span className="live-metric-label">Humidity</span>
                      <div className="live-reading">
                        <span className="live-value live-value-sm">
                          {latest?.humidity_percent != null ? fmtPct(latest.humidity_percent) : '—'}
                        </span>
                      </div>
                      <span className="live-metric-foot">Max {t.humidityMaxPercent ?? 80}%</span>
                    </div>
                    <div className="live-metric">
                      <span className="live-metric-label">Water level</span>
                      <div className="live-reading">
                        <span className={`live-value live-value-sm ${latest?.water_wet ? 'crit' : ''}`}>
                          {latest?.water_level != null ? fmtPct(latest.water_level) : '—'}
                        </span>
                        {latest?.water_level != null ? (
                          <Badge tone={latest.water_wet ? 'warn' : 'ok'} dot>
                            {latest.water_wet ? 'Wet' : 'Dry'}
                          </Badge>
                        ) : null}
                      </div>
                      <span className="live-metric-foot">
                        Wet ≥{t.waterWetThreshold ?? 25}%
                      </span>
                    </div>
                  </div>
                  <span className="live-meta">
                    {device && !device.online ? (
                      <>
                        <Badge tone="warn" dot>
                          Offline
                        </Badge>{' '}
                      </>
                    ) : null}
                    {latest
                      ? device?.online
                        ? `Last update ${fmtRelative(latest.timestamp)}. Showing last 30 minutes.`
                        : `Last known reading ${fmtRelative(latest.timestamp)} · device not reporting.`
                      : 'Waiting for the first reading.'}{' '}
                    <Link to="/logs">Browse history on Logs</Link>
                  </span>
                </div>
              </div>

              <div className="live-body">
                <LiveChart
                  points={temps}
                  label="Temperature"
                  unit="°C"
                  height={300}
                  domain={domain}
                  live={Boolean(device?.online)}
                  band={{ min: t.tempMinC, max: t.tempMaxC, label: `Sensor band ${t.tempMinC}–${t.tempMaxC}°C` }}
                  thresholds={[
                    { value: t.tempWarningC, tone: 'warn', label: `Warning ${t.tempWarningC}°C` },
                    { value: t.tempCriticalC, tone: 'crit', label: `Critical ${t.tempCriticalC}°C` },
                  ]}
                  markers={markers}
                  emptyText={
                    <>
                      No readings in the last 30 minutes.{' '}
                      {device
                        ? device.lastSeen
                          ? `${device.id} last reported ${fmtRelative(device.lastSeen)}.`
                          : `${device.id} has not reported yet.`
                        : ''}{' '}
                      <Link to="/logs">Open logs</Link>
                    </>
                  }
                />
              </div>

              <div className={`multiples${(latest?.current_a ?? 0) > 0.05 ? '' : ' multiples-2'}`}>
                <Multiple
                  label="Humidity trend"
                  value={latest?.humidity_percent != null ? fmtPct(latest.humidity_percent) : '—'}
                  points={hums}
                  domain={domain}
                />
                <Multiple
                  label="Water level trend"
                  value={
                    latest?.water_level != null
                      ? `${fmtPct(latest.water_level)}${latest.water_wet ? ' · wet' : ' · dry'}`
                      : '—'
                  }
                  points={waters}
                  domain={domain}
                />
                {latest?.current_a != null && latest.current_a > 0.05 ? (
                  <Multiple
                    label="Compressor current"
                    value={fmtAmps(latest.current_a)}
                    points={amps}
                    domain={domain}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty">Add an asset and link a device to see live readings.</div>
          )}
        </section>

        <section className="panel" aria-label="Needs attention">
          <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
            <h2>Needs attention</h2>
            <span className="count">{openIncidents.length} open</span>
          </div>
          <div className="list">
            {openIncidents.length === 0 ? (
              <div className="empty">Nothing needs attention. Every unit is in range.</div>
            ) : (
              openIncidents.slice(0, 6).map((inc) => {
                const asset = assets.find((a) => a.id === inc.assetId)
                return (
                  <Link
                    key={inc.id}
                    className={`attn ${inc.severity === 'critical' ? 'crit' : ''}`}
                    to={`/incidents/${inc.id}`}
                  >
                    <span className="attn-bar" aria-hidden="true" />
                    <div className="attn-body">
                      <div className="attn-top">
                        <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>
                          {severityLabel(inc.severity)}
                        </Badge>
                        <span className="attn-time">{fmtAgo(tsMs(inc.detectedAt), clock)}</span>
                      </div>
                      <div className="attn-title" style={{ marginTop: 6 }}>
                        {inc.title}
                      </div>
                      <div className="attn-meta">
                        {asset?.name ?? 'Unknown unit'}, {statusLabel(inc.status).toLowerCase()}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
          {openIncidents.length > 6 ? (
            <div className="panel-pad" style={{ paddingTop: 12 }}>
              <Link className="btn secondary sm" to="/incidents">
                See all {openIncidents.length}
              </Link>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel" aria-label="All units">
        <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
          <h2>All units</h2>
          <span className="count">Position inside each safe range</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Type</th>
                <th>Location</th>
                <th>Temperature</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <UnitRow key={asset.id} asset={asset} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function UnitRow({ asset }: { asset: Asset }) {
  const { devices, getLatest } = useData()
  const reading = asset.deviceId ? getLatest(asset.deviceId) : null
  const dev = devices.find((d) => d.id === asset.deviceId)
  const tone = tempTone(reading?.temperature_c, asset.thresholds)
  return (
    <tr>
      <td>
        <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
      </td>
      <td>{assetTypeLabel(asset.type)}</td>
      <td>{asset.location}</td>
      <td>
        <BandMeter
          value={reading?.temperature_c ?? null}
          min={asset.thresholds.tempMinC}
          max={asset.thresholds.tempMaxC}
          tone={tone}
        />
      </td>
      <td>
        {dev ? (
          <Badge tone={dev.online ? 'ok' : 'neutral'} dot>
            {dev.id}
          </Badge>
        ) : (
          <Badge tone="warn">No sensor</Badge>
        )}
      </td>
      <td>
        <Badge tone={asset.status === 'active' ? 'ok' : 'neutral'}>{asset.status}</Badge>
      </td>
    </tr>
  )
}

function Multiple({
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
