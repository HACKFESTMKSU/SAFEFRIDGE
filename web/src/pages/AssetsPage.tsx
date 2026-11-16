import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { assetTypeLabel, fmtTemp } from '../lib/format'
import { canManageAssets } from '../lib/roles'
import type { Asset, AssetType } from '../types'

export function AssetsPage() {
  const { user } = useAuth()
  const { assets, devices, getLatest, upsertAsset } = useData()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('refrigerator')
  const [location, setLocation] = useState('')
  const [tempMin, setTempMin] = useState(18)
  const [tempMax, setTempMax] = useState(28)

  if (!user) return null
  const admin = canManageAssets(user.role)

  function onCreate(e: FormEvent) {
    e.preventDefault()
    const asset: Asset = {
      id: `ast-${Date.now()}`,
      name,
      type,
      location,
      status: 'active',
      deviceId: null,
      smsRecipients: [],
      thresholds: {
        tempMinC: tempMin,
        tempMaxC: tempMax,
        tempWarningC: tempMax - 1,
        tempCriticalC: tempMax + 2,
        humidityMaxPercent: 80,
        waterWetThreshold: 25,
      },
    }
    upsertAsset(asset)
    setShowForm(false)
    setName('')
    setLocation('')
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Assets</h2>
          <p>Refrigerators, freezers, and cold boxes under monitoring.</p>
        </div>
        {admin ? (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> {showForm ? 'Close' : 'Add asset'}
          </button>
        ) : null}
      </div>

      {showForm && admin ? (
        <section className="panel panel-pad">
          <h2 style={{ marginBottom: '0.85rem', fontSize: '1rem' }}>New asset</h2>
          <form className="form" onSubmit={onCreate}>
            <div className="field-row">
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as AssetType)}>
                  <option value="refrigerator">Refrigerator</option>
                  <option value="freezer">Freezer</option>
                  <option value="cold_box">Cold box</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Safe temp min (°C)</label>
                <input
                  type="number"
                  value={tempMin}
                  onChange={(e) => setTempMin(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Safe temp max (°C)</label>
                <input
                  type="number"
                  value={tempMax}
                  onChange={(e) => setTempMax(Number(e.target.value))}
                />
              </div>
            </div>
            <button className="btn" type="submit">
              Create asset
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
                <th>Type</th>
                <th>Location</th>
                <th>Latest temp</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const reading = asset.deviceId ? getLatest(asset.deviceId) : null
                const device = devices.find((d) => d.id === asset.deviceId)
                return (
                  <tr key={asset.id}>
                    <td>
                      <Link
                        to={`/assets/${asset.id}`}
                      >
                        {asset.name}
                      </Link>
                    </td>
                    <td>{assetTypeLabel(asset.type)}</td>
                    <td>{asset.location}</td>
                    <td className="mono">{fmtTemp(reading?.temperature_c)}</td>
                    <td>{device ? device.id : '—'}</td>
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
