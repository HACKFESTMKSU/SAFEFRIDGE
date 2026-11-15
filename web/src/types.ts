export type Role = 'admin' | 'operator' | 'technician'

export type AssetType = 'refrigerator' | 'freezer' | 'cold_box'
export type AssetStatus = 'active' | 'inactive' | 'maintenance'
export type IncidentType = 'temperature' | 'humidity' | 'water' | 'current' | 'device_offline'
export type IncidentSeverity = 'warning' | 'critical'
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved'

export interface User {
  id: string
  email: string
  name: string
  phone: string
  role: Role
}

export interface Thresholds {
  tempMinC: number
  tempMaxC: number
  tempWarningC: number
  tempCriticalC: number
  humidityMaxPercent?: number
  waterWetThreshold?: number
  currentMinA?: number
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  location: string
  status: AssetStatus
  thresholds: Thresholds
  deviceId: string | null
  smsRecipients: string[]
}

export interface Device {
  id: string
  name: string
  firmwareVersion: string
  online: boolean
  lastSeen: string | null
  assetId: string | null
}

export interface TelemetryReading {
  timestamp: string
  temperature_c: number | null
  humidity_percent: number | null
  bmp_temperature_c?: number | null
  pressure_hpa?: number | null
  current_a?: number | null
  water_level?: number | null
  water_wet?: boolean | null
  mq3_raw?: number | null
}

export interface Incident {
  id: string
  assetId: string
  type: IncidentType
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  message: string
  recommendedAction: string
  detectedAt: string
  acknowledgedAt?: string | null
  acknowledgedBy?: string | null
  resolvedAt?: string | null
  resolvedBy?: string | null
  resolveNote?: string | null
  value?: number | null
  threshold?: number | null
}

export interface MaintenanceNote {
  id: string
  assetId: string
  incidentId?: string | null
  authorId: string
  authorName: string
  body: string
  createdAt: string
}
