import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { Sparkline } from '../components/charts/Sparkline'
import { BandMeter } from '../components/charts/BandMeter'
import { Badge } from '../components/ui/Badge'
import { CountUp } from '../components/ui/CountUp'
import { Segmented } from '../components/ui/Segmented'
import { useData } from '../context/DataContext'
import { useNow } from '../hooks/motion'
import {
  assetTypeLabel,
  fmtAgo,
  fmtAmps,
  fmtPct,
  fmtPressure,
  fmtRelative,
  severityLabel,
  statusLabel,
  tempTone,
  toneLabel,
  tsMs,
} from '../lib/format'
import { NO_READINGS, RANGE_MS, incidentMarkers, toSeries, type Range } from '../lib/telemetry'
import type { Asset } from '../types'

export function DashboardPage() {
  const { assets, devices, incidents, getLatest, getTelemetry } = useData()
  const [assetChoice, setAssetChoice] = useState<string | null>(null)
  const [rangeChoice, setRangeChoice] = useState<Range | null>(null)

  const linked = assets.filter((a) => a.deviceId)
  const primary =
    assets.find((a) => a.id === assetChoice) ??
    assets.find((a) => a.deviceId === 'CG-001') ??
    linked[0] ??
    assets[0]
  const device = devices.find((d) => d.id === primary?.deviceId)
  const rows = primary?.deviceId ? getTelemetry(primary.deviceId) : NO_READINGS
  const latest = primary?.deviceId ? getLatest(primary.deviceId) : null
  const latestAt = latest ? tsMs(latest.timestamp) : null

  const clock = useNow(1000)
  // Default to the live window only when the unit is actually reporting.
  const range: Range = rangeChoice ?? (latestAt && clock - latestAt < RANGE_MS['30m'] ? '30m' : '24h')
  const domain: [number, number] = [clock - RANGE_MS[range], clock]

  const temps = useMemo(() => toSeries(rows, 'temperature_c'), [rows])
  const hums = useMemo(() => toSeries(rows, 'humidity_percent'), [rows])
  const amps = useMemo(() => toSeries(rows, 'current_a'), [rows])
  const hpa = useMemo(() => toSeries(rows, 'pressure_hpa'), [rows])

  const openIncidents = incidents
    .filter((i) => i.status !== 'resolved')
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  const critical = openIncidents.filter((i) => i.severity === 'critical').length
  const online = devices.filter((d) => d.online).length
  const lastHeartbeat = devices.reduce<number | null>((acc, d) => {
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
        if (r.temperature_c >= a.thresholds.tempMinC && r.temperature_c <= a.thresholds.tempMaxC) ok += 1
      }
    }
    return total ? { pct: (ok / total) * 100, total } : null
  }, [assets, getTelemetry, minute])

  const tone = primary ? tempTone(latest?.temperature_c, primary.thresholds) : undefined
  const t = primary?.thresholds
  const markers = incidentMarkers(incidents, primary?.id)

  const rangeOptions = [
    {
      value: '30m' as const,
      label: (
        <>
          {device?.online ? <span className="seg-live" aria-hidden="true" /> : null}
          30 min
        </>
      ),
    },
    { value: '6h' as const, label: '6 h' },
    { value: '24h' as const, label: '24 h' },
  ]

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Operations</h2>
          <p>Live readings and open incidents across every cold unit.</p>
        </div>
        <Link className="btn secondary" to="/incidents">
          View incidents
        </Link>
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
            <span className={`status-dot ${online === devices.length && devices.length ? 'ok' : 'warn'}`} />
            Devices online
          </div>
          <div className="stat-value">
            <CountUp value={online} />
            <small>/ {devices.length}</small>
          </div>
          <div className="stat-foot">
            {lastHeartbeat ? `Last heartbeat ${fmtAgo(lastHeartbeat, clock)}` : 'No heartbeat yet'}
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
                  <div className="live-reading">
                    <span className={`live-value ${tone === 'crit' ? 'crit' : ''}`}>
                      {latest ? (
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
                  <span className="live-meta">
                    Safe between {t.tempMinC} and {t.tempMaxC}°C.{' '}
                    {latest ? `Last reading ${fmtRelative(latest.timestamp)}.` : 'Waiting for the first reading.'}
                  </span>
                </div>
                <div className="live-controls">
                  <Segmented
                    label="Time window"
                    options={rangeOptions}
                    value={range}
                    onChange={setRangeChoice}
                  />
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
                  band={{ min: t.tempMinC, max: t.tempMaxC, label: `Safe ${t.tempMinC} to ${t.tempMaxC}°C` }}
                  thresholds={[
                    { value: t.tempWarningC, tone: 'warn', label: `Warning ${t.tempWarningC}°C` },
                    { value: t.tempCriticalC, tone: 'crit', label: `Critical ${t.tempCriticalC}°C` },
                  ]}
                  markers={markers}
                  showTable
                  emptyText={
                    <>
                      No readings in this window.{' '}
                      {device ? `${device.id} last reported ${fmtRelative(device.lastSeen)}.` : ''}
                      {range !== '24h' ? (
                        <>
                          {' '}
                          <button type="button" className="btn secondary sm" onClick={() => setRangeChoice('24h')}>
                            Show 24 hours
                          </button>
                        </>
                      ) : null}
                    </>
                  }
                />
              </div>

              <div className="multiples">
                <Multiple
                  label="Humidity"
                  value={latest ? fmtPct(latest.humidity_percent) : '—'}
                  points={hums}
                  domain={domain}
                />
                <Multiple
                  label="Compressor current"
                  value={latest ? fmtAmps(latest.current_a) : '—'}
                  points={amps}
                  domain={domain}
                />
                <Multiple
                  label="Pressure"
                  value={latest ? fmtPressure(latest.pressure_hpa) : '—'}
                  points={hpa}
                  domain={domain}
                />
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
          value={reading ? reading.temperature_c : null}
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
