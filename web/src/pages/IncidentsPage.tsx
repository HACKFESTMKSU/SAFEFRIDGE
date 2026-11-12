import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { useData } from '../context/DataContext'
import {
  fmtRelative,
  severityLabel,
  statusLabel,
} from '../lib/format'
import type { IncidentStatus } from '../types'

export function IncidentsPage() {
  const { incidents, assets } = useData()
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all')

  const rows = useMemo(() => {
    return incidents
      .filter((i) => (filter === 'all' ? true : i.status === filter))
      .slice()
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  }, [incidents, filter])

  return (
    <>
      <div className="page-intro">
        <div>
          <h2 style={{ fontSize: '1.35rem' }}>Incidents</h2>
          <p>Threshold breaches and device issues. Acknowledge and resolve from the detail view.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(['all', 'open', 'acknowledged', 'resolved'] as const).map((f) => (
            <button
              key={f}
              className={`btn sm ${filter === f ? '' : 'secondary'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : statusLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th>Asset</th>
                <th>Status</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inc) => {
                const asset = assets.find((a) => a.id === inc.assetId)
                return (
                  <tr key={inc.id}>
                    <td>
                      <Badge tone={inc.severity === 'critical' ? 'crit' : 'warn'}>
                        {severityLabel(inc.severity)}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        to={`/incidents/${inc.id}`}
                        style={{ fontWeight: 600, color: 'var(--accent-strong)' }}
                      >
                        {inc.title}
                      </Link>
                    </td>
                    <td>{asset?.name ?? inc.assetId}</td>
                    <td>
                      <Badge tone={inc.status === 'resolved' ? 'ok' : 'neutral'}>
                        {statusLabel(inc.status)}
                      </Badge>
                    </td>
                    <td>{fmtRelative(inc.detectedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="empty">No incidents in this filter.</div> : null}
        </div>
      </section>
    </>
  )
}
