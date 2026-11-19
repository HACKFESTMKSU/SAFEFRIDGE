import { useEffect, useReducer, useRef, useState } from 'react'
import { LiveChart } from '../charts/LiveChart'
import { Sparkline } from '../charts/Sparkline'
import { useVisible } from '../../hooks/motion'
import { tempTone, toneLabel } from '../../lib/format'
import { LIMITS, SIM_SPEED, SIM_TICK_MS, initialSim, simMarkers, simReducer, type SimAlert, type SimIncident } from './sim'

const WINDOW = 60 * 60_000
const THRESHOLDS = [
  { value: LIMITS.warn, tone: 'warn' as const, label: `Warning ${LIMITS.warn}°C` },
  { value: LIMITS.crit, tone: 'crit' as const, label: `Critical ${LIMITS.crit}°C` },
]
const BAND = { min: LIMITS.min, max: LIMITS.max, label: `Safe ${LIMITS.min} to ${LIMITS.max}°C` }
const FRIDGE_LIMITS = { tempMinC: LIMITS.min, tempMaxC: LIMITS.max, tempWarningC: LIMITS.warn, tempCriticalC: LIMITS.crit }

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))
const clock = (ms: number) => {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function Toggle({
  label,
  good,
  goodText,
  badText,
  hint,
  onClick,
}: {
  label: string
  good: boolean
  goodText: string
  badText: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`sim-toggle ${good ? '' : 'is-bad'}`}
      aria-pressed={!good}
      onClick={onClick}
    >
      <span className="sim-toggle-label">{label}</span>
      <span className="sim-toggle-state">
        <i aria-hidden="true" />
        {good ? goodText : badText}
      </span>
      <span className="sim-toggle-hint">{good ? hint : 'Tap to fix'}</span>
    </button>
  )
}

