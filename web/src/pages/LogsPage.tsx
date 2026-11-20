import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Segmented } from '../components/ui/Segmented'
import { useData } from '../context/DataContext'
import { useNow } from '../hooks/motion'
import {
  fmtAmps,
  fmtPct,
  fmtTemp,
  fmtWhen,
  severityLabel,
  statusLabel,
  tsMs,
} from '../lib/format'
import { RANGE_MS, type Range } from '../lib/telemetry'
import type { Incident, TelemetryReading } from '../types'

type LogKind = 'telemetry' | 'incidents' | 'all'

interface TelemetryLogRow {
  kind: 'telemetry'
  id: string
  at: string
  deviceId: string
  assetName: string
  reading: TelemetryReading
}

interface IncidentLogRow {
  kind: 'incident'
  id: string
  at: string
  deviceId: string | null
  assetName: string
  incident: Incident
}

type LogRow = TelemetryLogRow | IncidentLogRow

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '30m', label: '30 min' },
  { value: '6h', label: '6 h' },
  { value: '24h', label: '24 h' },
]

const KIND_OPTIONS: { value: LogKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'telemetry', label: 'Readings' },
  { value: 'incidents', label: 'Incidents' },
]

export function LogsPage() {
  const { assets, devices, incidents, getTelemetry } = useData()
  const [params, setParams] = useSearchParams()
  const clock = useNow(30_000)

  const range = (['30m', '6h', '24h'] as const).includes(params.get('range') as Range)
    ? (params.get('range') as Range)
    : '24h'
  const kind = (['all', 'telemetry', 'incidents'] as const).includes(params.get('kind') as LogKind)
    ? (params.get('kind') as LogKind)
    : 'all'
  const deviceFilter = params.get('device') || 'all'

  const setRange = (value: Range) => {
    const next = new URLSearchParams(params)
    next.set('range', value)
    setParams(next, { replace: true })
  }
  const setKind = (value: LogKind) => {
    const next = new URLSearchParams(params)
    next.set('kind', value)
    setParams(next, { replace: true })
  }
  const setDevice = (value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete('device')
    else next.set('device', value)
    setParams(next, { replace: true })
  }

  const since = clock - RANGE_MS[range]

  const rows = useMemo(() => {
    const out: LogRow[] = []
    const deviceIds =
      deviceFilter === 'all' ? devices.map((d) => d.id) : devices.filter((d) => d.id === deviceFilter).map((d) => d.id)

    if (kind === 'all' || kind === 'telemetry') {
      for (const deviceId of deviceIds) {
        const asset = assets.find((a) => a.deviceId === deviceId)
        for (const reading of getTelemetry(deviceId)) {
          if (tsMs(reading.timestamp) < since) continue
          out.push({
            kind: 'telemetry',
            id: `tel-${deviceId}-${reading.timestamp}`,
            at: reading.timestamp,
            deviceId,
            assetName: asset?.name ?? '—',
            reading,
          })
        }
      }
    }

    if (kind === 'all' || kind === 'incidents') {
      for (const incident of incidents) {
        if (tsMs(incident.detectedAt) < since) continue
        const asset = assets.find((a) => a.id === incident.assetId)
        const deviceId = asset?.deviceId ?? null
        if (deviceFilter !== 'all' && deviceId !== deviceFilter) continue
        out.push({
          kind: 'incident',
          id: `inc-${incident.id}`,
          at: incident.detectedAt,
          deviceId,
          assetName: asset?.name ?? incident.assetId,
          incident,
        })
      }
    }

    return out.sort((a, b) => b.at.localeCompare(a.at))
  }, [assets, devices, incidents, getTelemetry, since, kind, deviceFilter])

  const readingCount = rows.filter((r) => r.kind === 'telemetry').length
  const incidentCount = rows.filter((r) => r.kind === 'incident').length

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Logs</h2>
          <p>Sensor readings and incidents for a chosen time window. Live charts stay on the dashboard.</p>
        </div>
        <Segmented label="Time window" value={range} onChange={setRange} options={RANGE_OPTIONS} />
      </div>

      <div className="page-intro logs-filters" style={{ marginTop: -8 }}>
        <Segmented label="Log type" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <label className="field logs-device-filter" style={{ margin: 0 }}>
          <span className="sr-only">Device</span>
          <select
            className="select-pill"
            aria-label="Filter by device"
            value={deviceFilter}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="all">All devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id}
                {d.online ? ' · online' : ' · offline'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="panel">
        <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
          <h2>Activity</h2>
          <span className="count">
            {readingCount} reading{readingCount === 1 ? '' : 's'}
            {kind !== 'telemetry' ? ` · ${incidentCount} incident${incidentCount === 1 ? '' : 's'}` : ''}
            {` · last ${RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range}`}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Unit / device</th>
                <th>Detail</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Water</th>
                <th>Current</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      No log entries in this window.
                      {devices.length === 0
                        ? ' Register a device and wait for MQTT readings.'
                        : ' Try a wider time range or another device.'}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) =>
                  row.kind === 'telemetry' ? (
                    <tr key={row.id}>
                      <td className="mono">{fmtWhen(row.at)}</td>
                      <td>
                        <Badge tone="neutral">Reading</Badge>
                      </td>
                      <td>
                        <div>{row.assetName}</div>
                        <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {row.deviceId}
                        </div>
                      </td>
                      <td>
                        {row.reading.quality && row.reading.quality !== 'ok' ? (
                          <Badge tone="warn">{row.reading.quality}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fmtTemp(row.reading.temperature_c)}</td>
                      <td>{fmtPct(row.reading.humidity_percent)}</td>
                      <td>
                        {row.reading.water_level != null ? (
                          <>
                            {fmtPct(row.reading.water_level)}
                            {row.reading.water_wet ? ' · wet' : ''}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fmtAmps(row.reading.current_a)}</td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td className="mono">{fmtWhen(row.at)}</td>
                      <td>
                        <Badge tone={row.incident.severity === 'critical' ? 'crit' : 'warn'}>
                          Incident
                        </Badge>
                      </td>
                      <td>
                        <div>{row.assetName}</div>
                        <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {row.deviceId ?? '—'}
                        </div>
                      </td>
                      <td>
                        <Link to={`/incidents/${row.incident.id}`}>{row.incident.title}</Link>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                          {severityLabel(row.incident.severity)} · {statusLabel(row.incident.status)}
                        </div>
                      </td>
                      <td colSpan={4}>—</td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
