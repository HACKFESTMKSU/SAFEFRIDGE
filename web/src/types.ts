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
  password: string
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
  lastSeen: string
  assetId: string | null
}

export interface TelemetryReading {
  timestamp: string
  temperature_c: number
  humidity_percent: number
  bmp_temperature_c: number
  pressure_hpa: number
  current_a: number
  water_level: number
  water_wet: boolean
  mq3_raw: number
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
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  resolveNote?: string
  value?: number
  threshold?: number
}

export interface MaintenanceNote {
  id: string
  assetId: string
  incidentId?: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}
