/**
 * A tiny cold-unit simulator for the landing page. One tick is one simulated
 * minute. The rules mirror the backend: two breaching readings in a row open
 * an incident; with Wi-Fi down the server marks the unit offline after five
 * minutes and the unit itself falls back to SMS for critical temperatures.
 */
import type { ChartMarker, ChartPoint } from '../charts/LiveChart'

export const SIM_TICK_MS = 400
export const SIM_SPEED = Math.round(60_000 / SIM_TICK_MS)
const MIN = 60_000
const KEEP = 120

/** Tomato / aggregation cold-room band (matches produce catalog). */
export const LIMITS = { min: 10, max: 15, warn: 16, crit: 18, ampsMin: 0.3 }
export const UNIT_NAME = 'Produce Storehouse A'

type Tone = 'info' | 'warn' | 'crit' | 'ok'

export interface SimIncident {
  id: number
  type: 'temperature' | 'current' | 'offline'
  severity: 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  title: string
}

export interface SimAlert {
  id: number
  at: number
  channel: 'app' | 'sms'
  tone: 'warn' | 'crit'
  title: string
  body: string
  incidentId: number | null
}

export interface SimEvent {
  id: number
  at: number
  text: string
  tone: Tone
  marker?: string
}

export interface SimState {
  t: number
  temp: number
  amps: number
  rh: number
  door: boolean
  power: boolean
  wifi: boolean
  temps: ChartPoint[]
  ampsPts: ChartPoint[]
  breach: number
  critStreak: number
  low: number
  offlineMin: number
  smsSent: boolean
  outOfRange: boolean
  incidents: SimIncident[]
  alerts: SimAlert[]
  events: SimEvent[]
  seq: number
}

export type SimAction =
  | { type: 'tick' }
  | { type: 'toggle'; key: 'door' | 'power' | 'wifi' }
  | { type: 'ack'; id: number }
  | { type: 'resolve'; id: number }
  | { type: 'reset' }

