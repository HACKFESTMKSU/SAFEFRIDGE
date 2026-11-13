import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Droplets,
  Gauge,
  Thermometer,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { MetricTile } from '../components/ui/MetricTile'
import { Badge } from '../components/ui/Badge'
import { useData } from '../context/DataContext'
import {
  assetTypeLabel,
  fmtAmps,
  fmtPct,
  fmtRelative,
  fmtTemp,
  severityLabel,
  statusLabel,
} from '../lib/format'

export function DashboardPage() {
  const { assets, devices, incidents, getLatest } = useData()
  const openIncidents = incidents.filter((i) => i.status !== 'resolved')
  const online = devices.filter((d) => d.online).length

  const primary = assets.find((a) => a.deviceId === 'CG-001') ?? assets[0]
  const latest = primary?.deviceId ? getLatest(primary.deviceId) : null
  const device = devices.find((d) => d.id === primary?.deviceId)

  const tempTone =
    latest && primary
      ? latest.temperature_c >= primary.thresholds.tempCriticalC
        ? 'crit'
        : latest.temperature_c >= primary.thresholds.tempWarningC
          ? 'warn'
          : 'ok'
      : undefined

  return (
    <>
      <div className="page-intro">
        <div>
          <h2 style={{ fontSize: '1.35rem' }}>Operations overview</h2>
          <p>
            Live climate, compressor current, and leak status for your cold
            units — plus open incidents that need attention.
          </p>
        </div>
        <Link className="btn secondary" to="/incidents">
          <AlertTriangle size={16} /> View incidents
        </Link>
      </div>

      <div className="grid grid-4">
        <MetricTile
          label="Open incidents"
          value={String(openIncidents.length)}
          hint={`${incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length} critical`}
          icon={<AlertTriangle size={15} />}
          tone={openIncidents.length ? 'warn' : 'ok'}
        />
        <MetricTile
          label="Assets"
          value={String(assets.length)}
          hint={`${assets.filter((a) => a.status === 'active').length} active`}
          icon={<Gauge size={15} />}
        />
        <MetricTile
          label="Devices online"
          value={`${online}/${devices.length}`}
          hint="ESP32 last-seen heartbeat"
          icon={<Wifi size={15} />}
          tone={online === devices.length ? 'ok' : 'warn'}
        />
        <MetricTile
          label="Primary unit"
          value={latest ? fmtTemp(latest.temperature_c) : '—'}
          hint={primary?.name ?? 'No asset'}
          icon={<Thermometer size={15} />}
          tone={tempTone}
        />
      </div>

      <div className="grid grid-2">
        <section className="panel panel-pad">
          <div className="panel-head">
            <h2>{primary?.name ?? 'Asset'} · live</h2>
            {device ? (
              <Badge tone={device.online ? 'ok' : 'neutral'} dot>
                {device.online ? 'Online' : 'Offline'}
              </Badge>
            ) : null}
          </div>
          {latest && primary ? (
            <div className="grid grid-2">
              <MetricTile
                label="DHT11 temperature"
                value={fmtTemp(latest.temperature_c)}
                hint={`Range ${primary.thresholds.tempMinC}–${primary.thresholds.tempMaxC}°C`}
                tone={tempTone}
              />
              <MetricTile
                label="Humidity"
                value={fmtPct(latest.humidity_percent)}
                icon={<Droplets size={15} />}
              />
              <MetricTile
                label="ACS712 current"
                value={fmtAmps(latest.current_a)}
                hint="Compressor / load proxy"
              />
              <MetricTile
                label="Water sensor"
                value={latest.water_wet ? 'Wet' : 'Dry'}
                hint={`Level ${latest.water_level}`}
                tone={latest.water_wet ? 'warn' : 'ok'}
              />
              <MetricTile
                label="BMP180 pressure"
                value={`${latest.pressure_hpa.toFixed(1)} hPa`}
                hint={`Ambient ${fmtTemp(latest.bmp_temperature_c)}`}
              />
              <MetricTile
                label="Last seen"
                value={device ? fmtRelative(device.lastSeen) : '—'}
                hint={device?.id}
                icon={device?.online ? <Wifi size={15} /> : <WifiOff size={15} />}
              />
            </div>
          ) : (
            <div className="empty">No telemetry for this asset yet.</div>
          )}
          {primary ? (
            <div style={{ marginTop: '1rem' }}>
              <Link className="btn secondary sm" to={`/assets/${primary.id}`}>
                Open asset detail
              </Link>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
            <h2>Needs attention</h2>
          </div>
          <div className="list">
            {openIncidents.length === 0 ? (
              <div className="empty">No open incidents.</div>
            ) : (
              openIncidents.slice(0, 5).map((inc) => {
                const asset = assets.find((a) => a.id === inc.assetId)
                return (
                  <Link key={inc.id} className="list-item" to={`/incidents/${inc.id}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>
                          {severityLabel(inc.severity)}
                        </Badge>
                        <Badge tone="neutral">{statusLabel(inc.status)}</Badge>
                      </div>
                      <strong>{inc.title}</strong>
                      <p style={{ color: 'var(--ink-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                        {asset?.name} · {fmtRelative(inc.detectedAt)}
                      </p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
          <h2>All assets</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Temp</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const reading = asset.deviceId ? getLatest(asset.deviceId) : null
                const dev = devices.find((d) => d.id === asset.deviceId)
                return (
                  <tr key={asset.id}>
                    <td>
                      <Link to={`/assets/${asset.id}`} style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>
                        {asset.name}
                      </Link>
                    </td>
                    <td>{assetTypeLabel(asset.type)}</td>
                    <td>{asset.location}</td>
                    <td className="mono">{reading ? fmtTemp(reading.temperature_c) : '—'}</td>
                    <td>
                      {dev ? (
                        <Badge tone={dev.online ? 'ok' : 'neutral'} dot>
                          {dev.id}
                        </Badge>
                      ) : (
                        <Badge tone="warn">Unlinked</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={asset.status === 'active' ? 'ok' : 'neutral'}>
                        {asset.status}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
