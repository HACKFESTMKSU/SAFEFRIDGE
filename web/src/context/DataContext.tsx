import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type {
  Asset,
  Device,
  Incident,
  MaintenanceNote,
  TelemetryReading,
  Thresholds,
  User,
} from '../types'
import { useAuth } from './AuthContext'

interface DataState {
  assets: Asset[]
  devices: Device[]
  incidents: Incident[]
  notes: MaintenanceNote[]
  users: User[]
  ready: boolean
  connected: boolean
  /** Epoch ms of the last successful poll, for "updated 4s ago" indicators. */
  lastUpdated: number | null
  getTelemetry: (deviceId: string) => TelemetryReading[]
  getLatest: (deviceId: string) => TelemetryReading | null
  upsertAsset: (asset: Asset) => Promise<void>
  linkDevice: (deviceId: string, assetId: string | null) => Promise<void>
  updateThresholds: (assetId: string, thresholds: Thresholds, sms: string[]) => Promise<void>
  acknowledgeIncident: (id: string) => Promise<void>
  resolveIncident: (id: string, note: string) => Promise<void>
  addNote: (assetId: string, body: string, incidentId?: string) => Promise<void>
  upsertUser: (user: User) => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

const NO_SERIES: TelemetryReading[] = []

const POLL_LIVE_MS = 5_000
const POLL_META_MS = 15_000
const POLL_FULL_MS = 60_000

function normDevice(d: Device): Device {
  return { ...d, lastSeen: d.lastSeen ?? new Date(0).toISOString() }
}

function normReading(r: TelemetryReading): TelemetryReading {
  return {
    ...r,
    temperature_c: r.temperature_c ?? 0,
    humidity_percent: r.humidity_percent ?? 0,
    current_a: r.current_a ?? 0,
    water_level: r.water_level ?? 0,
    water_wet: r.water_wet ?? false,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [notes, setNotes] = useState<MaintenanceNote[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryReading[]>>({})
  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const assetsRef = useRef<Asset[]>([])
  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  const devicesRef = useRef<Device[]>([])
  useEffect(() => {
    devicesRef.current = devices
  }, [devices])

  const loadNotes = useCallback(async (assetList: Asset[]) => {
    const lists = await Promise.all(
      assetList.map((a) =>
        api<MaintenanceNote[]>(`/assets/${a.id}/notes`).catch(
          () => [] as MaintenanceNote[],
        ),
      ),
    )
    const merged = new Map<string, MaintenanceNote>()
    for (const n of lists.flat()) merged.set(n.id, n)
    setNotes([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }, [])

  const loadTelemetrySeries = useCallback(async (deviceList: Device[]) => {
    const results = await Promise.all(
      deviceList.map((d) =>
        api<TelemetryReading[]>(`/telemetry/${d.id}?hours=24`)
          .then((rows) => rows.map(normReading))
          .catch(() => [] as TelemetryReading[]),
      ),
    )
    setTelemetry(
      Object.fromEntries(deviceList.map((d, i) => [d.id, results[i]])),
    )
  }, [])

  const loadTelemetryLatest = useCallback(async (deviceList: Device[]) => {
    let reached = 0
    const results = await Promise.all(
      deviceList.map((d) =>
        api<TelemetryReading | null>(`/telemetry/${d.id}/latest`)
          .then((r) => {
            reached += 1
            return r ? normReading(r) : null
          })
          .catch(() => null),
      ),
    )
    setTelemetry((prev) => {
      const next = { ...prev }
      deviceList.forEach((d, i) => {
        const latest = results[i]
        if (!latest) return
        const series = next[d.id] ?? []
        const last = series[series.length - 1]
        if (!last || latest.timestamp > last.timestamp) {
          next[d.id] = [...series, latest]
        } else if (last && latest.timestamp === last.timestamp) {
          next[d.id] = [...series.slice(0, -1), latest]
        }
      })
      return next
    })
    return reached
  }, [])

  const loadCore = useCallback(async () => {
    const [a, d, i] = await Promise.all([
      api<Asset[]>('/assets'),
      api<Device[]>('/devices'),
      api<Incident[]>('/incidents'),
    ])
    setAssets(a)
    const normDevices = d.map(normDevice)
    setDevices(normDevices)
    setIncidents(i)
    if (user?.role === 'admin') {
      try {
        setUsers(await api<User[]>('/users'))
      } catch {
        setUsers([])
      }
    }
    return { assets: a, devices: normDevices, incidents: i }
  }, [user?.role])

  const refresh = useCallback(
    async (full: boolean) => {
      const core = await loadCore()
      await loadNotes(core.assets)
      if (full) await loadTelemetrySeries(core.devices)
      else await loadTelemetryLatest(core.devices)
    },
    [loadCore, loadNotes, loadTelemetrySeries, loadTelemetryLatest],
  )

  useEffect(() => {
    if (!user) {
      setReady(true)
      return
    }
    let cancelled = false
    const run = async (full: boolean) => {
      try {
        await refresh(full)
        setConnected(true)
        setLastUpdated(Date.now())
      } catch {
        setConnected(false)
        // 401 already cleared the token; auth context will redirect
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    // Fast path: only the newest reading per device, so charts move in near real time.
    const runLive = async () => {
      const list = devicesRef.current
      if (!list.length) return
      const reached = await loadTelemetryLatest(list)
      if (cancelled) return
      if (reached > 0) setLastUpdated(Date.now())
    }
    run(true)
    const liveTimer = setInterval(runLive, POLL_LIVE_MS)
    const metaTimer = setInterval(() => run(false), POLL_META_MS)
    const fullTimer = setInterval(() => run(true), POLL_FULL_MS)
    return () => {
      cancelled = true
      clearInterval(liveTimer)
      clearInterval(metaTimer)
      clearInterval(fullTimer)
    }
  }, [user, refresh, loadTelemetryLatest])

  const getTelemetry = useCallback(
    (deviceId: string) => telemetry[deviceId] ?? NO_SERIES,
    [telemetry],
  )

  const getLatest = useCallback(
    (deviceId: string) => {
      const series = telemetry[deviceId]
      return series?.length ? series[series.length - 1] : null
    },
    [telemetry],
  )

  const upsertAsset = useCallback(
    async (asset: Asset) => {
      try {
        if (assetsRef.current.some((a) => a.id === asset.id)) {
          const updated = await api<Asset>(`/assets/${asset.id}/thresholds`, {
            method: 'PATCH',
            body: { ...asset.thresholds, smsRecipients: asset.smsRecipients },
          })
          setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
        } else {
          const created = await api<Asset>('/assets', { method: 'POST', body: asset })
          setAssets((prev) => [...prev, created])
        }
      } catch (err) {
        console.error('upsertAsset failed', err)
      }
    },
    [],
  )

  const linkDevice = useCallback(
    async (deviceId: string, assetId: string | null) => {
      try {
        if (assetId) {
          await api(`/assets/${assetId}/link-device`, {
            method: 'POST',
            body: { deviceId },
          })
        } else {
          const asset = assetsRef.current.find((a) => a.deviceId === deviceId)
          if (asset) {
            await api(`/assets/${asset.id}/link-device`, { method: 'DELETE' })
          }
        }
        await refresh(false)
      } catch (err) {
        console.error('linkDevice failed', err)
      }
    },
    [refresh],
  )

  const updateThresholds = useCallback(
    async (assetId: string, thresholds: Thresholds, sms: string[]) => {
      try {
        const updated = await api<Asset>(`/assets/${assetId}/thresholds`, {
          method: 'PATCH',
          body: { ...thresholds, smsRecipients: sms },
        })
        setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)))
      } catch (err) {
        console.error('updateThresholds failed', err)
      }
    },
    [],
  )

  const acknowledgeIncident = useCallback(async (id: string) => {
    try {
      const updated = await api<Incident>(`/incidents/${id}/acknowledge`, {
        method: 'POST',
      })
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)))
    } catch (err) {
      console.error('acknowledgeIncident failed', err)
    }
  }, [])

  const resolveIncident = useCallback(async (id: string, note: string) => {
    try {
      const updated = await api<Incident>(`/incidents/${id}/resolve`, {
        method: 'POST',
        body: { note },
      })
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)))
    } catch (err) {
      console.error('resolveIncident failed', err)
    }
  }, [])

  const addNote = useCallback(
    async (assetId: string, body: string, incidentId?: string) => {
      try {
        const note = await api<MaintenanceNote>(`/assets/${assetId}/notes`, {
          method: 'POST',
          body: { body, ...(incidentId ? { incidentId } : {}) },
        })
        setNotes((prev) => [note, ...prev])
      } catch (err) {
        console.error('addNote failed', err)
      }
    },
    [],
  )

  const upsertUser = useCallback(async (next: User) => {
    try {
      const exists = users.some((u) => u.id === next.id)
      const updated = exists
        ? await api<User>(`/users/${next.id}`, {
            method: 'PATCH',
            body: {
              name: next.name,
              phone: next.phone,
              role: next.role,
              ...(next.password ? { password: next.password } : {}),
            },
          })
        : await api<User>('/users', {
            method: 'POST',
            body: {
              email: next.email,
              name: next.name,
              phone: next.phone,
              role: next.role,
              password: next.password,
            },
          })
    setUsers((prev) => {
        const i = prev.findIndex((u) => u.id === updated.id)
        if (i < 0) return [...prev, updated]
      const copy = [...prev]
        copy[i] = updated
      return copy
    })
    } catch (err) {
      console.error('upsertUser failed', err)
    }
  }, [users])

  const value = useMemo(
    () => ({
      assets,
      devices,
      incidents,
      notes,
      users,
      ready,
      connected,
      lastUpdated,
      getTelemetry,
      getLatest,
      upsertAsset,
      linkDevice,
      updateThresholds,
      acknowledgeIncident,
      resolveIncident,
      addNote,
      upsertUser,
    }),
    [
      assets,
      devices,
      incidents,
      notes,
      users,
      ready,
      connected,
      lastUpdated,
      getTelemetry,
      getLatest,
      upsertAsset,
      linkDevice,
      updateThresholds,
      acknowledgeIncident,
      resolveIncident,
      addNote,
      upsertUser,
    ],
  )

  if (user && !ready) {
    return (
      <DataContext.Provider value={value}>
        <div className="login-page">
          <div className="empty">Loading ColdGuard…</div>
        </div>
      </DataContext.Provider>
    )
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
