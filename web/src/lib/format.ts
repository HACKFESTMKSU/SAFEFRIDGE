import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { AssetType, IncidentSeverity, IncidentStatus, Role } from '../types'

export function fmtTemp(v: number) {
  return `${v.toFixed(1)}°C`
}

export function fmtPct(v: number) {
  return `${Math.round(v)}%`
}

export function fmtAmps(v: number) {
  return `${v.toFixed(2)} A`
}

export function fmtPressure(v: number) {
  return `${v.toFixed(1)} hPa`
}

export function fmtWhen(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM · HH:mm')
  } catch {
    return iso
  }
}

export function fmtRelative(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export function assetTypeLabel(t: AssetType) {
  const map: Record<AssetType, string> = {
    refrigerator: 'Refrigerator',
    freezer: 'Freezer',
    cold_box: 'Cold box',
  }
  return map[t]
}

export function roleLabel(r: Role) {
  const map: Record<Role, string> = {
    admin: 'Admin',
    operator: 'Operator',
    technician: 'Technician',
  }
  return map[r]
}

export function severityLabel(s: IncidentSeverity) {
  return s === 'critical' ? 'Critical' : 'Warning'
}

export function statusLabel(s: IncidentStatus) {
  const map: Record<IncidentStatus, string> = {
    open: 'Open',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved',
  }
  return map[s]
}