function Alert({
  alert,
  incident,
  onAck,
  onResolve,
}: {
  alert: SimAlert
  incident: SimIncident | undefined
  onAck: (id: number) => void
  onResolve: (id: number) => void
}) {
  if (alert.channel === 'sms') {
    return (
      <div className="phone-sms">
        <span className="phone-from">SMS from the unit, {clock(alert.at)}</span>
        <p>{alert.body}</p>
      </div>
    )
  }
  return (
    <div className={`phone-push ${alert.tone}`}>
      <div className="phone-push-top">
        <span className="phone-app">COLDGUARD</span>
        <span className="mono">{clock(alert.at)}</span>
      </div>
      <strong>{alert.title}</strong>
      <p>{alert.body}</p>
      {incident ? (
        <div className="phone-actions">
          {incident.status === 'open' ? (
            <button type="button" onClick={() => onAck(incident.id)}>
              Acknowledge
            </button>
          ) : null}
          {incident.status !== 'resolved' ? (
            <button type="button" className="primary" onClick={() => onResolve(incident.id)}>
              Resolve
            </button>
          ) : (
            <span className="phone-done">Resolved</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * "Try to spoil the produce": a playable ColdGuard storehouse. Visitors break
 * the cold room and watch the readings, the incident and the alert play out.
 */
export function FridgeSim() {
  const root = useRef<HTMLDivElement>(null)
  const visible = useVisible(root)
  const [s, dispatch] = useReducer(simReducer, undefined, initialSim)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running || !visible) return
    const id = window.setInterval(() => dispatch({ type: 'tick' }), SIM_TICK_MS)
    return () => window.clearInterval(id)
  }, [running, visible])

  const tone = tempTone(s.temp, FRIDGE_LIMITS)
  const from = s.t - WINDOW
  const open = s.incidents.filter((i) => i.status !== 'resolved')
  const recent = s.events.slice(-4).reverse()

  return (
    <div className="sim" ref={root}>
      <div className="sim-main">
        <div className="sim-controls" role="group" aria-label="Break the storehouse">
          <Toggle
            label="Cold-room door"
            good={!s.door}
            goodText="Closed"
            badText="Open"
            hint="Tap to open"
            onClick={() => dispatch({ type: 'toggle', key: 'door' })}
          />
          <Toggle
            label="Mains power"
            good={s.power}
            goodText="On"
            badText="Cut"
            hint="Tap to cut"
            onClick={() => dispatch({ type: 'toggle', key: 'power' })}
          />
          <Toggle
            label="Wi-Fi"
            good={s.wifi}
            goodText="On"
            badText="Down"
            hint="Tap to drop"
            onClick={() => dispatch({ type: 'toggle', key: 'wifi' })}
          />
        </div>

        <div className="sim-readout">
          <div className="sim-temp-wrap">
            <span className={`sim-temp ${tone ?? ''}`}>{s.temp.toFixed(1)}°C</span>
            <span className={`badge ${tone ?? 'neutral'}`}>
              <span className="dot" />
              {toneLabel(tone)}
            </span>
          </div>
          <dl className="sim-stats">
            <div>
              <dt>Clock</dt>
              <dd className="mono">{clock(s.t)}</dd>
            </div>
            <div>
              <dt>Compressor</dt>
              <dd className="mono">{s.amps.toFixed(2)} A</dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd className="mono">{Math.round(s.rh)}%</dd>
            </div>
            <div>
              <dt>Open incidents</dt>
              <dd className="mono">{open.length}</dd>
            </div>
          </dl>
        </div>

        <div className="sim-chart">
          <LiveChart
            points={s.temps}
            label="Storehouse temperature"
            unit="°C"
            height={270}
            domain={[from, s.t]}
            band={BAND}
            thresholds={THRESHOLDS}
            markers={simMarkers(s.events, from)}
            live={running}
            animate={false}
            transitionMs={SIM_TICK_MS}
            gapMs={10 * 60_000}
          />
        </div>

        <div className="sim-bottom">
          <ol className="sim-log" aria-live="polite" aria-label="What just happened">
            {recent.length === 0 ? (
              <li className="sim-log-empty">Nothing yet. Open the door and watch the line.</li>
            ) : (
              recent.map((e) => (
                <li key={e.id}>
                  <time className="mono">{clock(e.at)}</time>
                  <i className={`sim-dot ${e.tone}`} aria-hidden="true" />
                  <span>{e.text}</span>
                </li>
              ))
            )}
          </ol>
          <div className="sim-run">
            <div className="sim-amps">
              <span>Compressor current</span>
              <Sparkline points={s.ampsPts} domain={[from, s.t]} height={28} />
            </div>
            <div className="sim-run-btns">
              <button type="button" className="btn secondary sm" onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause' : 'Play'}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => dispatch({ type: 'reset' })}>
                Reset
              </button>
            </div>
            <span className="sim-speed mono">{SIM_SPEED}× real time</span>
          </div>
        </div>
      </div>

      <div className="sim-side">
        <div className="phone" aria-label="A staff member’s phone">
          <div className="phone-notch" aria-hidden="true" />
          <div className="phone-head">
            <strong>Alerts</strong>
            <span className="mono">{clock(s.t)}</span>
          </div>
          <div className="phone-list">
            {s.alerts.length === 0 ? (
              <p className="phone-empty">No alerts. Produce is in band.</p>
            ) : (
              s.alerts.slice(0, 4).map((a) => (
                <Alert
                  key={a.id}
                  alert={a}
                  incident={s.incidents.find((i) => i.id === a.incidentId)}
                  onAck={(id) => dispatch({ type: 'ack', id })}
                  onResolve={(id) => dispatch({ type: 'resolve', id })}
                />
              ))
            )}
          </div>
        </div>
        <p className="sim-side-cap">
          Alerts land here like they would on a storehouse operator’s phone. With the Wi-Fi down, critical alerts
          arrive by SMS instead.
        </p>
      </div>
    </div>
  )
}
