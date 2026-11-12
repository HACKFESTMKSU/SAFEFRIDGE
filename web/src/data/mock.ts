import { subHours, subMinutes, formatISO } from 'date-fns'
import type {
  Asset,
  Device,
  Incident,
  MaintenanceNote,
  TelemetryReading,
  User,
} from '../types'

export const SEED_USERS: User[] = [
  {
    id: 'u-admin',
    email: 'admin@coldguard.local',
    name: 'Amina Admin',
    phone: '+254700000001',
    role: 'admin',
    password: 'admin123',
  },
  {
    id: 'u-operator',
    email: 'operator@coldguard.local',
    name: 'Owen Operator',
    phone: '+254700000002',
    role: 'operator',
    password: 'operator123',
  },
  {
    id: 'u-tech',
    email: 'tech@coldguard.local',
    name: 'Tessa Technician',
    phone: '+254700000003',
    role: 'technician',
    password: 'tech123',
  },
]

export const SEED_ASSETS: Asset[] = [
  {
    id: 'ast-001',
    name: 'Pharmacy Fridge A',
    type: 'refrigerator',
    location: 'Dispensary · Shelf 2',
    status: 'active',
    deviceId: 'CG-001',
    smsRecipients: ['+254700000002'],
    thresholds: {
      tempMinC: 2,
      tempMaxC: 8,
      tempWarningC: 7,
      tempCriticalC: 10,
      humidityMaxPercent: 70,
      waterWetThreshold: 500,
      currentMinA: 0.3,
    },
  },
  {
    id: 'ast-002',
    name: 'Vaccine Freezer B',
    type: 'freezer',
    location: 'Cold room · Bay 1',
    status: 'active',
    deviceId: 'CG-002',
    smsRecipients: ['+254700000002', '+254700000001'],
    thresholds: {
      tempMinC: -25,
      tempMaxC: -15,
      tempWarningC: -14,
      tempCriticalC: -10,
      humidityMaxPercent: 80,
      waterWetThreshold: 500,
      currentMinA: 0.4,
    },
  },
  {
    id: 'ast-003',
    name: 'Lab Cold Box',
    type: 'cold_box',
    location: 'Lab annex',
    status: 'maintenance',
    deviceId: null,
    smsRecipients: ['+254700000002'],
    thresholds: {
      tempMinC: 2,
      tempMaxC: 8,
      tempWarningC: 7,
      tempCriticalC: 10,
      humidityMaxPercent: 65,
      waterWetThreshold: 400,
    },
  },
]

export const SEED_DEVICES: Device[] = [
  {
    id: 'CG-001',
    name: 'ESP32 · Pharmacy',
    firmwareVersion: '0.1.0',
    online: true,
    lastSeen: formatISO(subMinutes(new Date(), 1)),
    assetId: 'ast-001',
  },
  {
    id: 'CG-002',
    name: 'ESP32 · Freezer',
    firmwareVersion: '0.1.0',
    online: false,
    lastSeen: formatISO(subHours(new Date(), 2)),
    assetId: 'ast-002',
  },
  {
    id: 'CG-003',
    name: 'ESP32 · Spare',
    firmwareVersion: '0.1.0',
    online: false,
    lastSeen: formatISO(subHours(new Date(), 48)),
    assetId: null,
  },
]

function buildSeries(
  hours: number,
  baseTemp: number,
  drift = 0,
): TelemetryReading[] {
  const points: TelemetryReading[] = []
  const now = new Date()
  for (let i = hours * 60; i >= 0; i -= 15) {
    const t = subMinutes(now, i)
    const wave = Math.sin(i / 40) * 0.6
    const spike = i < 40 ? drift : 0
    const temp = +(baseTemp + wave + spike).toFixed(1)
    const water = i < 30 && drift > 2 ? 720 : 80 + Math.random() * 40
    points.push({
      timestamp: formatISO(t),
      temperature_c: temp,
      humidity_percent: +(55 + Math.sin(i / 55) * 6).toFixed(0),
      bmp_temperature_c: +(24 + Math.sin(i / 70) * 1.2).toFixed(1),
      pressure_hpa: +(1012 + Math.sin(i / 90) * 2).toFixed(1),
      current_a: +(1.1 + Math.max(0, Math.sin(i / 25)) * 0.8).toFixed(2),
      water_level: +water.toFixed(0),
      water_wet: water > 500,
      mq3_raw: Math.round(40 + Math.random() * 20),
    })
  }
  return points
}

export const SEED_TELEMETRY: Record<string, TelemetryReading[]> = {
  'CG-001': buildSeries(24, 4.2, 0),
  'CG-002': buildSeries(24, -18.5, 8),
}

export const SEED_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    assetId: 'ast-002',
    type: 'temperature',
    severity: 'critical',
    status: 'open',
    title: 'Temperature above critical',
    message: 'Vaccine Freezer B reading  −10.2°C (critical ≥ −10°C).',
    recommendedAction:
      'Check compressor power and door seal. Move critical stock if recovery stalls.',
    detectedAt: formatISO(subMinutes(new Date(), 28)),
    value: -10.2,
    threshold: -10,
  },
  {
    id: 'inc-002',
    assetId: 'ast-002',
    type: 'device_offline',
    severity: 'warning',
    status: 'acknowledged',
    title: 'Device offline',
    message: 'CG-002 has not reported for over 2 hours.',
    recommendedAction:
      'Verify Wi-Fi near the unit. Check SIM800L SMS if a critical threshold may have fired offline.',
    detectedAt: formatISO(subHours(new Date(), 2)),
    acknowledgedAt: formatISO(subMinutes(new Date(), 50)),
    acknowledgedBy: 'u-operator',
  },
  {
    id: 'inc-003',
    assetId: 'ast-001',
    type: 'water',
    severity: 'warning',
    status: 'resolved',
    title: 'Water sensor wet',
    message: 'Leak / condensate detected under Pharmacy Fridge A.',
    recommendedAction: 'Inspect drip tray and floor for overflow; dry probe area.',
    detectedAt: formatISO(subHours(new Date(), 26)),
    acknowledgedAt: formatISO(subHours(new Date(), 25)),
    acknowledgedBy: 'u-operator',
    resolvedAt: formatISO(subHours(new Date(), 24)),
    resolvedBy: 'u-operator',
    resolveNote: 'Emptied drip tray; sensor dry.',
    value: 680,
    threshold: 500,
  },
]

export const SEED_NOTES: MaintenanceNote[] = [
  {
    id: 'note-001',
    assetId: 'ast-002',
    incidentId: 'inc-001',
    authorId: 'u-tech',
    authorName: 'Tessa Technician',
    body: 'Condenser coils dusty — scheduled clean tomorrow morning.',
    createdAt: formatISO(subMinutes(new Date(), 15)),
  },
]
