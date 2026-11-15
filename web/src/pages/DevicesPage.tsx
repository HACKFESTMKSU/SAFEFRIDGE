import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { useData } from '../context/DataContext'
import { fmtRelative } from '../lib/format'

export function DevicesPage() {
  const { devices, assets, linkDevice } = useData()
  const [linking, setLinking] = useState<string | null>(null)

  return (
    <>
      <div className="page-intro">
        <div>
          <h2 style={{ fontSize: '1.35rem' }}>Devices</h2>
          <p>
            ESP32 edge units (CG-xxx). Link a device to one asset. Online status
            comes from last MQTT heartbeat.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Firmware</th>
                <th>Status</th>
                <th>Last seen</th>
                <th>Linked asset</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const asset = assets.find((a) => a.id === device.assetId)
                return (
                  <tr key={device.id}>
                    <td className="mono">{device.id}</td>
                    <td>{device.name}</td>
                    <td className="mono">{device.firmwareVersion}</td>
                    <td>
                      <Badge tone={device.online ? 'ok' : 'neutral'} dot>
                        {device.online ? 'Online' : 'Offline'}
                      </Badge>
                    </td>
                    <td>{fmtRelative(device.lastSeen)}</td>
                    <td>{asset?.name ?? '—'}</td>
                    <td>
                      {linking === device.id ? (
                        <select
                          defaultValue={device.assetId ?? ''}
                          onChange={(e) => {
                            const value = e.target.value || null
                            void linkDevice(device.id, value)
                            setLinking(null)
                          }}
                          onBlur={() => setLinking(null)}
                          autoFocus
                        >
                          <option value="">Unlinked</option>
                          {assets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          className="btn secondary sm"
                          onClick={() => setLinking(device.id)}
                        >
                          Link
                        </button>
                      )}
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
