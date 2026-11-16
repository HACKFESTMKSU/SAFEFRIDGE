import type { ChartMarker, ChartPoint } from '../components/charts/LiveChart'
import type { Incident, TelemetryReading } from '../types'
import { tsMs } from './format'

export type Range = '30m' | '6h' | '24h'

/** Shared empty series so memoised selectors stay stable when a unit has no device. */
export const NO_READINGS: TelemetryReading[] = []

export const RANGE_MS: Record<Range, number> = {
  '30m': 30 * 60_000,
  '6h': 6 * 3_600_000,
  '24h': 24 * 3_600_000,
}

type NumericKey = {
  [K in keyof TelemetryReading]-?: TelemetryReading[K] extends number ? K : never
}[keyof TelemetryReading]

export function toSeries(rows: TelemetryReading[], key: NumericKey): ChartPoint[] {
  return rows.map((r) => ({ t: tsMs(r.timestamp), v: r[key] }))
}

/** Incidents for one asset, as short labelled markers on its chart. */
export function incidentMarkers(incidents: Incident[], assetId: string | undefined): ChartMarker[] {
  return incidents
    .filter((i) => i.assetId === assetId)
    .map((i) => {
      const label =
        i.type === 'temperature' && i.value != null
          ? `${i.value.toFixed(1)}°C`
          : i.type === 'device_offline'
            ? 'Offline'
            : i.type === 'water'
              ? 'Leak'
              : i.type === 'current'
                ? 'Low current'
                : 'Humidity'
      return {
        t: tsMs(i.detectedAt),
        label,
        tone: i.severity === 'critical' ? 'crit' : 'warn',
      }
    })
}
