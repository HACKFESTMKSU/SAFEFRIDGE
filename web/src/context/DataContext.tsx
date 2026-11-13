import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { formatISO } from 'date-fns'
import {
  SEED_ASSETS,
  SEED_DEVICES,
  SEED_INCIDENTS,
  SEED_NOTES,
  SEED_TELEMETRY,
  SEED_USERS,
} from '../data/mock'
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
  getTelemetry: (deviceId: string) => TelemetryReading[]
  getLatest: (deviceId: string) => TelemetryReading | null
  upsertAsset: (asset: Asset) => void
  linkDevice: (deviceId: string, assetId: string | null) => void
  updateThresholds: (assetId: string, thresholds: Thresholds, sms: string[]) => void
  acknowledgeIncident: (id: string) => void
  resolveIncident: (id: string, note: string) => void
  addNote: (assetId: string, body: string, incidentId?: string) => void
  upsertUser: (user: User) => void
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [assets, setAssets] = useState(SEED_ASSETS)
  const [devices, setDevices] = useState(SEED_DEVICES)
  const [incidents, setIncidents] = useState(SEED_INCIDENTS)
  const [notes, setNotes] = useState(SEED_NOTES)
  const [users, setUsers] = useState(SEED_USERS)
  const [telemetry] = useState(SEED_TELEMETRY)

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

  const upsertAsset = useCallback((asset: Asset) => {
    setAssets((prev) => {
      const i = prev.findIndex((a) => a.id === asset.id)
      if (i < 0) return [...prev, asset]
      const next = [...prev]
      next[i] = asset
      return next
    })
  }, [])

  const linkDevice = useCallback((deviceId: string, assetId: string | null) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) return { ...d, assetId }
        if (assetId && d.assetId === assetId) return { ...d, assetId: null }
        return d
      }),
    )
    setAssets((prev) =>
      prev.map((a) => {
        if (assetId && a.id === assetId) return { ...a, deviceId }
        if (a.deviceId === deviceId) return { ...a, deviceId: null }
        return a
      }),
    )
  }, [])

  const updateThresholds = useCallback(
    (assetId: string, thresholds: Thresholds, sms: string[]) => {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, thresholds, smsRecipients: sms } : a,
        ),
      )
    },
    [],
  )

  const acknowledgeIncident = useCallback(
    (id: string) => {
      if (!user) return
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === id && inc.status === 'open'
            ? {
                ...inc,
                status: 'acknowledged',
                acknowledgedAt: formatISO(new Date()),
                acknowledgedBy: user.id,
              }
            : inc,
        ),
      )
    },
    [user],
  )

  const resolveIncident = useCallback(
    (id: string, note: string) => {
      if (!user) return
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === id && inc.status !== 'resolved'
            ? {
                ...inc,
                status: 'resolved',
                resolvedAt: formatISO(new Date()),
                resolvedBy: user.id,
                resolveNote: note,
                acknowledgedAt: inc.acknowledgedAt ?? formatISO(new Date()),
                acknowledgedBy: inc.acknowledgedBy ?? user.id,
              }
            : inc,
        ),
      )
    },
    [user],
  )

  const addNote = useCallback(
    (assetId: string, body: string, incidentId?: string) => {
      if (!user) return
      const note: MaintenanceNote = {
        id: `note-${Date.now()}`,
        assetId,
        incidentId,
        authorId: user.id,
        authorName: user.name,
        body,
        createdAt: formatISO(new Date()),
      }
      setNotes((prev) => [note, ...prev])
    },
    [user],
  )

  const upsertUser = useCallback((next: User) => {
    setUsers((prev) => {
      const i = prev.findIndex((u) => u.id === next.id)
      if (i < 0) return [...prev, next]
      const copy = [...prev]
      copy[i] = next
      return copy
    })
  }, [])

  const value = useMemo(
    () => ({
      assets,
      devices,
      incidents,
      notes,
      users,
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
