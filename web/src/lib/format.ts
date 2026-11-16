import { format, formatDistanceToNow } from 'date-fns'
import type { AssetType, IncidentSeverity, IncidentStatus, Role } from '../types'

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * Parse an API timestamp. The backend stores UTC, but SQLite drops the
 * zone so values arrive as naive ISO strings ("2026-11-15T09:03:44").
 * Treat those as UTC instead of the browser's local time.
 */
export function parseTs(iso: string): Date {
  return new Date(HAS_ZONE.test(iso) ? iso : `${iso}Z`)
}

export function tsMs(iso: string): number {
  return parseTs(iso).getTime()
}

export function fmtTemp(v: number) {
  return `${v.toFixed(1)}°C`
}

export function fmtPct(v: number) {
  return `${Math.round(v)}%`
}

export function fmtAmps(v: number) {
  return `${v.toFixed(2)} A`
}

export function fmtWhen(iso: string) {
  const d = parseTs(iso)
  return Number.isNaN(d.getTime()) ? iso : format(d, 'dd MMM, HH:mm')
}

export function fmtRelative(iso: string) {
  const d = parseTs(iso)
  return Number.isNaN(d.getTime()) ? iso : formatDistanceToNow(d, { addSuffix: true })
}

/** Compact "12s ago" style used by live indicators. */
export function fmtAgo(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
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

/**
 * Temperature tone for an asset's thresholds. Mirrors the backend rule
 * engine: below minimum or at/above critical is critical, above the warning
 * line or the safe maximum is a warning.
 */
export function tempTone(
  value: number | null | undefined,
  t: { tempMinC: number; tempMaxC: number; tempWarningC: number; tempCriticalC: number },
): 'ok' | 'warn' | 'crit' | undefined {
  if (value == null) return undefined
  if (value < t.tempMinC || value >= t.tempCriticalC) return 'crit'
  if (value > t.tempWarningC || value > t.tempMaxC) return 'warn'
  return 'ok'
}

export function toneLabel(tone: 'ok' | 'warn' | 'crit' | undefined) {
  if (tone === 'crit') return 'Critical'
  if (tone === 'warn') return 'Warning'
  if (tone === 'ok') return 'In range'
  return 'No reading'
}
