import { useEffect, useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import type { Asset } from '../types'

export function SettingsPage() {
  const { assets, updateThresholds } = useData()
  const [selectedId, setSelectedId] = useState('')
  const [tempMin, setTempMin] = useState(2)
  const [tempMax, setTempMax] = useState(8)
  const [tempWarn, setTempWarn] = useState(7)
  const [tempCrit, setTempCrit] = useState(10)
  const [humidity, setHumidity] = useState(70)
  const [water, setWater] = useState(500)
  const [currentMin, setCurrentMin] = useState(0.3)
  const [sms, setSms] = useState('')
  const [saved, setSaved] = useState(false)

  const selected = assets.find((a) => a.id === selectedId)

  function loadAsset(asset: Asset) {
    setSelectedId(asset.id)
    setTempMin(asset.thresholds.tempMinC)
    setTempMax(asset.thresholds.tempMaxC)
    setTempWarn(asset.thresholds.tempWarningC)
    setTempCrit(asset.thresholds.tempCriticalC)
    setHumidity(asset.thresholds.humidityMaxPercent ?? 70)
    setWater(asset.thresholds.waterWetThreshold ?? 500)
    setCurrentMin(asset.thresholds.currentMinA ?? 0.3)
    setSms(asset.smsRecipients.join(', '))
    setSaved(false)
  }

  useEffect(() => {
    if (!selectedId && assets[0]) loadAsset(assets[0])
  }, [assets, selectedId])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    await updateThresholds(
      selected.id,
      {
        tempMinC: tempMin,
        tempMaxC: tempMax,
        tempWarningC: tempWarn,
        tempCriticalC: tempCrit,
        humidityMaxPercent: humidity,
        waterWetThreshold: water,
        currentMinA: currentMin,
      },
      sms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    setSaved(true)
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h2 style={{ fontSize: '1.35rem' }}>Thresholds & SMS</h2>
          <p>
            Configure warning/critical temperature rules and SIM800L SMS
            recipients for offline critical alerts.
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-pad panel-head" style={{ marginBottom: 0 }}>
            <h2>Select asset</h2>
          </div>
          <div className="list">
            {assets.map((asset) => (
              <button
                key={asset.id}
                className="list-item"
                style={{
                  width: '100%',
                  border: 0,
                  background: asset.id === selectedId ? 'rgba(15,138,122,0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => loadAsset(asset)}
              >
                <div>
                  <strong>{asset.name}</strong>
                  <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                    {asset.thresholds.tempMinC}–{asset.thresholds.tempMaxC}°C ·{' '}
                    {asset.smsRecipients.length} SMS recipient(s)
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel panel-pad">
          {selected ? (
            <form className="form" onSubmit={onSave}>
              <h2 style={{ fontSize: '1rem' }}>{selected.name}</h2>
              <div className="field-row">
                <div className="field">
                  <label>Temp min (°C)</label>
                  <input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Temp max (°C)</label>
                  <input type="number" step="0.1" value={tempMax} onChange={(e) => setTempMax(Number(e.target.value))} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Warning ≥ (°C)</label>
                  <input type="number" step="0.1" value={tempWarn} onChange={(e) => setTempWarn(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Critical ≥ (°C)</label>
                  <input type="number" step="0.1" value={tempCrit} onChange={(e) => setTempCrit(Number(e.target.value))} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Humidity max (%)</label>
                  <input type="number" value={humidity} onChange={(e) => setHumidity(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Water wet threshold</label>
                  <input type="number" value={water} onChange={(e) => setWater(Number(e.target.value))} />
                </div>
              </div>
              <div className="field">
                <label>Min compressor current (A)</label>
                <input type="number" step="0.1" value={currentMin} onChange={(e) => setCurrentMin(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>SIM800L SMS recipients</label>
                <input
                  value={sms}
                  onChange={(e) => setSms(e.target.value)}
                  placeholder="+2547…, +2547…"
                />
              </div>
              <button className="btn" type="submit">
                Save settings
              </button>
              {saved ? (
                <p style={{ color: 'var(--ok)', fontSize: '0.9rem' }}>Saved to the database.</p>
              ) : null}
            </form>
          ) : (
            <div className="empty">Select an asset.</div>
          )}
        </section>
      </div>
    </>
  )
}