function noise(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function settle(minute: number) {
  return 12.1 + Math.sin(minute / 8) * 0.35
}

function compressor(minute: number) {
  return 1.1 + Math.max(0, Math.sin(minute / 5)) * 0.5 + (noise(minute + 3) - 0.5) * 0.05
}

export function initialSim(): SimState {
  const start = new Date()
  start.setHours(1, 30, 0, 0)
  const t = start.getTime()
  const temps: ChartPoint[] = []
  const ampsPts: ChartPoint[] = []
  for (let i = 90; i >= 1; i -= 1) {
    const at = t - i * MIN
    const minute = Math.round(at / MIN)
    temps.push({ t: at, v: settle(minute) + (noise(minute) - 0.5) * 0.12 })
    ampsPts.push({ t: at, v: compressor(minute) })
  }
  const minute = Math.round(t / MIN)
  const temp = settle(minute)
  temps.push({ t, v: temp })
  ampsPts.push({ t, v: compressor(minute) })
  return {
    t,
    temp,
    amps: compressor(minute),
    rh: 88,
    door: false,
    power: true,
    wifi: true,
    temps,
    ampsPts,
    breach: 0,
    critStreak: 0,
    low: 0,
    offlineMin: 0,
    smsSent: false,
    outOfRange: false,
    incidents: [],
    alerts: [],
    events: [],
    seq: 0,
  }
}

function level(temp: number): 'warn' | 'crit' | null {
  if (temp < LIMITS.min || temp >= LIMITS.crit) return 'crit'
  if (temp > LIMITS.warn || temp > LIMITS.max) return 'warn'
  return null
}

function tick(s: SimState): SimState {
  const t = s.t + MIN
  const minute = Math.round(t / MIN)
  // Thermal model: ease toward a target set by the door and the power.
  const target = !s.power ? 28 : s.door ? 22 : settle(minute)
  const rate = !s.power ? (s.door ? 0.07 : 0.016) : s.door ? 0.16 : 0.12
  const temp = s.temp + (target - s.temp) * rate + (noise(minute) - 0.5) * 0.1
  const amps = !s.power ? 0 : s.door || temp > LIMITS.max ? 1.85 + (noise(minute + 5) - 0.5) * 0.08 : compressor(minute)
  const rh = s.rh + ((s.door ? 92 : 88) - s.rh) * 0.2 + (noise(minute + 9) - 0.5) * 0.4

  let seq = s.seq
  const events = [...s.events]
  const alerts = [...s.alerts]
  const incidents = [...s.incidents]
  const log = (text: string, tone: Tone, marker?: string) => {
    seq += 1
    events.push({ id: seq, at: t, text, tone, marker })
  }
  const openOf = (type: SimIncident['type']) => incidents.find((i) => i.type === type && i.status !== 'resolved')
  const raise = (inc: Omit<SimIncident, 'id' | 'status'>, alert: Omit<SimAlert, 'id' | 'at' | 'incidentId'>) => {
    seq += 1
    const id = seq
    incidents.push({ ...inc, id, status: 'open' })
    seq += 1
    alerts.unshift({ ...alert, id: seq, at: t, incidentId: id })
  }

  const lvl = level(temp)
  const breach = lvl ? s.breach + 1 : 0
  const critStreak = lvl === 'crit' ? s.critStreak + 1 : 0
  let low = s.low
  let offlineMin = s.offlineMin
  let smsSent = s.smsSent
  let outOfRange = s.outOfRange

  if (lvl === 'warn' && !outOfRange) {
    log(`Above the ${LIMITS.warn}°C warning line at ${temp.toFixed(1)}°C`, 'warn')
  }
  if (lvl === 'crit' && s.critStreak === 0) {
    log(`Critical at ${temp.toFixed(1)}°C`, 'crit')
  }
  if (lvl) outOfRange = true
  if (!lvl && outOfRange) {
    outOfRange = false
    smsSent = false
    log(`Back in range at ${temp.toFixed(1)}°C`, 'ok', 'Back in range')
  }

  if (s.wifi) {
    offlineMin = 0
    if (lvl && breach >= 2 && !openOf('temperature')) {
      const critical = lvl === 'crit'
      raise(
        {
          type: 'temperature',
          severity: critical ? 'critical' : 'warning',
          title: `Temperature ${critical ? 'critical' : 'warning'} at ${temp.toFixed(1)}°C`,
        },
        {
          channel: 'app',
          tone: lvl,
          title: `${UNIT_NAME} at ${temp.toFixed(1)}°C`,
          body: critical
            ? 'Critical for stored tomatoes. Check the door and the power now.'
            : `Above ${LIMITS.warn}°C and rising. Check the door seal.`,
        },
      )
      log(`Second reading confirmed it. Incident opened, alert sent to app and email`, lvl, `${temp.toFixed(1)}°C`)
    }
    low = amps < LIMITS.ampsMin ? s.low + 1 : 0
    if (low >= 2 && !openOf('current')) {
      raise(
        { type: 'current', severity: 'warning', title: 'Compressor not running' },
        {
          channel: 'app',
          tone: 'warn',
          title: 'Compressor stopped',
          body: 'Current is near 0 A. Power may be off at the socket.',
        },
      )
      log('Compressor current near 0 A. Incident opened', 'warn', 'No current')
    }
  } else {
    offlineMin = s.offlineMin + 1
    low = 0
    if (offlineMin === 5 && !openOf('offline')) {
      raise(
        { type: 'offline', severity: 'warning', title: 'Unit offline' },
        {
          channel: 'app',
          tone: 'warn',
          title: `${UNIT_NAME} went quiet`,
          body: 'No readings for 5 minutes. The unit is still watching and will SMS if it gets critical.',
        },
      )
      log('No readings for 5 minutes. Server marked the unit offline', 'warn', 'Offline')
    }
    if (critStreak >= 2 && !smsSent) {
      smsSent = true
      seq += 1
      alerts.unshift({
        id: seq,
        at: t,
        channel: 'sms',
        tone: 'crit',
        title: 'SMS from the unit',
        body: `ColdGuard: ${UNIT_NAME} is at ${temp.toFixed(1)}°C, above its ${LIMITS.max}°C tomato limit. Check the door and power.`,
        incidentId: null,
      })
      log('Wi-Fi is down, so the unit sent an SMS over GSM', 'crit', 'SMS sent')
    }
  }

  return {
    ...s,
    t,
    temp,
    amps,
    rh,
    temps: [...s.temps.slice(-KEEP), { t, v: temp }],
    ampsPts: [...s.ampsPts.slice(-KEEP), { t, v: amps }],
    breach,
    critStreak,
    low,
    offlineMin,
    smsSent,
    outOfRange,
    incidents,
    alerts: alerts.slice(0, 12),
    events: events.slice(-40),
    seq,
  }
}

export function simReducer(s: SimState, a: SimAction): SimState {
  if (a.type === 'tick') return tick(s)
  if (a.type === 'reset') return initialSim()
  const seq = s.seq + 1
  const push = (text: string, tone: Tone, marker?: string) => [
    ...s.events,
    { id: seq, at: s.t, text, tone, marker },
  ]
  if (a.type === 'toggle') {
    if (a.key === 'door') {
      const door = !s.door
      return { ...s, door, seq, events: push(door ? 'Door opened' : 'Door closed', 'info', door ? 'Door open' : undefined) }
    }
    if (a.key === 'power') {
      const power = !s.power
      return { ...s, power, seq, events: push(power ? 'Power restored' : 'Mains power cut', 'info', power ? undefined : 'Power cut') }
    }
    const wifi = !s.wifi
    return {
      ...s,
      wifi,
      seq,
      events: push(wifi ? 'Wi-Fi back. Readings reach the server again' : 'Wi-Fi down. The server stops getting readings', 'info', wifi ? undefined : 'Wi-Fi down'),
    }
  }
  const target = s.incidents.find((i) => i.id === a.id)
  if (!target) return s
  if (a.type === 'ack') {
    return {
      ...s,
      seq,
      incidents: s.incidents.map((i) => (i.id === a.id ? { ...i, status: 'acknowledged' } : i)),
      events: push(`${target.title}: acknowledged`, 'info'),
    }
  }
  return {
    ...s,
    seq,
    incidents: s.incidents.map((i) => (i.id === a.id ? { ...i, status: 'resolved' } : i)),
    events: push(`${target.title}: resolved with a note`, 'ok', 'Resolved'),
  }
}

/** Events with a short label become markers on the chart. */
export function simMarkers(events: SimEvent[], from: number): ChartMarker[] {
  return events
    .filter((e) => e.marker && e.at >= from)
    .slice(-6)
    .map((e) => ({ t: e.at, label: e.marker as string, tone: e.tone }))
}
