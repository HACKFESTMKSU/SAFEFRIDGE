import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  loading: boolean
  refresh: () => Promise<void>
  getTelemetry: (deviceId: string) => TelemetryReading[]
  getLatest: (deviceId: string) => TelemetryReading | null
  upsertAsset: (input: {
    name: string
    type: Asset['type']
    location: string
    thresholds: Thresholds
  }) => Promise<void>
  linkDevice: (deviceId: string, assetId: string | null) => Promise<void>
  updateThresholds: (assetId: string, thresholds: Thresholds, sms: string[]) => Promise<void>
  acknowledgeIncident: (id: string) => Promise<void>
  resolveIncident: (id: string, note: string) => Promise<void>
  addNote: (assetId: string, body: string, incidentId?: string) => Promise<void>
  upsertUser: (input: {
    name: string
    email: string
    phone: string
    role: User['role']
    password: string
  }) => Promise<void>
}

const DataContext = createContext<DataState | null>(null)
const POLL_MS = 5000

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [notes, setNotes] = useState<MaintenanceNote[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryReading[]>>({})
  const [loading, setLoading] = useState(false)

  const loadTelemetry = useCallback(async (deviceList: Device[]) => {
    const entries = await Promise.all(
      deviceList.map(async (d) => {
        try {
          const series = await api<TelemetryReading[]>(`/telemetry/${d.id}?hours=24`)
          return [d.id, series] as const
        } catch {
          return [d.id, [] as TelemetryReading[]] as const
        }
      }),
    )
    setTelemetry(Object.fromEntries(entries))
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [nextAssets, nextDevices, nextIncidents, nextNotes] = await Promise.all([
        api<Asset[]>('/assets'),
        api<Device[]>('/devices'),
        api<Incident[]>('/incidents'),
        api<MaintenanceNote[]>('/notes'),
      ])
      setAssets(nextAssets)
      setDevices(nextDevices)
      setIncidents(nextIncidents)
      setNotes(nextNotes)
      await loadTelemetry(nextDevices)

      const nextUsers = await api<User[]>('/users')
      setUsers(nextUsers)
    } finally {
      setLoading(false)
    }
  }, [user, loadTelemetry])

  useEffect(() => {
    if (!user) {
      setAssets([])
      setDevices([])
      setIncidents([])
      setNotes([])
      setUsers([])
      setTelemetry({})
      return
    }
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [user, refresh])

  const getTelemetry = useCallback(
    (deviceId: string) => telemetry[deviceId] ?? [],
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
    async (input: {
      name: string
      type: Asset['type']
      location: string
      thresholds: Thresholds
    }) => {
      await api<Asset>('/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          type: input.type,
          location: input.location,
          thresholds: input.thresholds,
          smsRecipients: [],
        }),
      })
      await refresh()
    },
    [refresh],
  )

  const linkDevice = useCallback(
    async (deviceId: string, assetId: string | null) => {
      await api(`/devices/${deviceId}/link`, {
        method: 'PATCH',
        body: JSON.stringify({ assetId }),
      })
      await refresh()
    },
    [refresh],
  )

  const updateThresholds = useCallback(
    async (assetId: string, thresholds: Thresholds, sms: string[]) => {
      await api(`/assets/${assetId}/thresholds`, {
        method: 'PATCH',
        body: JSON.stringify({ thresholds, smsRecipients: sms }),
      })
      await refresh()
    },
    [refresh],
  )

  const acknowledgeIncident = useCallback(
    async (id: string) => {
      await api(`/incidents/${id}/acknowledge`, { method: 'POST' })
      await refresh()
    },
    [refresh],
  )

  const resolveIncident = useCallback(
    async (id: string, note: string) => {
      await api(`/incidents/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      })
      await refresh()
    },
    [refresh],
  )

  const addNote = useCallback(
    async (assetId: string, body: string, incidentId?: string) => {
      await api('/notes', {
        method: 'POST',
        body: JSON.stringify({ assetId, body, incidentId }),
      })
      await refresh()
    },
    [refresh],
  )

  const upsertUser = useCallback(
    async (input: {
      name: string
      email: string
      phone: string
      role: User['role']
      password: string
    }) => {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      assets,
      devices,
      incidents,
      notes,
      users,
      loading,
      refresh,
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
      loading,
      refresh,
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

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
