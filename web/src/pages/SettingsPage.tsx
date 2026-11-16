import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import type { Asset } from '../types'

export function SettingsPage() {
  const { assets, updateThresholds } = useData()
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? '')
  const selected = assets.find((a) => a.id === selectedId)

  const [tempMin, setTempMin] = useState(selected?.thresholds.tempMinC ?? 18)
  const [tempMax, setTempMax] = useState(selected?.thresholds.tempMaxC ?? 28)
  const [tempWarn, setTempWarn] = useState(selected?.thresholds.tempWarningC ?? 30)
  const [tempCrit, setTempCrit] = useState(selected?.thresholds.tempCriticalC ?? 35)
  const [humidity, setHumidity] = useState(selected?.thresholds.humidityMaxPercent ?? 80)
  const [water, setWater] = useState(selected?.thresholds.waterWetThreshold ?? 25)
  const [currentMin, setCurrentMin] = useState(selected?.thresholds.currentMinA ?? 0.3)
  const [sms, setSms] = useState(selected?.smsRecipients.join(', ') ?? '')
  const [saved, setSaved] = useState(false)

  function loadAsset(asset: Asset) {
    setSelectedId(asset.id)
    setTempMin(asset.thresholds.tempMinC)
    setTempMax(asset.thresholds.tempMaxC)
    setTempWarn(asset.thresholds.tempWarningC)
    setTempCrit(asset.thresholds.tempCriticalC)
    setHumidity(asset.thresholds.humidityMaxPercent ?? 80)
    setWater(asset.thresholds.waterWetThreshold ?? 25)
    setCurrentMin(asset.thresholds.currentMinA ?? 0.3)
    setSms(asset.smsRecipients.join(', '))
    setSaved(false)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaved(false)
    try {
      await updateThresholds(
        selected.id,
        {
          tempMinC: tempMin,
          tempMaxC: tempMax,
          tempWarningC: tempWarn,
          tempCriticalC: tempCrit,
          humidityMaxPercent: humidity,
          waterWetThreshold: water,
          currentMinA: currentMin > 0 ? currentMin : undefined,
        },
        sms
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Thresholds & SMS</h2>
          <p>
            Thresholds use the same units the sensor publishes: temperature °C,
            humidity %, water level 0–100%. Set the safe band around real readings
            so status stays clear.
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
                  background: asset.id === selectedId ? 'var(--band)' : 'transparent',
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
                  <label>Safe temp min (°C)</label>
                  <input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Safe temp max (°C)</label>
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
                  <label>Water wet ≥ (%)</label>
                  <input type="number" min={0} max={100} value={water} onChange={(e) => setWater(Number(e.target.value))} />
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
                <p style={{ color: 'var(--ok)', fontSize: '0.9rem' }}>
                  Saved. Dashboard bands now use these same units as the sensor.
                </p>
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
