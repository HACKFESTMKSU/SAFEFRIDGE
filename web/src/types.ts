export type Role = 'admin' | 'operator' | 'technician'

export type AssetType = 'refrigerator' | 'freezer' | 'cold_box' | 'warehouse'
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
  productKey?: string | null
  detectionConfidence?: number | null
  lastDetectionAt?: string | null
  detectionSource?: string | null
  agentNotes?: string | null
}

export interface ProduceProfile {
  productKey: string
  label: string
  tempMinC: number
  tempMaxC: number
  tempWarningC: number
  tempCriticalC: number
  humidityMaxPercent: number
  notes: string
  visionPrompts: string[]
}

export interface DetectionBox {
  label: string
  product_key?: string | null
  productKey?: string | null
  confidence: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface CharacterizeResult {
  asset: Asset
  productKey: string | null
  confidence: number
  detections: Array<{ product_key?: string; productKey?: string; confidence: number; hits?: number }>
  boxes: DetectionBox[]
  /** JPEG of annotated mid-frame (base64, no data: prefix) */
  previewImageBase64: string | null
  framesSampled: number
  visionModel: string | null
  visionReady: boolean
  agentSource: string
  status: string
  guidance: string
  thresholdsApplied: boolean
  message?: string
}

export interface Device {
  id: string
  name: string
  firmwareVersion: string
  online: boolean
  /** Null until the device has published at least one MQTT heartbeat. */
  lastSeen: string | null
  assetId: string | null
}

export interface TelemetryReading {
  timestamp: string
  temperature_c: number | null
  humidity_percent: number | null
  current_a: number | null
  water_level: number | null
  water_wet: boolean
  quality?: string
  /** Optional lab extras (BMP180 / MQ-3 demo fields). */
  pressure_hpa?: number | null
  bmp_temperature_c?: number | null
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
